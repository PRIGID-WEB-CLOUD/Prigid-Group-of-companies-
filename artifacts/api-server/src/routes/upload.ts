import { Router, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { db, mediaItemsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { logger } from "../lib/logger";
import { getCloudinaryConfig, uploadToCloudinary } from "../services/cloudinary";
import { type TenantRequest } from "../middleware/tenantContext";

const router = Router();

// Determine and ensure uploads directory
const rootUploads = path.resolve(process.cwd(), "uploads");
const artifactUploads = path.resolve(process.cwd(), "artifacts/api-server/uploads");
export const uploadsDir = fs.existsSync(path.dirname(artifactUploads)) ? artifactUploads : rootUploads;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage engine for multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const uniqueName = `${cleanName || "img"}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
  ];
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: JPG, PNG, WEBP, GIF, AVIF, SVG.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max
    files: 10,
  },
});

const handleUpload = async (req: TenantRequest, res: Response) => {
  const storeId = req.storeId!;
  try {
    const files: Express.Multer.File[] = [];
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else if (req.files && typeof req.files === "object") {
      Object.values(req.files).forEach((arr) => {
        if (Array.isArray(arr)) files.push(...arr);
      });
    }
    if (req.file) {
      files.push(req.file);
    }

    if (files.length === 0) {
      return res.status(400).json({ error: "No image file provided for upload." });
    }

    const cloudinaryCfg = await getCloudinaryConfig(storeId).catch(() => ({ isConfigured: false }));
    const savedRecords = [];
    const urls: string[] = [];

    for (const file of files) {
      let fileUrl = `/api/uploads/${file.filename}`;
      let publicId: string = randomUUID();
      let format = path.extname(file.filename).replace(".", "") || "jpg";
      let width: number | null = null;
      let height: number | null = null;

      if (cloudinaryCfg.isConfigured) {
        try {
          const cloudRes = await uploadToCloudinary(file.path, storeId);
          fileUrl = cloudRes.url;
          publicId = cloudRes.publicId;
          format = cloudRes.format || format;
          width = cloudRes.width || null;
          height = cloudRes.height || null;

          // Remove temporary file from local disk after successful upload to Cloudinary
          try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          } catch {}
        } catch (cErr: any) {
          logger.warn({ err: cErr }, "Cloudinary upload failed, falling back to local storage");
        }
      }

      const id = randomUUID();
      urls.push(fileUrl);

      const record = {
        id,
        storeId,
        filename: file.originalname || file.filename,
        url: fileUrl,
        mimeType: file.mimetype,
        size: file.size,
        createdAt: new Date(),
      };

      try {
        await db.insert(mediaItemsTable).values(record);
      } catch (dbErr) {
        logger.warn({ err: dbErr }, "Failed to record uploaded media in database");
      }

      savedRecords.push({
        id,
        publicId,
        url: fileUrl,
        secureUrl: fileUrl,
        originalName: file.originalname || file.filename,
        format,
        width,
        height,
        bytes: file.size,
        folder: cloudinaryCfg.isConfigured ? "luxe_boutique_uploads" : "uploads",
        createdAt: record.createdAt.toISOString(),
      });
    }

    return res.json({
      ok: true,
      url: urls[0],
      urls,
      files: savedRecords.map(r => ({
        id: r.id,
        url: r.url,
        filename: r.originalName,
        size: r.bytes,
        mimeType: files.find(f => f.filename.includes(r.id.slice(0, 8)))?.mimetype || "image/jpeg",
      })),
      assets: savedRecords,
    });
  } catch (err: any) {
    logger.error({ err }, "Image upload processing failed");
    return res.status(500).json({ error: err.message || "Failed to process image upload." });
  }
};

// Accept multiple field variations for broad compatibility
const uploadFields = upload.fields([
  { name: "files", maxCount: 10 },
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

router.post("/upload", requireAdmin, uploadFields, handleUpload as any);
router.post("/media/upload", requireAdmin, uploadFields, handleUpload as any);

export default router;
