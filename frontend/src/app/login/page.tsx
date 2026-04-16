"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deriveWrappingKey,
  decryptPrivateKey,
  decryptSigningPrivateKey,
} from "@/utils/crypto";
import { loadKeys } from "@/utils/keyStorage";
import { setSessionKeys } from "@/utils/sessionKeys";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5257";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Authenticating…");

    try {
      // Step 1: Authenticate with the server
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // sends + receives the HTTP-only auth cookie
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setStatus("Invalid username or password.");
        setLoading(false);
        return;
      }

      const { userId } = await res.json();

      setStatus("Loading keys from storage…");

      // Step 2: Load encrypted key material from IndexedDB
      const stored = await loadKeys(userId);
      if (!stored) {
        setStatus(
          "No keys found for this account on this device. Did you register here?",
        );
        setLoading(false);
        return;
      }

      setStatus("Unlocking private keys…");

      // Step 3: Re-derive the wrapping key from the password + stored salt
      // PBKDF2 is deterministic — same password + same salt = same wrapping key
      const salt = Uint8Array.from(atob(stored.salt), (c) => c.charCodeAt(0));
      const wrappingKey = await deriveWrappingKey(password, salt);

      // Step 4: Decrypt both private keys
      // If the password is wrong, decryptPrivateKey will throw — AES-GCM authentication fails
      const decryptedPrivateKey = await decryptPrivateKey(
        stored.encryptedPrivateKey,
        stored.privateKeyIv,
        wrappingKey,
      );

      const decryptedSigningKey = await decryptSigningPrivateKey(
        stored.encryptedSigningKey,
        stored.signingKeyIv,
        wrappingKey,
      );

      // Step 5: Store decrypted keys in memory for this session
      setSessionKeys(userId, decryptedPrivateKey, decryptedSigningKey);

      setStatus("Done! Redirecting…");
      router.push(`/chat?userId=${encodeURIComponent(userId)}`);
    } catch {
      // AES-GCM decryption failure means wrong password
      setStatus("Wrong password — could not unlock private keys.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-lg shadow w-96 space-y-4"
      >
        <h1 className="text-xl font-semibold">Sign In</h1>

        <input
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Working…" : "Sign In"}
        </button>

        {status && (
          <p className="text-xs text-gray-500 text-center">{status}</p>
        )}
      </form>
    </div>
  );
}
