import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("自动分析队列控制", () => {
  it("数据页显示队列状态并提供重试、暂停和继续操作", async () => {
    const page = await readFile(new URL("../../src/renderer/pages/SettingsPage.tsx", import.meta.url), "utf8");
    expect(page).toContain("getAnalysisQueueStatus");
    expect(page).toContain("retryFailedAnalyses");
    expect(page).toContain("pauseAnalyses");
    expect(page).toContain("resumeAnalyses");
    expect(page).toContain("重试全部失败");
    expect(page).toContain("暂停分析");
    expect(page).toContain("继续分析");
  });

  it("队列状态沿用现有双主题和胶囊按钮体系", async () => {
    const css = await readFile(new URL("../../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toContain(".analysis-queue-card");
    expect(css).toContain(".analysis-queue-state");
    expect(css).toContain(":root[data-theme=\"dark\"] .analysis-queue-card");
  });

  it("服务将每次重试包在真实请求限速器中", async () => {
    const service = await readFile(new URL("../../src/main/services/app-service.ts", import.meta.url), "utf8");
    expect(service).toContain("retryAnalysis(async () => this.analysisRequestQueue.enqueue");
  });
});
