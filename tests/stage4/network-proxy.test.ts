import { describe, expect, it } from "vitest";
import { installNetworkFetch } from "../../src/main/network-fetch";
import { shouldRetryAutomatically } from "../../src/main/services/analysis";

describe("Gemini 系统代理与自动重试", () => {
  it("将 SDK 请求切换到应用提供的系统代理 fetch", async () => {
    const original = globalThis.fetch;
    const replacement: typeof fetch = async () => new Response("proxied");
    try {
      installNetworkFetch(replacement);
      expect(await (await fetch("https://example.invalid")).text()).toBe("proxied");
    } finally { globalThis.fetch = original; }
  });

  it("只在自动模式且已有密钥时重试网络或缺密钥错误", () => {
    expect(shouldRetryAutomatically("automatic", true, "failed", "fetch failed")).toBe(true);
    expect(shouldRetryAutomatically("automatic", true, "failed", "请先在设置中配置 Gemini API 密钥")).toBe(true);
    expect(shouldRetryAutomatically("automatic", true, "failed", "models/gemini-2.5-flash is not found for API version v1beta")).toBe(true);
    expect(shouldRetryAutomatically("confirm", true, "failed", "fetch failed")).toBe(false);
    expect(shouldRetryAutomatically("off", true, "failed", "fetch failed")).toBe(false);
    expect(shouldRetryAutomatically("automatic", false, "failed", "fetch failed")).toBe(false);
  });
});
