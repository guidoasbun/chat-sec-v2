"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateRSAKeyPair,
  generateSigningKeyPair,
  exportPublicKeyPEM,
  exportSigningPublicKeyPEM,
  deriveWrappingKey,
  encryptPrivateKey,
} from "@/utils/crypto";
import { saveKeys } from "@/utils/keyStorage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5257";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("Generating RSA key pairs…");

    try {
      // Step 1: Generate both key pairs in the browser
      const encryptionKeyPair = await generateRSAKeyPair();
      const signingKeyPair = await generateSigningKeyPair();

      setStatus("Deriving wrapping key from password…");

      // Step 2: Derive a wrapping key from the user's password
      // The salt is random and stored in IndexedDB — not secret, but must be saved
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const wrappingKey = await deriveWrappingKey(password, salt);

      setStatus("Encrypting private keys…");

      // Step 3: Encrypt both private keys before storing them
      const { encryptedKey: encryptedPrivateKey, iv: privateKeyIv } =
        await encryptPrivateKey(encryptionKeyPair.privateKey, wrappingKey);

      const { encryptedKey: encryptedSigningKey, iv: signingKeyIv } =
        await encryptPrivateKey(signingKeyPair.privateKey, wrappingKey);

      // Step 4: Export public keys to PEM for the server
      const publicKeyPem = await exportPublicKeyPEM(
        encryptionKeyPair.publicKey,
      );
      const signingPublicKeyPem = await exportSigningPublicKeyPEM(
        signingKeyPair.publicKey,
      );

      setStatus("Registering with server…");

      // Step 5: Register with the backend — public keys only, never private keys
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          publicKey: publicKeyPem,
          signingPublicKey: signingPublicKeyPem,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        setStatus(`Registration failed: ${err}`);
        setLoading(false);
        return;
      }

      const { userId } = await res.json();

      // Step 6: Save encrypted private keys to IndexedDB
      // The private keys are encrypted — safe to store locally
      await saveKeys({
        userId,
        encryptedPrivateKey,
        privateKeyIv,
        salt: btoa(String.fromCharCode(...salt)),
        encryptedSigningKey,
        signingKeyIv,
      });

      setStatus("Done! Please log in.");
      router.push("/login");
    } catch (err) {
      setStatus(`Error: ${err}`);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleRegister}
        className="bg-white p-8 rounded-lg shadow w-96 space-y-4"
      >
        <h1 className="text-xl font-semibold">Create Account</h1>

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
          {loading ? "Working…" : "Register"}
        </button>

        {status && (
          <p className="text-xs text-gray-500 text-center">{status}</p>
        )}
      </form>
    </div>
  );
}
