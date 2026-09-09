import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GPT Taste 全局设计系统", () => {
  it("图库背景贯通顶部工具栏和空间画布", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.library-page \{[^}]*background: radial-gradient/);
    expect(css).toMatch(/\.library-view-bar \{[^}]*background: transparent/);
    expect(css).toMatch(/\.archive-camera \{[^}]*background: transparent/);
    expect(css).toContain(':root[data-theme="dark"] .library-page { background: #000; }');
  });
  it("项目保存 DESIGN.md，并声明应用级设计约束", async () => {
    const design = await readFile(new URL("../../DESIGN.md", import.meta.url), "utf8");
    expect(design).toContain("# 拾图设计系统");
    expect(design).toContain("--color-electric-blue");
    expect(design).toContain("28px");
    expect(design).toContain("全部图片");
    expect(design).toContain("周手账");
    expect(design).toContain("数据与设置");
  });

  it("全局样式使用新设计 token，移除旧琥珀色底层", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toContain("--color-electric-blue: #0071e3");
    expect(css).toContain("--radius-card: 28px");
    expect(css).toContain("--font-display");
    expect(css).not.toContain("--accent: #d9892b");
    expect(css).not.toContain("box-shadow: var(--shadow)");
  });

  it("页面过渡使用 GSAP，导航图标使用 Phosphor 而不是字符图标", async () => {
    const app = await readFile(new URL("../../src/renderer/App.tsx", import.meta.url), "utf8");
    const topBar = await readFile(new URL("../../src/renderer/components/TopBar.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("../../src/renderer/components/NavigationDrawer.tsx", import.meta.url), "utf8");
    const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
    expect(packageJson.dependencies.gsap).toBeTruthy();
    expect(packageJson.dependencies["@gsap/react"]).toBeTruthy();
    expect(packageJson.dependencies["@phosphor-icons/react"]).toBeTruthy();
    expect(app).toContain("useGSAP");
    expect(topBar).toContain("List");
    expect(topBar).toContain("Moon");
    expect(drawer).toContain("ImagesSquare");
    expect(drawer).not.toContain("◒");
  });

  it("为 1728px 演示画布提供独立的大屏密度层", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toContain("@media (min-width: 1500px)");
    expect(css).toContain("height: min(720px, calc(100vh - 112px))");
    expect(css).toContain("width: min(1440px, calc(100% - 96px))");
  });
});
