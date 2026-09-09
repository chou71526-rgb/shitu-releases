import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Pinterest 式图片详情", () => {
  it("详情页提供本地图库搜索和可点击结果", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    expect(detail).toContain("detail-search-shell");
    expect(detail).toContain("searchResults");
    expect(detail).toContain("搜索本地图片、分类或设计术语");
    expect(detail).toContain("onOpen(item.id)");
  });

  it("主图下方继续显示相关图片流", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    expect(detail).toContain("detail-related-feed");
    expect(detail).toContain("detail-masonry");
    expect(detail).toContain('aria-label="更多相关灵感"');
    expect(detail).not.toContain("<h2>更多相关灵感</h2>");
    expect(detail).not.toContain("<h2>相关灵感</h2>");
  });

  it("相关灵感单击不跳转，只有双击才进入另一张图片", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    expect(detail).toContain('className="related-card" onDoubleClick={() => onOpen(item.id)}');
    expect(detail).not.toContain('className="related-card" onClick={() => onOpen(item.id)}');
    expect(detail).toContain('title="双击查看详情"');
  });

  it("右侧相关图片使用两条独立纵列紧密排列，不被相邻高图撑出空白", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(detail).toContain("railColumns");
    expect(detail).toContain('className="rail-column"');
    expect(css).toMatch(/\.rail-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
    expect(css).toMatch(/\.rail-column\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
    expect(css).toMatch(/\.rail-column\s+\.related-card\s*\{[^}]*margin-bottom:\s*0/s);
  });

  it("详情主卡片使用固定浏览高度，超长主图可在图片区域内上下滚动", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(detail).toContain('image.height / Math.max(1, image.width) > 1.45');
    expect(detail).toContain('"is-scrollable"');
    expect(detail).toContain('"长图可上下滚动"');
    expect(css).toMatch(/\.selected-panel\s*\{[^}]*height:\s*min\(680px,\s*calc\(100vh - 104px\)\)/s);
    expect(css).toMatch(/\.detail-media-column\.is-scrollable\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/\.detail-media-column\.is-scrollable \.detail-image\s*\{[^}]*height:\s*auto/s);
  });

  it("相关推荐分配到独立的左右图片流，主卡片结束后左侧立即继续排图", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    expect(detail).toContain('className="detail-primary-stream"');
    expect(detail).toContain("index % 3 === 0");
    expect(detail).toContain("index % 3 !== 0");
    expect(detail).toContain("balanceMasonryColumns");
  });

  it("右侧与主卡片下方使用同一套等宽轨道和统一间距", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.detail-layout\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*20px/s);
    expect(css).toMatch(/\.detail-primary-stream\s*\{[^}]*grid-column:\s*span 4/s);
    expect(css).toMatch(/\.related-rail\s*\{[^}]*grid-column:\s*span 2/s);
    expect(css).toMatch(/\.rail-grid\s*\{[^}]*gap:\s*20px/s);
    expect(css).toMatch(/\.detail-masonry\s*\{[^}]*columns:\s*4[^}]*column-gap:\s*20px/s);
  });

  it("主页和详情页搜索栏都占满顶部可用宽度并使用更深底色", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.search-shell\s*\{[^}]*width:\s*100%/s);
    expect(css).toMatch(/\.search-shell[^}]*background:\s*var\(--color-cool-wash\)/s);
    expect(css).toContain(".detail-search-shell");
  });
});
