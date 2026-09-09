import { describe, expect, it } from "vitest";
import { journalDecoration, seededPoint, visibleInViewport } from "../../src/main/services/layout";
import { transitionPet } from "../../src/main/services/pet-state";

describe("阶段 0 高风险能力的纯逻辑基础", () => {
  it("千图散布坐标具有确定性且不是全部重叠", () => {
    const points = Array.from({ length: 1000 }, (_, index) => seededPoint(`image-${index}`, index));
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBeGreaterThan(990);
    expect(seededPoint("same", 3)).toEqual(seededPoint("same", 3));
  });
  it("只判断当前视野和缓冲区内的图片", () => {
    expect(visibleInViewport({ x: 50, y: 50, width: 100, height: 100 }, { x: 0, y: 0, width: 500, height: 500 }, 0)).toBe(true);
    expect(visibleInViewport({ x: 900, y: 900, width: 100, height: 100 }, { x: 0, y: 0, width: 500, height: 500 }, 0)).toBe(false);
  });
  it("桌宠只有本地保存成功后才能进入 saved", () => {
    expect(transitionPet("drag-valid", "DROP")).toBe("ingesting");
    expect(transitionPet("ingesting", "AI_DONE")).toBe("ingesting");
    expect(transitionPet("ingesting", "LOCAL_SAVED")).toBe("saved");
  });
  it("手账装饰参数重启后可由同一 seed 复现", () => expect(journalDecoration("abc")).toEqual(journalDecoration("abc")));
});
