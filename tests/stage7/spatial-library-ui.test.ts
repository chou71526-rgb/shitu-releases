import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("首页空间图片墙", () => {
  it("使用连续空间相机投影图片，而不是离散翻页", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("archiveCloudPoint");
    expect(page).toContain("projectArchivePoint");
    expect(page).toContain("cameraZ");
    expect(page).toContain("cameraYaw");
    expect(page).toContain('className="canvas-depth-haze"');
    expect(page).not.toContain("depthPageCount");
    expect(page).not.toContain("depth-page-control");
  });

  it("首页导航和搜索悬浮在全屏空间场景上", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.library-page\s*>\s*\.top-bar\s*\{[^}]*position:\s*absolute[^}]*background:\s*transparent/s);
    expect(css).toMatch(/\.library-page\s+\.canvas-viewport\s*\{[^}]*height:\s*100vh/s);
    expect(css).toContain("backdrop-filter: none");
  });

  it("首页搜索栏日间为白色、夜间为深灰，筛选和导入只显示图标", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(page).toContain('aria-label="筛选"');
    expect(page).toContain('aria-label="导入图片"');
    expect(page).not.toMatch(/<Funnel[^>]*\/>筛选<\/button>/);
    expect(page).not.toMatch(/<Plus[^>]*\/>导入<\/button>/);
    expect(css).toMatch(/\.library-page \.search-shell\s*\{[^}]*background:\s*#fff/s);
    expect(css).toMatch(/\.library-page \.search-shell\s*\{[^}]*color:\s*#1d1d1f/s);
    expect(css).toMatch(/:root\[data-theme="dark"\] \.library-page \.search-shell\s*\{[^}]*background:\s*#2c2c2e/s);
    expect(css).toMatch(/:root\[data-theme="dark"\] \.library-page \.search-shell\s*\{[^}]*color:\s*#f5f5f7/s);
    expect(css).not.toContain(".search-shell button:first-of-type { display: none; }");
  });

  it("首页图片没有半透明卡片底或大范围投影", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.canvas-image\s*\{[^}]*background:\s*transparent/s);
    expect(css).toMatch(/\.canvas-image\s*\{[^}]*box-shadow:\s*none/s);
  });

  it("深色首页使用纯黑空间背景并移除蓝灰雾光", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/:root\[data-theme="dark"\] \.library-page\s*\{[^}]*background:\s*#000/s);
    expect(css).toMatch(/:root\[data-theme="dark"\] \.canvas-depth-haze\s*\{[^}]*display:\s*none/s);
  });

  it("拖动改变观察方向，滚轮沿视线施加带阻尼的前后速度", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("cameraVelocity.current");
    expect(page).toContain("cameraYaw.set");
    expect(page).toContain("cameraPitch.set");
    expect(page).toContain("requestAnimationFrame");
    expect(page).toContain("拖动环顾");
    expect(page).toContain("Math.sign(event.deltaY)");
    expect(page).toContain("archiveViewVector");
  });

  it("上下拖动方向与视角方向一致", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("cameraDrag.current.pitch + dy * .002");
    expect(page).not.toContain("cameraDrag.current.pitch - dy * .002");
  });

  it("远处图片不可交互，首页展示使用本地原图而不是压缩缩略图", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("pointerEvents");
    expect(page).toContain("project(values).interactive");
    expect(page).toContain("image.originalPath");
    expect(page).toContain('draggable={false}');
  });

  it("拖动环顾期间关闭图片命中并禁止浏览器原生蓝色选区", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toContain("user-select: none");
    expect(css).toContain(".archive-camera.is-looking .canvas-image");
    expect(css).toContain("pointer-events: none !important");
  });

  it("拖动图片本体用于转动相机，只有移动手柄调整图片位置", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain('title="移动图片"');
    expect(page).toContain("cameraTargetYaw");
    expect(page).toContain("cameraTargetPitch");
    expect(page).not.toContain('closest(".canvas-image")');
    expect(page).toContain("advanceArchiveCamera");
  });

  it("每次滚轮手势沿当前视线自由行进，不磁吸图片中心", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/LibraryPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("cameraTravelDirection");
    expect(page).toContain("lastWheelAt");
    expect(page).toContain("advanceArchiveCameraAlong");
    expect(page).toContain("archiveViewVector(cameraState)");
    expect(page).not.toContain("archiveTravelVector");
  });
});
