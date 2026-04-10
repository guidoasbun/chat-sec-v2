"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startConnection, stopConnection } from "@/utils/signalr";
import { sanitizeInput } from "@/utils/sanitize";
import type { HubConnection } from "@microsoft/signalr";

// ── Dev placeholders ──────────────────────────────────────────────────────────
// userId comes from the URL: /chat?userId=user-alice
// This lets two tabs use different users without touching the source file.
const CHAT_ID = "chat-001";
const API_BASE = "http://localhost:5257";

interface Message {
  messageId: string;
  senderId: string;
  encryptedContent: string; // plaintext in Phase 2, ciphertext in Phase 3
  timestamp: string;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const USER_ID = searchParams.get("userId") ?? "anonymous";

  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const connRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      // 1. Connect to SignalR hub
      const conn = await startConnection(USER_ID);
      if (cancelled) return;
      connRef.current = conn;

      // 2. Listen for online user updates from the hub
      conn.on("OnlineUsersUpdated", (users: string[]) => {
        setOnlineUsers(users);
      });

      // 3. Listen for incoming messages from the hub
      conn.on("ReceiveMessage", (message: Message) => {
        setMessages((prev) => [...prev, message]);
      });

      // 4. Join the chat group so we receive its messages
      await conn.invoke("JoinChatAsync", CHAT_ID);

      // 5. Load message history via REST
      const res = await fetch(`${API_BASE}/api/chat/${CHAT_ID}/messages`);
      if (res.ok) {
        const history: Message[] = await res.json();
        setMessages(history.reverse()); // API returns newest first
      }
    }

    setup();

    // Cleanup: disconnect when the component unmounts (tab closes / navigate away)
    return () => {
      cancelled = true;
      stopConnection();
    };
  }, [USER_ID]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const clean = sanitizeInput(inputText);
    if (!clean || !connRef.current) return;

    // In Phase 2: send plaintext as encryptedContent (no encryption yet)
    // In Phase 3: this becomes AES-256-GCM ciphertext
    await connRef.current.invoke(
      "SendMessageAsync",
      CHAT_ID,
      USER_ID,
      clean, // encryptedContent
      "", // iv — empty until Phase 3
      "", // signature — empty until Phase 3
    );

    setInputText("");
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar: online users */}
      <aside className="w-48 bg-gray-100 p-4 border-r">
        <h2 className="font-semibold mb-2">Online</h2>
        <ul>
          {onlineUsers.map((u) => (
            <li key={u} className="text-sm py-1 text-black">
              {u === USER_ID ? `${u} (you)` : u}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main: messages + input */}
      <div className="flex flex-col flex-1">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((m) => (
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
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Type a message…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
