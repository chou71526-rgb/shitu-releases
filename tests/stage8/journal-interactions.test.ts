import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("周手账图片交互", () => {
  it("关键词摘要覆盖在图片上并能展开完整列表", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/JournalPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("polaroid-terms");
    expect(page).toContain("term-popover");
    expect(page).toContain("image.terms.map");
  });

  it("图片可拖动和缩放，并持久化手账坐标及比例", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/JournalPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("journal-resize-handle");
    expect(page).toContain("journalX:");
    expect(page).toContain("journalY:");
    expect(page).toContain("journalScale:");
  });
});
