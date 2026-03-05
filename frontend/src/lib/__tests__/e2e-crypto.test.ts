import { describe, it, expect, beforeAll } from "vitest";
import {
  generateOrLoadKeyPair,
  encryptMessage,
  decryptMessage,
  isEncryptedPayload,
  parseEncryptedPayload,
  importRemotePublicKey,
  exportPublicKeyJwk,
} from "../e2e-crypto";

// Generate real key pairs for Alice and Bob once
let aliceKeys: CryptoKeyPair;
let bobKeys: CryptoKeyPair;

beforeAll(async () => {
  // Clear localStorage so generateOrLoadKeyPair always generates fresh keys
  localStorage.clear();
  aliceKeys = await generateOrLoadKeyPair();

  localStorage.clear();
  bobKeys = await generateOrLoadKeyPair();
});

describe("generateOrLoadKeyPair", () => {
  it("generates a valid ECDH key pair", async () => {
    expect(aliceKeys.privateKey).toBeDefined();
    expect(aliceKeys.publicKey).toBeDefined();
    expect(aliceKeys.privateKey.type).toBe("private");
    expect(aliceKeys.publicKey.type).toBe("public");
  });

  it("loads the same key pair from localStorage on second call", async () => {
    // Don't clear localStorage this time
    localStorage.setItem("e2e_key_version", "3");
    const jwk = await exportPublicKeyJwk(aliceKeys.publicKey);
    localStorage.setItem("e2e_public_key", jwk);

    const reloaded = await generateOrLoadKeyPair();
    const reloadedJwk = await exportPublicKeyJwk(reloaded.publicKey);

    expect(reloadedJwk).toBe(jwk);
  });
});

describe("encryptMessage / decryptMessage", () => {
  it("Alice can encrypt a message that Bob can decrypt", async () => {
    const plaintext = "Hello Bob, this is secret!";

    const encrypted = await encryptMessage(
      plaintext,
      aliceKeys.privateKey,
      bobKeys.publicKey
    );

    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.ciphertext).not.toContain(plaintext);

    const decrypted = await decryptMessage(
      encrypted,
      bobKeys.privateKey,
      aliceKeys.publicKey
    );

    expect(decrypted).toBe(plaintext);
  });

  it("Bob can encrypt a message that Alice can decrypt", async () => {
    const plaintext = "Hello Alice, replying securely!";

    const encrypted = await encryptMessage(
      plaintext,
      bobKeys.privateKey,
      aliceKeys.publicKey
    );

    const decrypted = await decryptMessage(
      encrypted,
      aliceKeys.privateKey,
      bobKeys.publicKey
    );

    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const plaintext = "Same message";

    const enc1 = await encryptMessage(plaintext, aliceKeys.privateKey, bobKeys.publicKey);
    const enc2 = await encryptMessage(plaintext, aliceKeys.privateKey, bobKeys.publicKey);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it("fails to decrypt with wrong key pair", async () => {
    localStorage.clear();
    const eveKeys = await generateOrLoadKeyPair();

    const encrypted = await encryptMessage(
      "Secret",
      aliceKeys.privateKey,
      bobKeys.publicKey
    );

    // Eve tries to decrypt using her own private key — should fail
    await expect(
      decryptMessage(encrypted, eveKeys.privateKey, aliceKeys.publicKey)
    ).rejects.toThrow();
  });

  it("handles unicode and special characters", async () => {
    const plaintext = "नमस्ते 🔒 <script>alert('xss')</script>";

    const encrypted = await encryptMessage(plaintext, aliceKeys.privateKey, bobKeys.publicKey);
    const decrypted = await decryptMessage(encrypted, bobKeys.privateKey, aliceKeys.publicKey);

    expect(decrypted).toBe(plaintext);
  });

  it("handles long messages", async () => {
    const plaintext = "A".repeat(10000);

    const encrypted = await encryptMessage(plaintext, aliceKeys.privateKey, bobKeys.publicKey);
    const decrypted = await decryptMessage(encrypted, bobKeys.privateKey, aliceKeys.publicKey);

    expect(decrypted).toBe(plaintext);
  });
});

describe("isEncryptedPayload", () => {
  it("returns true for valid encrypted payload", () => {
    const payload = JSON.stringify({ iv: "abc==", ciphertext: "xyz==" });
    expect(isEncryptedPayload(payload)).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isEncryptedPayload("Hello world")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEncryptedPayload(null)).toBe(false);
  });

  it("returns false for JSON without required fields", () => {
    expect(isEncryptedPayload(JSON.stringify({ foo: "bar" }))).toBe(false);
  });

  it("returns false for JSON with wrong types", () => {
    expect(isEncryptedPayload(JSON.stringify({ iv: 123, ciphertext: true }))).toBe(false);
  });
});

describe("importRemotePublicKey", () => {
  it("imports a valid JWK public key", async () => {
    const jwkString = await exportPublicKeyJwk(aliceKeys.publicKey);
    const imported = await importRemotePublicKey(jwkString);

    expect(imported.type).toBe("public");
    expect(imported.algorithm).toMatchObject({ name: "ECDH" });
  });

  it("throws on invalid JWK string", async () => {
    await expect(importRemotePublicKey("not-valid-json")).rejects.toThrow();
  });
});
