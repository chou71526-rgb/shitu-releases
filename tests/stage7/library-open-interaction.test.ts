import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("首页图片打开交互", () => {
  it("单击和拖动结束不打开详情，只有双击打开", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("onDoubleClick");
    expect(page).toContain("suppressOpen.current");
    expect(page).not.toContain("else onOpen(image.id)");
  });
});
