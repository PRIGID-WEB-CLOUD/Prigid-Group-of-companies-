import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import { uploadsDir } from "../routes/upload";
import { db, mediaItemsTable } from "@workspace/db";

export interface PreparedInstagramImage {
  publicUrl: string;
  localPath: string;
  filename: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  size: number;
  originalFormat: string;
  adjustedAspectRatio: boolean;
}

/**
 * Resolves an absolute, publicly accessible HTTPS URL for media assets so
 * Meta's Instagram Graph API crawlers can reliably download the file.
 */
export function resolveInstagramPublicUrl(req: any, relativeOrAbsoluteUrl: string): string {
  const cleanPath = relativeOrAbsoluteUrl.startsWith("/") ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
  const envPublicUrl = (process.env["PUBLIC_APP_URL"] || process.env["APP_URL"] || "").trim().replace(/\/$/, "");

  // If already an absolute URL
  if (relativeOrAbsoluteUrl.startsWith("http://") || relativeOrAbsoluteUrl.startsWith("https://")) {
    // If it points to localhost or internal loopback, swap with public base URL
    if (envPublicUrl && (relativeOrAbsoluteUrl.includes("localhost") || relativeOrAbsoluteUrl.includes("127.0.0.1"))) {
      try {
        const parsed = new URL(relativeOrAbsoluteUrl);
        return `${envPublicUrl}${parsed.pathname}${parsed.search}`;
      } catch {}
    }
    return relativeOrAbsoluteUrl;
  }

  // Determine host from headers
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const headerHost = (typeof forwardedHost === "string" ? forwardedHost.split(",")[0].trim() : "") || req?.get?.("host") || "";

  const isLocalHost = headerHost.includes("localhost") || headerHost.includes("127.0.0.1") || !headerHost;

  if (!isLocalHost) {
    const proto = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : (req?.protocol || "https");
    return `${proto}://${headerHost}${cleanPath}`;
  }

  if (envPublicUrl) {
    return `${envPublicUrl}${cleanPath}`;
  }

  return `https://${headerHost || "localhost:3000"}${cleanPath}`;
}

/**
 * Validates, converts, and normalizes any image (PNG, WEBP, HEIC, GIF, AVIF, JPEG, etc.)
 * into a 100% compliant Instagram Graph API JPEG:
 *  - Format: Baseline JPEG (image/jpeg)
 *  - Color space: sRGB (removes CMYK / AdobeRGB issues)
 *  - Transparency: Flattened onto clean pure white (#ffffff)
 *  - Aspect ratio: Constrained to Instagram's strict range of 4:5 (0.80) to 1.91:1 (1.91)
 *  - Dimensions: Scaled to standard feed size (max 1440px wide, min 320px)
 */
export async function prepareInstagramImage(params: {
  file?: Express.Multer.File;
  imageUrl?: string;
  req: any;
}): Promise<PreparedInstagramImage> {
  const { file, imageUrl, req } = params;

  let inputBuffer: Buffer;
  let tempFilePathToCleanup: string | null = null;

  if (file) {
    tempFilePathToCleanup = file.path;
    inputBuffer = await fs.promises.readFile(file.path);
  } else if (imageUrl) {
    const trimmedUrl = imageUrl.trim();

    // Check if it's a local upload
    const uploadMatch = trimmedUrl.match(/\/api\/uploads\/([^/?#]+)/);
    if (uploadMatch && uploadMatch[1]) {
      const localFile = path.join(uploadsDir, uploadMatch[1]);
      if (fs.existsSync(localFile)) {
        inputBuffer = await fs.promises.readFile(localFile);
      } else {
        inputBuffer = await downloadRemoteImage(trimmedUrl);
      }
    } else {
      inputBuffer = await downloadRemoteImage(trimmedUrl);
    }
  } else {
    throw new Error("No image file or URL provided for Instagram post.");
  }

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error("Empty image data received.");
  }

  // Process through sharp pipeline
  let pipeline = sharp(inputBuffer, { failOn: "none" });

  // Auto-rotate according to EXIF orientation
  pipeline = pipeline.rotate();

  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions. Please provide a valid image file.");
  }

  const originalFormat = metadata.format || "unknown";

  // Flatten transparency onto white background
  // Instagram does not support alpha channels; transparent PNGs produce black borders or format errors
  if (metadata.hasAlpha) {
    pipeline = pipeline.flatten({ background: "#ffffff" });
  }

  let currentWidth = metadata.width;
  let currentHeight = metadata.height;
  let ratio = currentWidth / currentHeight;
  let adjustedAspectRatio = false;

  // Instagram Content Publishing strictly requires aspect ratio between 4:5 (0.80) and 1.91:1 (1.91)
  const MIN_RATIO = 0.80; // 4:5 portrait
  const MAX_RATIO = 1.91; // 1.91:1 landscape

  if (ratio < MIN_RATIO) {
    // Too tall (e.g. 9:16 vertical stories). Pad width to 4:5 with clean white margins.
    const targetWidth = Math.ceil(currentHeight * MIN_RATIO);
    pipeline = pipeline.resize({
      width: targetWidth,
      height: currentHeight,
      fit: "contain",
      background: "#ffffff",
    });
    currentWidth = targetWidth;
    adjustedAspectRatio = true;
  } else if (ratio > MAX_RATIO) {
    // Too wide (e.g. panoramic). Pad height to 1.91:1 with clean white margins.
    const targetHeight = Math.ceil(currentWidth / MAX_RATIO);
    pipeline = pipeline.resize({
      width: currentWidth,
      height: targetHeight,
      fit: "contain",
      background: "#ffffff",
    });
    currentHeight = targetHeight;
    adjustedAspectRatio = true;
  }

  // Scale to optimal dimensions if excessively large or too small
  if (currentWidth > 1440) {
    pipeline = pipeline.resize({
      width: 1080,
      fit: "inside",
      withoutEnlargement: true,
    });
  } else if (currentWidth < 320) {
    pipeline = pipeline.resize({
      width: 320,
      fit: "inside",
    });
  }

  // Output as standard baseline sRGB JPEG (chroma subsampling 4:2:0)
  const finalJpegBuffer = await pipeline
    .toColorspace("srgb")
    .jpeg({
      quality: 92,
      progressive: false, // Baseline JPEG ensures 100% compatibility with Meta's decoders
      chromaSubsampling: "4:2:0",
      force: true,
    })
    .toBuffer();

  const finalMeta = await sharp(finalJpegBuffer).metadata();

  // Save to uploads directory
  const outFilename = `ig_optimized_${Date.now()}_${randomUUID().slice(0, 8)}.jpg`;
  const outPath = path.join(uploadsDir, outFilename);
  await fs.promises.writeFile(outPath, finalJpegBuffer);

  // Clean up temporary upload if separate
  if (tempFilePathToCleanup && tempFilePathToCleanup !== outPath) {
    fs.promises.unlink(tempFilePathToCleanup).catch(() => {});
  }

  // Record in database
  const fileUrl = `/api/uploads/${outFilename}`;
  try {
    await db.insert(mediaItemsTable).values({
      id: randomUUID(),
      filename: outFilename,
      url: fileUrl,
      mimeType: "image/jpeg",
      size: finalJpegBuffer.length,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err }, "Could not record optimized Instagram media item in DB");
  }

  const publicUrl = resolveInstagramPublicUrl(req, fileUrl);

  logger.info(
    {
      originalFormat,
      outFilename,
      width: finalMeta.width,
      height: finalMeta.height,
      size: finalJpegBuffer.length,
      adjustedAspectRatio,
      publicUrl,
    },
    "Instagram image successfully normalized and saved as JPEG",
  );

  return {
    publicUrl,
    localPath: outPath,
    filename: outFilename,
    mimeType: "image/jpeg",
    width: finalMeta.width || currentWidth,
    height: finalMeta.height || currentHeight,
    size: finalJpegBuffer.length,
    originalFormat,
    adjustedAspectRatio,
  };
}

async function downloadRemoteImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LuxeBoutique-InstagramSync/1.0",
        "Accept": "image/jpeg,image/png,image/webp,image/avif,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Failed to download image from URL (${res.status} ${res.statusText})`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timeoutId);
  }
}
