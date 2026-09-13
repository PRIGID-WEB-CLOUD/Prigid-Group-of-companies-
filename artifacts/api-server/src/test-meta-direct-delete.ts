import { db, channelCredentialsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createDecipheriv, createHash } from "crypto";

function encryptionKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || "luxe-boutique-default-secret-key-32b";
  return createHash("sha256").update(secret).digest();
}

function decryptSecret(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, , ivText, tagText, ciphertextText] = value.split(":");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  const ciphertext = Buffer.from(ciphertextText, "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return value;
  }
}

async function getChannelCredentials(channel: string): Promise<Record<string, string>> {
  const [row] = await db.select().from(channelCredentialsTable).where(eq(channelCredentialsTable.channel, channel)).limit(1);
  const stored = (row?.data as Record<string, string>) || {};
  return Object.fromEntries(Object.entries(stored).map(([key, value]) => [key, decryptSecret(value as any)]));
}

async function run() {
  const comm = await getChannelCredentials("commerce");
  const fb = await getChannelCredentials("facebook");
  const mb = await getChannelCredentials("meta_business");
  const catalogId = (comm["catalog_id"] || fb["catalog_id"] || mb["catalog_id"] || "").trim();
  const token = (comm["page_access_token"] || fb["page_access_token"] || mb["page_access_token"] || mb["master_access_token"] || fb["access_token"] || comm["access_token"] || "").trim();

  // 1. Fetch products
  const r1 = await fetch(`https://graph.facebook.com/v21.0/${catalogId}/products?fields=id,name,retailer_id&access_token=${token}`);
  const d1 = (await r1.json()) as any;
  
  if (!d1.data || d1.data.length === 0) return;
  const productToDelete = d1.data[0];
  const graphId = productToDelete.id;
  const retailerId = productToDelete.retailer_id;
  
  console.log(`Trying to delete Graph ID: ${graphId} (Retailer ID: ${retailerId})`);

  // Direct DELETE using Graph ID
  const r2 = await fetch(`https://graph.facebook.com/v21.0/${graphId}?access_token=${token}`, { method: "DELETE" });
  const d2 = await r2.json();
  console.log("Direct DELETE response:", d2);
  
}

run().catch(console.error).finally(() => process.exit(0));
