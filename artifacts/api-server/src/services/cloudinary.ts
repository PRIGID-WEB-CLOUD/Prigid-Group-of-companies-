import { v2 as cloudinary } from "cloudinary";
import { db, appSettingsTable } from "@workspace/db";
import { decryptCredential, isEncryptedCredential } from "./credentialVault";
import { eq, and } from "drizzle-orm";

export async function getCloudinaryConfig(storeId: string) {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.storeId, storeId));
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || settings.cloudinary_cloud_name || "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || settings.cloudinary_api_key || "").trim();
  let rawSecret = (process.env.CLOUDINARY_API_SECRET || settings.cloudinary_api_secret || "").trim();

  if (rawSecret && isEncryptedCredential(rawSecret)) {
    try {
      rawSecret = decryptCredential(rawSecret).trim();
    } catch {
      // ignore
    }
  }

  const isConfigured = Boolean(
    cloudName &&
    apiKey &&
    rawSecret &&
    cloudName !== "undefined" &&
    apiKey !== "undefined" &&
    rawSecret !== "undefined"
  );
  return { cloudName, apiKey, apiSecret: rawSecret, isConfigured };
}

export async function testCloudinaryConnection(storeId: string) {
  const config = await getCloudinaryConfig(storeId);
  if (!config.isConfigured) {
    throw new Error("Cloudinary credentials (cloud_name, api_key, api_secret) are not fully configured.");
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const res = await cloudinary.api.ping();
  return { ok: true, cloudName: config.cloudName, ping: res };
}

export async function uploadToCloudinary(filePath: string, storeId: string, folder = "luxe_boutique_uploads") {
  const config = await getCloudinaryConfig(storeId);
  if (!config.isConfigured) {
    throw new Error("Cloudinary credentials not configured.");
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const uploadRes = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "auto",
  });

  return {
    url: uploadRes.secure_url || uploadRes.url,
    publicId: uploadRes.public_id,
    format: uploadRes.format,
    width: uploadRes.width,
    height: uploadRes.height,
    bytes: uploadRes.bytes,
  };
}
