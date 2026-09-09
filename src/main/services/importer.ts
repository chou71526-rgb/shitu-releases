import { createHash, randomUUID } from "node:crypto";
import { copyFile, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp, { type Metadata } from "sharp";
import type { ImportRequest, ImportResult } from "../../shared/types.js";
import type { Repository } from "../db/repository.js";
import type { AppPaths } from "./paths.js";
import { journalDecoration, seededPoint } from "./layout.js";

const FORMAT_TO_MIME: Record<string, string> = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp", bmp: "image/bmp" };

export class ImportError extends Error {
  constructor(message: string, public readonly code: "UNSUPPORTED" | "CORRUPT" | "DUPLICATE" | "WRITE_FAILED") { super(message); }
}

export class ImageImporter {
  constructor(private readonly repository: Repository, private readonly paths: AppPaths) {}

  async import(request: ImportRequest): Promise<ImportResult> {
    const id = randomUUID();
    const tempPath = join(this.paths.temporary, `${id}.import`);
    try {
      if (request.filePath) await copyFile(request.filePath, tempPath);
      else if (request.bytes) await writeFile(tempPath, request.bytes);
      else throw new ImportError("没有可读取的图片数据", "CORRUPT");

      const bytes = await readFile(tempPath);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const duplicate = this.repository.findByHash(hash);
      if (duplicate) return { image: duplicate, duplicate: true };

      let metadata: Metadata;
      try { metadata = await sharp(bytes).metadata(); } catch { throw new ImportError("图片文件已损坏或无法读取", "CORRUPT"); }
      const format = metadata.format?.toLowerCase() ?? "";
      if (!FORMAT_TO_MIME[format]) throw new ImportError("第一版仅支持 JPEG、PNG、WebP 和 BMP", "UNSUPPORTED");
      if (!metadata.width || !metadata.height) throw new ImportError("无法读取图片尺寸", "CORRUPT");

      const extension = format === "jpeg" ? ".jpg" : `.${format}`;
      const originalRelative = join("images", "originals", `${id}${extension}`);
      const thumbRelative = join("thumbnails", `${id}.webp`);
      const originalTarget = join(this.paths.root, originalRelative);
      const thumbTarget = join(this.paths.root, thumbRelative);
      await rename(tempPath, originalTarget);
      await sharp(bytes).rotate().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(thumbTarget);
      const pixel = await sharp(bytes).resize(1, 1).removeAlpha().raw().toBuffer();
      const dominantColor = `#${[...pixel].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
      const brightness = (pixel[0] * 299 + pixel[1] * 587 + pixel[2] * 114) / 255000;
      const point = seededPoint(hash, this.repository.listImages().length);
      const decoration = journalDecoration(hash);
      const now = new Date().toISOString();
      const size = (await stat(originalTarget)).size;
      const row = this.repository.insertImage({
        id, originalName: request.originalName, originalPath: originalRelative, thumbnailPath: thumbRelative,
        mimeType: FORMAT_TO_MIME[format], width: metadata.width, height: metadata.height, size, hash, source: request.source,
        importedAt: now, journalDate: now.slice(0, 10), categoryId: null, favorite: false, note: "", aiStatus: "pending",
        canvasX: point.x, canvasY: point.y, canvasWidth: Math.max(120, Math.min(280, 140 + ((metadata.width / metadata.height) * 70))), canvasManual: false,
        journalX: decoration.x, journalY: decoration.y, journalScale: 1, journalRotation: decoration.rotation, journalDecoration: decoration.decoration,
        dominantColor, brightness,
      });
      return { image: row, duplicate: false };
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
