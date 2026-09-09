import { describe, expect, it } from "vitest";
import { balanceMasonryColumns } from "../../src/shared/masonry-layout";

describe("详情页相关推荐瀑布流分栏", () => {
  it("按图片预计显示高度分配到当前较短列，而不是按固定单双序号分栏", () => {
    const items = [
      { id: "long", width: 200, height: 600 },
      { id: "portrait", width: 200, height: 360 },
      { id: "landscape", width: 400, height: 220 },
      { id: "metal", width: 400, height: 180 },
    ];

    const columns = balanceMasonryColumns(items, 2);
    expect(columns.flat()).toHaveLength(items.length);
    expect(columns[0].map((item) => item.id)).toEqual(["long", "metal"]);
    expect(columns[1].map((item) => item.id)).toEqual(["portrait", "landscape"]);
  });

  it("图片少于列数时不生成无内容的展示列", () => {
    expect(balanceMasonryColumns([{ id: "only", width: 100, height: 100 }], 2)).toHaveLength(1);
  });
});
