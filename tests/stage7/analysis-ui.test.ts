import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("AI 分析状态交互", () => {
  it("详情页分析时显示中文状态并禁止重复点击", async () => {
    const detail = await readFile(new URL("../../src/renderer/pages/DetailPage.tsx", import.meta.url), "utf8");
    expect(detail).toContain("正在排队分析");
    expect(detail).toContain("disabled={isAnalyzing}");
    expect(detail).toContain("AI 分析已完成");
    expect(detail).not.toContain("`AI 状态：${image.aiStatus}`");
  });
  it("新导入图片自动分析完成后通知所有页面刷新", async () => {
    const service = await readFile(new URL("../../src/main/services/app-service.ts", import.meta.url), "utf8");
    expect(service).toContain(".then(() => this.onLibraryChanged())");
  });
});
