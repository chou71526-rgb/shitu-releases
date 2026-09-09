import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createReadStream, createWriteStream } from "node:fs";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Archiver, ArchiverOptions } from "archiver";
import type { BackupResult } from "../../shared/types.js";
import type { DatabaseContext } from "../db/database.js";
import type { Repository } from "../db/repository.js";
import type { AppPaths } from "./paths.js";
import { secureExtractZip } from "./zip.js";

interface Manifest { formatVersion: 1; createdAt: string; imageCount: number; files: Array<{ path: string; size: number; sha256: string }>; }
const require = createRequire(import.meta.url);
const archiver = require("archiver") as (format: string, options?: ArchiverOptions) => Archiver;

async function checksum(path: string): Promise<string> { return createHash("sha256").update(await readFile(path)).digest("hex"); }

async function collect(root: string, relative = ""): Promise<Manifest["files"]> {
  const directory = join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files: Manifest["files"] = [];
  for (const entry of entries) {
    const child = join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await collect(root, child));
    else { const info = await stat(join(root, child)); files.push({ path: child.replaceAll("\\", "/"), size: info.size, sha256: await checksum(join(root, child)) }); }
  }
  return files;
}

export class BackupService {
  constructor(private readonly paths: AppPaths, private readonly ctx: DatabaseContext, private readonly repository: Repository) {}

  async create(targetPath: string): Promise<BackupResult> {
    const staging = join(this.paths.temporary, `backup-${Date.now()}`);
    await mkdir(join(staging, "database"), { recursive: true });
    await mkdir(join(staging, "images"), { recursive: true });
    this.ctx.sqlite.pragma("wal_checkpoint(FULL)");
    await this.ctx.sqlite.backup(join(staging, "database", "library.sqlite"));
    await cp(this.paths.originals, join(staging, "images", "originals"), { recursive: true });
    await cp(this.paths.thumbnails, join(staging, "thumbnails"), { recursive: true });
    const files = await collect(staging);
    const manifest: Manifest = { formatVersion: 1, createdAt: new Date().toISOString(), imageCount: this.repository.listImages({ includeDeleted: true }).length, files };
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));
    const temporaryZip = `${targetPath}.partial`;
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(temporaryZip);
      const archive = archiver("zip", { zlib: { level: 6 } });
      output.on("close", resolve); archive.on("error", reject); archive.pipe(output); archive.directory(staging, false); archive.finalize();
    });
    await rm(targetPath, { force: true });
    await rename(temporaryZip, targetPath);
    await rm(staging, { recursive: true, force: true });
    return { path: targetPath, imageCount: manifest.imageCount };
  }

  async validate(backupPath: string): Promise<Manifest> {
    const staging = join(this.paths.temporary, `validate-${Date.now()}`);
    await mkdir(staging, { recursive: true });
    try {
      await secureExtractZip(backupPath, staging);
      const manifest = JSON.parse(await readFile(join(staging, "manifest.json"), "utf8")) as Manifest;
      if (manifest.formatVersion !== 1) throw new Error("不兼容的备份版本");
      for (const file of manifest.files) {
        const fullPath = join(staging, file.path);
        const info = await stat(fullPath);
        if (info.size !== file.size || await checksum(fullPath) !== file.sha256) throw new Error(`备份文件校验失败：${file.path}`);
      }
      return manifest;
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
}
