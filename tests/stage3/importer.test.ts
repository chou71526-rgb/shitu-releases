import { describe, expect, it } from "vitest";
import { ImageImporter } from "../../src/main/services/importer";
import { createFixture, png } from "../helpers";

describe("阶段 3 统一图片导入", () => {
  it("复制图片、生成缩略图并检测重复", async () => {
    const fixture = await createFixture();
    try {
      const importer = new ImageImporter(fixture.repository, fixture.paths); const bytes = await png();
      const first = await importer.import({ bytes, originalName: "测试.png", source: "clipboard" });
      const duplicate = await importer.import({ bytes, originalName: "同一张.png", source: "clipboard" });
      expect(first.duplicate).toBe(false); expect(duplicate.duplicate).toBe(true);
      expect(fixture.repository.listImages()).toHaveLength(1);
      expect(first.image.thumbnailPath).toMatch(/\.webp$/);
    } finally { await fixture.cleanup(); }
  });
  it("拒绝非图片数据且不留下记录", async () => {
    const fixture = await createFixture();
    try {
      const importer = new ImageImporter(fixture.repository, fixture.paths);
      await expect(importer.import({ bytes: new Uint8Array([1,2,3]), originalName: "坏文件.png", source: "clipboard" })).rejects.toThrow();
      expect(fixture.repository.listImages()).toHaveLength(0);
    } finally { await fixture.cleanup(); }
  });
});
