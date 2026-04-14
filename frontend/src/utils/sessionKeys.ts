// In-memory store for decrypted CryptoKey objects.
// These exist only in RAM for the current browser session.
// On page refresh, they're gone — the user must re-enter their password to unlock them.
// This is intentional: private keys never persist to disk unencrypted.

export let privateKey: CryptoKey | null = null;
export let signingPrivateKey: CryptoKey | null = null;
export let currentUserId: string | null = null;

export function setSessionKeys(
  userId: string,
  encKey: CryptoKey,
  signKey: CryptoKey,
): void {
  currentUserId = userId;
  privateKey = encKey;
  signingPrivateKey = signKey;
}

export function clearSessionKeys(): void {
  currentUserId = null;
  privateKey = null;
  signingPrivateKey = null;
}
