import crypto from "node:crypto";

// AES-256-GCM authenticated encryption for platform tokens at rest.
// A leaked ads token is a real financial risk, so tokens are encrypted before
// they touch the database and only decrypted when calling the ad APIs.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length

/** Load the 32-byte key from ENCRYPTION_KEY (accepts 64-char hex or base64). */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");

  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to 32 bytes (use `openssl rand -hex 32`)");
  }
  return key;
}

/** Encrypt a secret. Returns "iv:authTag:ciphertext", each base64. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":",
  );
}

/** Decrypt a value produced by encryptSecret. Throws if tampered/invalid. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
