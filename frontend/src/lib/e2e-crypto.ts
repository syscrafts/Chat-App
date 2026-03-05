/**
 * E2E Encryption using Web Crypto API
 *
 * Algorithm:
 *  - Key exchange  : ECDH  (P-256 curve)
 *  - Message cipher: AES-GCM 256-bit (key derived via ECDH + HKDF)
 *
 * Flow:
 *  1. On first load, generate an ECDH key pair and persist it in localStorage.
 *  2. Upload the public key (JWK) to the server so recipients can fetch it.
 *  3. To encrypt for user B:
 *       a. Fetch B's public key from the server.
 *       b. ECDH(ourPriv, theirPub) → HKDF → AES-GCM-256 shared key.
 *       c. Encrypt with AES-GCM + random 12-byte IV.
 *       d. Transmit { iv, ciphertext } as a JSON string.
 *  4. To decrypt an incoming message:
 *       a. ECDH(ourPriv, senderPub) → same shared key.
 *       b. AES-GCM decrypt with stored IV.
 *
 * Key version: bump CURRENT_KEY_VERSION to force all clients to regenerate
 * their key pairs (e.g. after a crypto algorithm change).
 */

const PRIVATE_KEY_STORAGE = "e2e_private_key";
const PUBLIC_KEY_STORAGE  = "e2e_public_key";
const KEY_VERSION_STORAGE = "e2e_key_version";
const CURRENT_KEY_VERSION = "3"; // bumped to force regeneration with correct usages

//  Helpers 

function ab2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642ab(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function clearStoredKeys() {
  localStorage.removeItem(PRIVATE_KEY_STORAGE);
  localStorage.removeItem(PUBLIC_KEY_STORAGE);
  localStorage.removeItem(KEY_VERSION_STORAGE);
}

// Key generation & persistence 

export async function generateOrLoadKeyPair(): Promise<CryptoKeyPair> {
  // Force regeneration if key version is outdated
  const storedVersion = localStorage.getItem(KEY_VERSION_STORAGE);
  if (storedVersion !== CURRENT_KEY_VERSION) {
    clearStoredKeys();
  }

  const storedPriv = localStorage.getItem(PRIVATE_KEY_STORAGE);
  const storedPub  = localStorage.getItem(PUBLIC_KEY_STORAGE);

  if (storedPriv && storedPub) {
    try {
      // Private key MUST have both "deriveKey" and "deriveBits"
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        JSON.parse(storedPriv),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );

      // Public key has no key usages (correct for ECDH public keys)
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        JSON.parse(storedPub),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
      );

      return { privateKey, publicKey };
    } catch (err) {
      console.warn("[E2E] Failed to import stored keys, regenerating:", err);
      clearStoredKeys();
    }
  }

  // Generate fresh ECDH P-256 key pair with correct usages
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable so we can export and persist in localStorage
    ["deriveKey", "deriveBits"]
  );

  // Persist as JWK
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pubJwk  = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  localStorage.setItem(PRIVATE_KEY_STORAGE, JSON.stringify(privJwk));
  localStorage.setItem(PUBLIC_KEY_STORAGE,  JSON.stringify(pubJwk));
  localStorage.setItem(KEY_VERSION_STORAGE, CURRENT_KEY_VERSION);

  return keyPair;
}

/** Export our public key as a JWK string for uploading to the server */
export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return JSON.stringify(jwk);
}

/** Import another user's public key from the JWK string fetched from the server */
export async function importRemotePublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [] // public keys have no usages in ECDH — private key drives the operation
  );
}

// Shared key derivation 

/**
 * Derive a 256-bit AES-GCM key via ECDH + HKDF.
 *
 * Both sides (sender and recipient) independently run:
 *   ECDH(myPriv, theirPub) → same raw secret → HKDF → same AES key
 *
 * This works because ECDH is commutative:
 *   ECDH(Alice.priv, Bob.pub) === ECDH(Bob.priv, Alice.pub)
 */
async function deriveSharedKey(
  ourPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  // Use deriveKey directly (avoids the deriveBits usage requirement issue)
  // This derives an AES-GCM key straight from the ECDH shared secret via HKDF
  const ecdhRaw = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPublicKey },
    ourPrivateKey,
    256
  );

  // Import raw ECDH bits as HKDF source material
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    ecdhRaw,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  // HKDF → AES-GCM-256
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("chat-app-e2e-v3-salt"),
      info: new TextEncoder().encode("chat-app-e2e-v3-info"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt / Decrypt 

export type EncryptedPayload = {
  iv: string;         // base64-encoded 12-byte random IV
  ciphertext: string; // base64-encoded AES-GCM ciphertext
};

/**
 * Encrypt a plaintext string.
 * Returns { iv, ciphertext } — both base64-encoded — to be stored as JSON.
 */
export async function encryptMessage(
  plaintext: string,
  ourPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<EncryptedPayload> {
  const sharedKey = await deriveSharedKey(ourPrivateKey, theirPublicKey);

  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded
  );

  return {
    iv: ab2b64(iv.buffer),
    ciphertext: ab2b64(cipherBuffer),
  };
}

/**
 * Decrypt an encrypted payload.
 * Re-derives the same shared key from our private key + sender's public key.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  ourPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<string> {
  const sharedKey = await deriveSharedKey(ourPrivateKey, theirPublicKey);

  const iv         = new Uint8Array(b642ab(payload.iv));
  const ciphertext = b642ab(payload.ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    ciphertext
  );

  return new TextDecoder().decode(plainBuffer);
}

// Payload detection helpers 

/**
 * Returns true if a message body is an E2E-encrypted JSON payload
 * ({ iv: string, ciphertext: string })
 */
export function isEncryptedPayload(body: string | null): body is string {
  if (!body) return false;
  try {
    const parsed = JSON.parse(body);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.iv === "string" &&
      typeof parsed.ciphertext === "string"
    );
  } catch {
    return false;
  }
}

export function parseEncryptedPayload(body: string): EncryptedPayload {
  return JSON.parse(body) as EncryptedPayload;
}
