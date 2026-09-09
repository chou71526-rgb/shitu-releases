import { describe, expect, it } from "vitest";
import type { Analyzer, AnalysisAttempt } from "../../src/main/services/analysis";
import { analyzeAndSave, explainAnalysisError, GEMINI_MODEL, retryAnalysis, shouldAnalyzeAutomatically, shouldRetryAutomatically } from "../../src/main/services/analysis";
import type { LibraryImage } from "../../src/shared/types";
import { ImageImporter } from "../../src/main/services/importer";
import { AppService, nextPacificMidnight } from "../../src/main/services/app-service";
import { createFixture, png } from "../helpers";

describe("阶段 4 Gemini 结构化分类", () => {
  it("使用高额度且支持图片理解的稳定 Flash-Lite 模型", () => expect(GEMINI_MODEL).toBe("gemini-3.5-flash-lite"));
  it("只保存已有主分类和 5-10 个术语", async () => {
    const fixture = await createFixture();
    try {
      const imported = await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png(), originalName: "ai.png", source: "picker" });
      const analyzer: Analyzer = { analyze: async () => ({ primaryCategory: "网页设计", terms: ["不对称排版", "高饱和撞色", "玻璃拟态", "大标题", "模块网格"] }) };
      const image = await analyzeAndSave(fixture.repository, analyzer, imported.image.id);
      expect(image.aiStatus).toBe("completed"); expect(image.categoryName).toBe("网页设计"); expect(image.terms).toHaveLength(5);
    } finally { await fixture.cleanup(); }
  });
  it("失败时保留图片并写入可重试状态", async () => {
    const fixture = await createFixture();
    try {
      const imported = await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png("#111111"), originalName: "fail.png", source: "picker" });
      const analyzer: Analyzer = { analyze: async () => { throw new Error("网络超时"); } };
      const image = await analyzeAndSave(fixture.repository, analyzer, imported.image.id);
      expect(image.aiStatus).toBe("failed"); expect(image.aiError).toContain("网络超时"); expect(fixture.repository.getImage(image.id)).not.toBeNull();
    } finally { await fixture.cleanup(); }
  });
  it("将 Gemini 429 原始错误转换为中文提示并读取建议等待时间", () => {
    const failure = explainAnalysisError(new Error('{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"11.414s"}]}}'));
    expect(failure.userMessage).toBe("Gemini 请求较频繁，正在降低分析速度。");
    expect(failure.retryable).toBe(true);
    expect(failure.retryAfterMs).toBe(12_000);
    expect(failure.userMessage).not.toContain("RESOURCE_EXHAUSTED");
  });
  it("遇到可重试错误时使用 30 秒起步的指数退避并最多尝试五次", async () => {
    const image = {} as LibraryImage;
    const attempts: AnalysisAttempt[] = [
      { image, failure: { code: "RATE_LIMIT", userMessage: "限流", retryable: true, retryAfterMs: 11_000 } },
      { image, failure: { code: "RATE_LIMIT", userMessage: "限流", retryable: true, retryAfterMs: 11_000 } },
      { image, failure: { code: "NETWORK", userMessage: "断网", retryable: true, retryAfterMs: null } },
      { image, failure: null },
    ];
    const waits: number[] = [];
    const result = await retryAnalysis(async () => attempts.shift()!, { sleep: async (duration) => { waits.push(duration); }, random: () => 0 });
    expect(waits).toEqual([30_000, 60_000, 120_000]);
    expect(result.attempt.failure).toBeNull();
    expect(result.attempts).toBe(4);
    expect(attempts).toHaveLength(0);
  });
  it("区分每日额度、短期限流、网络断开和结构化响应错误", () => {
    expect(explainAnalysisError(new Error('{"code":429,"status":"RESOURCE_EXHAUSTED","quotaId":"GenerateRequestsPerDay"}')).code).toBe("DAILY_QUOTA");
    expect(explainAnalysisError(new Error('{"code":429,"status":"RESOURCE_EXHAUSTED","quotaId":"GenerateRequestsPerMinute"}')).code).toBe("RATE_LIMIT");
    expect(explainAnalysisError(new Error("net::ERR_CONNECTION_CLOSED")).code).toBe("NETWORK");
    expect(explainAnalysisError(new Error("INVALID_RESPONSE")).code).toBe("INVALID_RESPONSE");
  });
  it("每日额度暂停时间遵循太平洋时区午夜并兼容夏令时", () => {
    expect(nextPacificMidnight(new Date("2026-07-10T12:00:00Z")).toISOString()).toBe("2026-07-11T07:00:00.000Z");
    expect(nextPacificMidnight(new Date("2026-01-10T12:00:00Z")).toISOString()).toBe("2026-01-11T08:00:00.000Z");
  });
  it("自动模式会在下次启动时继续处理旧版 429 错误", () => {
    expect(shouldRetryAutomatically("automatic", true, "failed", '{"code":429,"status":"RESOURCE_EXHAUSTED"}')).toBe(true);
    expect(shouldRetryAutomatically("off", true, "failed", '{"code":429,"status":"RESOURCE_EXHAUSTED"}')).toBe(false);
  });
  it("已有设计术语的图片不会被自动队列重复分析", () => {
    const image = { terms: ["编辑式排版"], aiStatus: "failed", aiError: '{"code":429,"status":"RESOURCE_EXHAUSTED"}' } as LibraryImage;
    expect(shouldAnalyzeAutomatically("automatic", true, image)).toBe(false);
    expect(shouldAnalyzeAutomatically("automatic", true, { ...image, terms: [] })).toBe(true);
  });
  it("图片分析任务字段会持久化到数据库", async () => {
    const fixture = await createFixture();
    try {
      const imported = await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png("#224466"), originalName: "persistent.png", source: "picker" });
      const nextRetryAt = new Date(Date.now() + 60_000).toISOString();
      const image = fixture.repository.updateImage(imported.image.id, { aiStatus: "waiting-retry", aiErrorCode: "NETWORK", aiAttemptCount: 3, aiNextRetryAt: nextRetryAt });
      expect(image.aiStatus).toBe("waiting-retry");
      expect(image.aiErrorCode).toBe("NETWORK");
      expect(image.aiAttemptCount).toBe(3);
      expect(image.aiNextRetryAt).toBe(nextRetryAt);
    } finally { await fixture.cleanup(); }
  });
  it("自动分析执行前再次检查术语，不会因缺少密钥把已完成图片改成失败", async () => {
    const fixture = await createFixture();
    fixture.ctx.sqlite.close();
    const service = new AppService(fixture.root);
    try {
      const imported = await service.importer.import({ bytes: await png("#225577"), originalName: "already-analyzed.png", source: "picker" });
      service.repository.setTerms(imported.image.id, ["信息卡片", "层级排版"], "gemini");
      service.repository.updateImage(imported.image.id, { aiStatus: "failed", aiError: "旧错误" });
      const image = await service.analyzeImage(imported.image.id, true);
      expect(image.aiStatus).toBe("completed");
      expect(image.aiError).toBeNull();
      expect(image.terms).toEqual(expect.arrayContaining(["信息卡片", "层级排版"]));
    } finally {
      service.close();
      await fixture.cleanup();
    }
  });
  it("用户主动重新分析时允许覆盖已有设计术语", async () => {
    const fixture = await createFixture();
    try {
      const imported = await new ImageImporter(fixture.repository, fixture.paths).import({ bytes: await png("#553399"), originalName: "reanalyze.png", source: "picker" });
      fixture.repository.setTerms(imported.image.id, ["旧术语"], "user");
      let calls = 0;
      const analyzer: Analyzer = { analyze: async () => {
        calls += 1;
        return { primaryCategory: "海报", terms: ["新术语一", "新术语二", "新术语三", "新术语四", "新术语五"] };
      } };
      const image = await analyzeAndSave(fixture.repository, analyzer, imported.image.id);
      expect(calls).toBe(1);
      expect(image.terms).toEqual(expect.arrayContaining(["新术语一", "新术语二", "新术语三", "新术语四", "新术语五"]));
      expect(image.terms).toHaveLength(5);
      expect(image.categoryName).toBe("海报");
    } finally { await fixture.cleanup(); }
  });
});
