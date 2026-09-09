import { describe, expect, it } from "vitest";
import { mondayOf, weekNumber } from "../../src/renderer/pages/JournalPage";
import { journalDecoration } from "../../src/main/services/layout";

describe("阶段 8 周手账日期和装饰", () => {
  it("任意日期都归到周一开始的一周", () => {
    expect(mondayOf(new Date("2026-09-03T12:00:00+08:00")).getDay()).toBe(1);
    expect(weekNumber(new Date("2026-09-03T12:00:00+08:00"))).toBeGreaterThan(1);
  });
  it("装饰不会在重新渲染后变化", () => {
    const decoration = journalDecoration("persistent-image");
    expect(decoration).toEqual(journalDecoration("persistent-image"));
    expect(decoration.rotation).toBe(0);
  });
});
