import { describe, expect, it } from "vitest";
import { AnalysisRequestQueue } from "../../src/main/services/analysis-queue";
import { retryAnalysis, type AnalysisAttempt } from "../../src/main/services/analysis";
import type { LibraryImage } from "../../src/shared/types";

describe("Gemini 分析请求队列", () => {
  it("串行执行并在相邻请求之间保留安全间隔", async () => {
    let now = 1_000;
    const starts: number[] = [];
    const queue = new AnalysisRequestQueue(30_000, () => now, async (duration) => { now += duration; });

    const jobs = [1, 2, 3].map((value) => queue.enqueue(async () => {
      starts.push(now);
      return value;
    }));

    await expect(Promise.all(jobs)).resolves.toEqual([1, 2, 3]);
    expect(starts).toEqual([1_000, 31_000, 61_000]);
  });

  it("前一个请求失败后仍会继续执行下一个请求", async () => {
    let now = 1_000;
    const queue = new AnalysisRequestQueue(30_000, () => now, async (duration) => { now += duration; });
    const failed = queue.enqueue(async () => { throw new Error("失败"); });
    const next = queue.enqueue(async () => "完成");

    await expect(failed).rejects.toThrow("失败");
    await expect(next).resolves.toBe("完成");
  });

  it("自动重试的每一次真实请求也经过同一个限速器", async () => {
    let now = 1_000;
    const starts: number[] = [];
    const queue = new AnalysisRequestQueue(30_000, () => now, async (duration) => { now += duration; });
    const image = {} as LibraryImage;
    const attempts: AnalysisAttempt[] = [
      { image, failure: { code: "NETWORK", userMessage: "断网", retryable: true, retryAfterMs: null } },
      { image, failure: { code: "NETWORK", userMessage: "断网", retryable: true, retryAfterMs: null } },
      { image, failure: null },
    ];
    await retryAnalysis(() => queue.enqueue(async () => { starts.push(now); return attempts.shift()!; }), { sleep: async (duration) => { now += duration; }, random: () => 0 });
    expect(starts).toEqual([1_000, 31_000, 91_000]);
  });
});
