import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.MIGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "MIGRATION_ENCRYPTION_KEY environment variable is required for credential encryption"
    );
  }
  // Key must be 32 bytes (256 bits) — accept hex-encoded or base64
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length === 32) {
    return buf;
  }
  throw new Error(
    "MIGRATION_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)"
  );
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Prepend IV, append auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Input: base64-encoded string of IV (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
