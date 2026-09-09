import { describe, expect, it } from "vitest";
import { clampJournalScale, journalCardPosition, journalDayHeight } from "../../src/shared/journal-layout";
import { journalDecorationColor } from "../../src/shared/spatial-layout";

describe("周手账图片编排", () => {
  it("默认两列保留安全间距，不会互相重叠", () => {
    const cards = Array.from({ length: 6 }, (_, index) => journalCardPosition(index, `image-${index}`));
    for (let index = 0; index < cards.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < cards.length; otherIndex += 1) {
        const a = cards[index];
        const b = cards[otherIndex];
        const sameColumn = a.column === b.column;
        const overlaps = sameColumn && Math.abs(a.top - b.top) < 220;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("每张图片的错位、宽度和小角度由图片稳定决定", () => {
    const first = journalCardPosition(0, "stable-image");
    expect(first).toEqual(journalCardPosition(0, "stable-image"));

    const cards = Array.from({ length: 12 }, (_, index) => journalCardPosition(index, `image-${index}`));
    expect(new Set(cards.map((card) => card.offsetX)).size).toBeGreaterThan(3);
    expect(new Set(cards.map((card) => card.widthPercent)).size).toBeGreaterThan(4);
    expect(Math.min(...cards.map((card) => card.widthPercent))).toBeLessThanOrEqual(39);
    expect(Math.max(...cards.map((card) => card.widthPercent))).toBeGreaterThanOrEqual(45);
    expect(new Set(cards.map((card) => card.rotation)).size).toBeGreaterThan(4);
    expect(cards.every((card) => Math.abs(card.rotation) <= 2.4)).toBe(true);
    expect(cards.every((card) => card.widthPercent >= 38 && card.widthPercent <= 46)).toBe(true);
  });

  it("同列图片比上一版更紧凑，但仍保留可读间距", () => {
    const first = journalCardPosition(0, "compact-layout");
    const next = journalCardPosition(2, "compact-layout");
    expect(next.top - first.top).toBeGreaterThanOrEqual(226);
    expect(next.top - first.top).toBeLessThanOrEqual(246);
    expect(journalDayHeight(6)).toBeLessThan(800);
  });

  it("图片增加后日期格会随行数增高，而不是继续堆叠", () => {
    expect(journalDayHeight(4)).toBeLessThan(journalDayHeight(10));
    expect(journalDayHeight(10)).toBeGreaterThanOrEqual(1_000);
  });

  it("用户缩放限制在可操作范围内", () => {
    expect(clampJournalScale(0.1)).toBe(0.55);
    expect(clampJournalScale(3)).toBe(2.25);
    expect(clampJournalScale(1.4)).toBe(1.4);
  });

  it("图钉、胶带和贴纸使用稳定且丰富的颜色", () => {
    expect(journalDecorationColor("same-image")).toBe(journalDecorationColor("same-image"));
    const colors = new Set(Array.from({ length: 40 }, (_, index) => journalDecorationColor(`image-${index}`)));
    expect(colors.size).toBeGreaterThanOrEqual(6);
  });
});
