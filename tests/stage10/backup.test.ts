import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { BackupService } from "../../src/main/services/backup";
import { ImageImporter } from "../../src/main/services/importer";
import { createFixture, png } from "../helpers";
import { AppService } from "../../src/main/services/app-service";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("阶段 10 最近删除和备份", () => {
  it("备份包含数据库和原图并可完整校验", async () => {
    const fixture = await createFixture();
    try {
      await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png(), originalName: "backup.png", source: "picker" });
      const service = new BackupService(fixture.paths, fixture.ctx, fixture.repository); const target = join(fixture.root, "backup.zip");
      const result = await service.create(target); const manifest = await service.validate(target);
      expect(result.imageCount).toBe(1); expect(manifest.imageCount).toBe(1);
      expect(manifest.files.some((file) => file.path.includes("library.sqlite"))).toBe(true);
      expect(manifest.files.some((file) => file.path.includes("images/originals"))).toBe(true);
      expect(manifest.files.some((file) => file.path.includes("gemini.key"))).toBe(false);
    } finally { await fixture.cleanup(); }
  });
  it("损坏备份在覆盖数据前被拒绝", async () => {
    const fixture = await createFixture();
    try {
      const bad = join(fixture.root, "bad.zip"); await writeFile(bad, "not a zip");
      await expect(new BackupService(fixture.paths, fixture.ctx, fixture.repository).validate(bad)).rejects.toThrow();
    } finally { await fixture.cleanup(); }
  });
  it("整库恢复会回到备份时的数据并保留缩略图", async () => {
    const root = await mkdtemp(join(tmpdir(), "image-pet-restore-")); const app = new AppService(root);
    try {
      const first = await app.importer.import({ bytes: await png("#112233"), originalName: "first.png", source: "picker" });
      const backup = join(root, "restore.zip"); await app.backup.create(backup);
      await app.importer.import({ bytes: await png("#334455"), originalName: "second.png", source: "picker" });
      expect(app.listImages()).toHaveLength(2); await app.restoreBackup(backup);
      expect(app.listImages()).toHaveLength(1); expect(app.getImage(first.image.id)?.thumbnailPath).toMatch(/\.webp$/);
    } finally { app.close(); await rm(root, { recursive: true, force: true }); }
  });
});
