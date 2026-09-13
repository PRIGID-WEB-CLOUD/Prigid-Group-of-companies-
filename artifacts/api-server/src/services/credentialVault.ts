import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET || "luxe_boutique_master_vault_key_2026_default_fallback_secret";
  return createHash("sha256").update(secret).digest();
}

export function isEncryptedCredential(value: string) {
  return value.startsWith(PREFIX);
}

export function encryptCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptCredential(value: string) {
  if (!isEncryptedCredential(value)) return value;
  const [, , ivText, tagText, ciphertextText] = value.split(":");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted credential.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt credential. Verify CREDENTIAL_ENCRYPTION_KEY.");
  }
}