import { describe, expect, it } from "vitest";
import { ImageImporter } from "../../src/main/services/importer";
import { createFixture, png } from "../helpers";

describe("阶段 5 设置和分类管理", () => {
  it("删除分类前把图片迁移到目标分类", async () => {
    const fixture = await createFixture();
    try {
      const custom = fixture.repository.createCategory("实验", "#123456"); const target = fixture.repository.listCategories().find((item) => item.name === "其他")!;
      const imported = await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png(), originalName: "category.png", source: "picker" });
      fixture.repository.updateImage(imported.image.id, { categoryId: custom.id }); fixture.repository.deleteCategory(custom.id, target.id);
      expect(fixture.repository.getImage(imported.image.id)?.categoryName).toBe("其他");
      expect(fixture.repository.listCategories().some((item) => item.id === custom.id)).toBe(false);
    } finally { await fixture.cleanup(); }
  });
});
