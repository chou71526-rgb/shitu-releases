import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("图片删除交互", () => {
  it("详情页删除后刷新图库并返回首页", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    const app = await readFile(new URL("../../src/renderer/App.tsx", import.meta.url), "utf8");
    expect(detail).toContain("await onDeleted()");
    expect(app).toContain('await refresh(); navigate("library")');
  });

  it("首页每张图提供直接删除按钮", async () => {
    const library = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(library).toContain('title="删除"');
    expect(library).toContain("await onTrash(image.id)");
    expect(library).toContain("window.appApi.trashImage(id)");
    expect(library).toContain("window.appApi.restoreImage(id)");
  });
});
