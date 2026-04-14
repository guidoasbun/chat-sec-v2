// IndexedDB helpers for persisting encrypted RSA key material across page loads.
// The private keys are stored ALREADY ENCRYPTED (via crypto.ts) — this file
// only handles the storage layer, not the cryptography.

const DB_NAME = "chatsec-keys";
const DB_VERSION = 1;
const STORE_NAME = "keys";

export interface StoredKeyData {
  userId: string;
  encryptedPrivateKey: string; // base64 — RSA-OAEP private key, locked with PBKDF2
  privateKeyIv: string; // base64 IV used to encrypt the private key
  salt: string; // base64 PBKDF2 salt — stored alongside the key, not secret
  encryptedSigningKey: string; // base64 — RSA-PSS signing private key, locked with PBKDF2
  signingKeyIv: string; // base64 IV used to encrypt the signing key
}

// Opens the IndexedDB database, creating it (and the object store) on first run.
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // userId is the primary key — one record per user per browser
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Saves (or overwrites) the encrypted key material for a user.
export async function saveKeys(data: StoredKeyData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Loads the stored key material for a user. Returns null if not found.
export async function loadKeys(userId: string): Promise<StoredKeyData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(userId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

// Deletes the key record for a user (call on logout).
export async function clearKeys(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
