// All cryptographic operations use the native WebCrypto API (window.crypto.subtle).
// No third-party crypto libraries — the browser implementation is audited and
// hardware-accelerated. Never import crypto-js, jsencrypt, or similar here.

// ── RSA Key Pair ─────────────────────────────────────────────────────────────

// Generates a 4096-bit RSA-OAEP key pair.
// The public key goes to DynamoDB. The private key stays in IndexedDB only.
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256",
    },
    true, // extractable — needed so we can export/store it
    ["encrypt", "decrypt"],
  );
}

// Converts a CryptoKey public key to a PEM string for storing in DynamoDB.
export async function exportPublicKeyPEM(
  publicKey: CryptoKey,
): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

// Converts a PEM string from DynamoDB back into a usable CryptoKey.
export async function importPublicKeyPEM(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(
    /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g,
    "",
  );
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"],
  );
}

// ── AES Session Key ───────────────────────────────────────────────────────────

// Generates a 256-bit AES-GCM key for encrypting messages in a chat.
// One key per chat, shared between participants via RSA-OAEP wrapping.
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ── RSA-OAEP Key Wrapping ─────────────────────────────────────────────────────

// Encrypts the AES session key with a recipient's RSA public key.
// The result is stored in DynamoDB — only the recipient can decrypt it.
export async function encryptAESKey(
  aesKey: CryptoKey,
  recipientPublicKey: CryptoKey,
): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", aesKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    raw,
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// Decrypts an RSA-OAEP-wrapped AES key using your private key.
export async function decryptAESKey(
  encryptedKeyB64: string,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const encrypted = Uint8Array.from(atob(encryptedKeyB64), (c) =>
    c.charCodeAt(0),
  );
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encrypted,
  );
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

// ── AES-GCM Message Encryption ────────────────────────────────────────────────

// Encrypts a plaintext string. Returns base64 ciphertext + base64 IV.
// A new random IV is generated for every message — reusing IVs with GCM is catastrophic.
export async function encryptMessage(
  plaintext: string,
  aesKey: CryptoKey,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded,
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// Decrypts a message given the base64 ciphertext, base64 IV, and AES key.
export async function decryptMessage(
  ciphertextB64: string,
  ivB64: string,
  aesKey: CryptoKey,
): Promise<string> {
  const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) =>
    c.charCodeAt(0),
  );
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

// ── Private Key Protection ────────────────────────────────────────────────────

// Derives an AES-GCM wrapping key from a password using PBKDF2.
// The wrapping key is used to encrypt/decrypt your private key in IndexedDB.
// salt must be stored alongside the encrypted private key (it is not secret).
export async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600_000, // OWASP recommended minimum for PBKDF2-SHA-256
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // not extractable — the wrapping key never leaves memory
    ["wrapKey", "unwrapKey"],
  );
}

// Encrypts the RSA private key with the PBKDF2-derived wrapping key.
// Returns a base64 blob + base64 IV safe to store in IndexedDB.
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<{ encryptedKey: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey(
    "pkcs8",
    privateKey,
    wrappingKey,
    {
      name: "AES-GCM",
      iv,
    },
  );
  return {
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// Decrypts the RSA-OAEP encryption private key from IndexedDB.
export async function decryptPrivateKey(
  encryptedKeyB64: string,
  ivB64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = Uint8Array.from(atob(encryptedKeyB64), (c) =>
    c.charCodeAt(0),
  );
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrapped,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"],
  );
}

// Decrypts the RSA-PSS signing private key from IndexedDB.
// Must use RSA-PSS + ["sign"] — distinct from the encryption key above.
export async function decryptSigningPrivateKey(
  encryptedKeyB64: string,
  ivB64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = Uint8Array.from(atob(encryptedKeyB64), (c) =>
    c.charCodeAt(0),
  );
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrapped,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "RSA-PSS", hash: "SHA-256" },
    true,
    ["sign"],
  );
}

// ── Signatures ────────────────────────────────────────────────────────────────

// Generates an RSA-PSS signing key pair (separate from the encryption key pair).
// Signing proves a message came from you — encryption only proves confidentiality.
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-PSS",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
}

// Signs a plaintext message with your RSA-PSS private signing key.
export async function signMessage(
  message: string,
  signingPrivateKey: CryptoKey,
): Promise<string> {
  const encoded = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    signingPrivateKey,
    encoded,
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Verifies a signature against the sender's public signing key.
// Returns true if the message is authentic and unmodified.
export async function verifySignature(
  message: string,
  signatureB64: string,
  signingPublicKey: CryptoKey,
): Promise<boolean> {
  const encoded = new TextEncoder().encode(message);
  const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
  return crypto.subtle.verify(
    { name: "RSA-PSS", saltLength: 32 },
    signingPublicKey,
    signature,
    encoded,
  );
}

// Exports a signing public key to PEM format for storing in DynamoDB.
export async function exportSigningPublicKeyPEM(
  publicKey: CryptoKey,
): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

// Imports a signing public key from PEM format.
export async function importSigningPublicKeyPEM(
  pem: string,
): Promise<CryptoKey> {
  const b64 = pem.replace(
    /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g,
    "",
  );
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "spki",
    binary,
    { name: "RSA-PSS", hash: "SHA-256" },
    true,
    ["verify"],
  );
}
