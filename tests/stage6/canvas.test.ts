import { describe, expect, it } from "vitest";
import { seededPoint, visibleInViewport } from "../../src/main/services/layout";

describe("阶段 6 开放式画布性能基础", () => {
  it("1000 张图时只选取当前视野附近内容", () => {
    const items = Array.from({ length: 1000 }, (_, index) => ({ ...seededPoint(`seed-${index}`, index), width: 180, height: 140 }));
    const visible = items.filter((item) => visibleInViewport(item, { x: -500, y: -400, width: 1000, height: 800 }, 200));
    expect(visible.length).toBeGreaterThan(0); expect(visible.length).toBeLessThan(items.length);
  });
  it("布局对同一输入保持稳定", () => expect(seededPoint("image", 42)).toEqual(seededPoint("image", 42)));
  it("新导入的前 20 张图不会堆在同一位置", () => {
    const points = Array.from({ length: 20 }, (_, index) => seededPoint(`seed-${index}`, index));
    const distances = points.flatMap((point, index) => points.slice(index + 1).map((other) => Math.hypot(point.x - other.x, point.y - other.y)));
    expect(Math.min(...distances)).toBeGreaterThan(120);
  });
  it("默认图片云横向展开，接近视频中的宽幅空间墙", () => {
    const points = Array.from({ length: 30 }, (_, index) => seededPoint(`wide-${index}`, index));
    const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const height = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    expect(width / height).toBeGreaterThan(1.7);
  });
  it("自动排列沿横向持续展开，相邻卡片保留可辨认间距", () => {
    const points = Array.from({ length: 12 }, (_, index) => seededPoint(`wall-${index}`, index));
    const sortedX = points.map((point) => point.x).sort((a, b) => a - b);
    const horizontalGaps = sortedX.slice(1).map((x, index) => x - sortedX[index]);
    expect(Math.min(...horizontalGaps)).toBeGreaterThanOrEqual(320);
  });
});
