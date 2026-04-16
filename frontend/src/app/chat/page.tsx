"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { startConnection, stopConnection } from "@/utils/signalr";
import { sanitizeInput } from "@/utils/sanitize";
import {
  generateAESKey,
  encryptAESKey,
  decryptAESKey,
  encryptMessage,
  decryptMessage,
  signMessage,
  verifySignature,
  importPublicKeyPEM,
  importSigningPublicKeyPEM,
} from "@/utils/crypto";
import { privateKey, signingPrivateKey } from "@/utils/sessionKeys";
import type { HubConnection } from "@microsoft/signalr";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5257";

interface Message {
  messageId: string;
  senderId: string;
  encryptedContent: string;
  iv: string;
  signature: string;
  timestamp: string;
}

type SigStatus = "pending" | "valid" | "invalid";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const USER_ID = searchParams.get("userId") ?? "anonymous";

  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [sigStatuses, setSigStatuses] = useState<Record<string, SigStatus>>({});
  const [chatId, setChatId] = useState<string | null>(null);
  const [peerUsername, setPeerUsername] = useState("");
  const [initiating, setInitiating] = useState(false);
  const connRef = useRef<HubConnection | null>(null);
  const aesKeyRef = useRef<CryptoKey | null>(null);

  // ── Chat initiation ─────────────────────────────────────────────────────────
  async function initiateChat() {
    if (!peerUsername || !privateKey) return;
    setInitiating(true);

    try {
      // Fetch your own encryption public key from the server
      const myKeysRes = await fetch(`${API_BASE}/api/users/${USER_ID}/keys`);
      if (!myKeysRes.ok) throw new Error("Could not fetch your keys");
      const { publicKey: myPem } = await myKeysRes.json();
      const myPublicKey = await importPublicKeyPEM(myPem);

      // Fetch the peer's encryption public key by username
      const peerRes = await fetch(
        `${API_BASE}/api/users/${encodeURIComponent(peerUsername.trim())}/public-key`,
      );
      if (!peerRes.ok) {
        const body = await peerRes.text();
        alert(`User lookup failed (${peerRes.status}): ${body}`);
        setInitiating(false);
        return;
      }
      const { userId: peerId, publicKey: peerPem } = await peerRes.json();
      const peerPublicKey = await importPublicKeyPEM(peerPem);

      // Generate a fresh AES-256-GCM session key for this chat
      const aesKey = await generateAESKey();

      // Wrap the AES key for each participant with their RSA public key
      const myBundle = await encryptAESKey(aesKey, myPublicKey);
      const peerBundle = await encryptAESKey(aesKey, peerPublicKey);

      // POST to backend — server stores the chat with both encrypted bundles
      const res = await fetch(`${API_BASE}/api/chat/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: [USER_ID, peerId],
          encryptedKeyBundles: {
            [USER_ID]: myBundle,
            [peerId]: peerBundle,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to create chat");
      const { chatId: newChatId } = await res.json();

      // Store the AES key in memory and set the active chat
      aesKeyRef.current = aesKey;
      setChatId(newChatId);

      // Join the SignalR group for this chat
      if (connRef.current) {
        await connRef.current.invoke("JoinChatAsync", newChatId);
      }
    } catch (err) {
      alert(`Failed to initiate chat: ${err}`);
    } finally {
      setInitiating(false);
    }
  }

  // ── SignalR setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const conn = await startConnection(USER_ID);
      if (cancelled) return;
      connRef.current = conn;

      conn.on("OnlineUsersUpdated", (users: string[]) => {
        setOnlineUsers(users);
      });

      conn.on("ReceiveMessage", async (message: Message) => {
        setMessages((prev) => [...prev, message]);
        if (!aesKeyRef.current) return;

        try {
          const plaintext = await decryptMessage(
            message.encryptedContent,
            message.iv,
            aesKeyRef.current,
          );

          const keyRes = await fetch(
            `${API_BASE}/api/users/${message.senderId}/keys`,
          );
          if (!keyRes.ok) throw new Error("Could not fetch sender keys");
          const { signingPublicKey: signingPem } = await keyRes.json();
          const senderSigningKey = await importSigningPublicKeyPEM(signingPem);

          const valid = await verifySignature(
            plaintext,
            message.signature,
            senderSigningKey,
          );
          setSigStatuses((prev) => ({
            ...prev,
            [message.messageId]: valid ? "valid" : "invalid",
          }));

          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === message.messageId
                ? { ...m, encryptedContent: plaintext }
                : m,
            ),
          );
        } catch {
          setSigStatuses((prev) => ({
            ...prev,
            [message.messageId]: "invalid",
          }));
        }
      });
    }

    setup().catch((err) => {
      // Silently ignore errors when cancelled — React Strict Mode unmounts
      // and remounts components in dev, which interrupts the first connection.
      if (!cancelled) console.error("SignalR setup error:", err);
    });
    return () => {
      cancelled = true;
      stopConnection();
    };
  }, [USER_ID]);

  // ── Join existing chat by ID ─────────────────────────────────────────────────
  async function joinChat(id: string) {
    if (!privateKey || !connRef.current) return;

    const chatRes = await fetch(`${API_BASE}/api/chat/${id}`);
    if (!chatRes.ok) {
      alert("Chat not found");
      return;
    }

    const chat = await chatRes.json();
    const myBundle = chat.encryptedKeyBundles?.[USER_ID];
    if (!myBundle) {
      alert("You are not a participant in this chat");
      return;
    }

    aesKeyRef.current = await decryptAESKey(myBundle, privateKey);
    setChatId(id);
    await connRef.current.invoke("JoinChatAsync", id);

    // Load history
    const histRes = await fetch(`${API_BASE}/api/chat/${id}/messages`);
    if (histRes.ok && aesKeyRef.current) {
      const history: Message[] = await histRes.json();
      const decrypted = await Promise.all(
        history.reverse().map(async (m) => {
          try {
            const plaintext = await decryptMessage(
              m.encryptedContent,
              m.iv,
              aesKeyRef.current!,
            );
            return { ...m, encryptedContent: plaintext };
          } catch {
            return m;
          }
        }),
      );
      setMessages(decrypted);
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const clean = sanitizeInput(inputText);
    if (
      !clean ||
      !connRef.current ||
      !aesKeyRef.current ||
      !signingPrivateKey ||
      !chatId
    )
      return;

    const { ciphertext, iv } = await encryptMessage(clean, aesKeyRef.current);
    const sig = await signMessage(clean, signingPrivateKey);

    await connRef.current.invoke(
      "SendMessageAsync",
      chatId,
      USER_ID,
      ciphertext,
      iv,
      sig,
    );
    setInputText("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-100 p-4 border-r flex flex-col gap-4">
        <div>
          <h2 className="font-semibold mb-2">Online</h2>
          <ul>
            {onlineUsers.map((u) => (
              <li key={u} className="text-sm py-1 text-black">
                {u === USER_ID ? `${u} (you)` : u}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-4">
          <h2 className="font-semibold mb-2">New Chat</h2>
          <input
            className="w-full border rounded px-2 py-1 text-sm mb-2"
            placeholder="Their username"
            value={peerUsername}
            onChange={(e) => setPeerUsername(e.target.value)}
          />
          <button
            onClick={initiateChat}
            disabled={initiating || !peerUsername}
            className="w-full bg-green-500 text-white py-1 rounded text-sm disabled:opacity-50"
          >
            {initiating ? "Creating…" : "Start Chat"}
          </button>
        </div>

        {chatId && (
          <div className="border-t pt-4">
            <h2 className="font-semibold mb-1 text-xs text-gray-500">
              Active Chat ID
            </h2>
            <p className="text-xs break-all text-gray-700">{chatId}</p>
            <p className="text-xs text-gray-400 mt-1">
              Share this ID with the other user so they can join
            </p>
          </div>
        )}

        {!chatId && (
          <div className="border-t pt-4">
            <h2 className="font-semibold mb-2">Join Chat</h2>
            <input
              id="join-input"
              className="w-full border rounded px-2 py-1 text-sm mb-2"
              placeholder="Paste chat ID"
            />
            <button
              onClick={() => {
                const input = document.getElementById(
                  "join-input",
                ) as HTMLInputElement;
                if (input.value) joinChat(input.value);
              }}
              className="w-full bg-blue-500 text-white py-1 rounded text-sm"
            >
              Join
            </button>
          </div>
        )}
      </aside>

      <div className="flex flex-col flex-1">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!chatId && (
            <p className="text-center text-gray-400 text-sm mt-8">
              Start a new chat or join an existing one using the sidebar.
            </p>
          )}
          {messages.map((m) => {
            const sig = sigStatuses[m.messageId];
            return (
              <div
                key={m.messageId}
                className={`max-w-sm px-3 py-2 rounded-lg text-sm ${
                  m.senderId === USER_ID
                    ? "bg-blue-500 text-white ml-auto"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                <p className="font-semibold text-xs mb-1">{m.senderId}</p>
                <p>{m.encryptedContent}</p>
                {sig && (
                  <p className="text-xs mt-1 opacity-75">
                    {sig === "valid" ? "✓ verified" : "✗ invalid signature"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder={chatId ? "Type a message…" : "Join a chat first"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!chatId}
          />
          <button
            type="submit"
            disabled={!chatId}
            className="bg-blue-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
