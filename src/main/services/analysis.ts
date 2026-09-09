import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { analysisResultSchema } from "../../shared/schemas.js";
import type { AiMode, AiStatus, AnalysisErrorCode, AnalysisResult, LibraryImage } from "../../shared/types.js";
import type { Repository } from "../db/repository.js";
import type { AppPaths } from "./paths.js";

export interface Analyzer { analyze(image: LibraryImage, categories: string[]): Promise<AnalysisResult>; }
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface AnalysisFailure {
  code: AnalysisErrorCode;
  userMessage: string;
  retryable: boolean;
  retryAfterMs: number | null;
}

export interface AnalysisAttempt {
  image: LibraryImage;
  failure: AnalysisFailure | null;
}

export interface RetryAnalysisResult {
  attempt: AnalysisAttempt;
  attempts: number;
  stopped: boolean;
}

export async function retryAnalysis(
  attempt: () => Promise<AnalysisAttempt>,
  options: {
    sleep?: (duration: number) => Promise<void>;
    random?: () => number;
    minimumDelayMs?: number;
    maximumDelayMs?: number;
    maxAttempts?: number;
    shouldContinue?: () => boolean;
    onRetry?: (failure: AnalysisFailure, attemptCount: number, delayMs: number) => void;
  } = {},
): Promise<RetryAnalysisResult> {
  const sleep = options.sleep ?? ((duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration)));
  const random = options.random ?? Math.random;
  const minimumDelayMs = options.minimumDelayMs ?? 30_000;
  const maximumDelayMs = options.maximumDelayMs ?? 300_000;
  const maxAttempts = options.maxAttempts ?? 5;
  let current = await attempt();
  let attempts = 1;
  while (current.failure?.retryable && attempts < maxAttempts) {
    if (options.shouldContinue && !options.shouldContinue()) return { attempt: current, attempts, stopped: true };
    const exponentialDelay = Math.min(maximumDelayMs, minimumDelayMs * (2 ** (attempts - 1)));
    const delayMs = Math.max(exponentialDelay, (current.failure.retryAfterMs ?? 0) + 1_000) + Math.floor(random() * 3_000);
    options.onRetry?.(current.failure, attempts, delayMs);
    await sleep(delayMs);
    if (options.shouldContinue && !options.shouldContinue()) return { attempt: current, attempts, stopped: true };
    current = await attempt();
    attempts += 1;
  }
  return { attempt: current, attempts, stopped: false };
}

export function explainAnalysisError(error: unknown): AnalysisFailure {
  const raw = error instanceof Error ? error.message : String(error);
  if (/quota_exceeded|requests?perday|per_day|daily quota|daily request|\brpd\b/i.test(raw)) {
    return { code: "DAILY_QUOTA", userMessage: "Gemini 今日额度已用完，分析队列会在额度重置后继续。", retryable: false, retryAfterMs: null };
  }
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(raw)) {
    const matched = raw.match(/"?retryDelay"?\s*:\s*"([\d.]+)s"/i);
    const retryAfterMs = matched ? Math.max(1_000, Math.ceil(Number(matched[1])) * 1_000) : 15_000;
    return { code: "RATE_LIMIT", userMessage: "Gemini 请求较频繁，正在降低分析速度。", retryable: true, retryAfterMs };
  }
  if (/API_KEY_INVALID|API key not valid|\b401\b|\b403\b/i.test(raw)) {
    return { code: "AUTH", userMessage: "Gemini API 密钥无效或没有使用权限，请在设置中重新检查。", retryable: false, retryAfterMs: null };
  }
  if (/fetch failed|connect timeout|network|ERR_CONNECTION_CLOSED|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(raw)) {
    return { code: "NETWORK", userMessage: "暂时无法连接 Gemini。", retryable: true, retryAfterMs: 15_000 };
  }
  if (/\b404\b|NOT_FOUND|model.*not.*found|no longer available/i.test(raw)) {
    return { code: "MODEL", userMessage: "当前 Gemini 模型暂时不可用，请更新应用后重试。", retryable: false, retryAfterMs: null };
  }
  if (/\b408\b|\b5\d\d\b|UNAVAILABLE|deadline exceeded/i.test(raw)) {
    return { code: "SERVER", userMessage: "Gemini 服务暂时繁忙。", retryable: true, retryAfterMs: 15_000 };
  }
  if (/INVALID_RESPONSE|Unexpected token|invalid_type|too_small|JSON/i.test(raw)) {
    return { code: "INVALID_RESPONSE", userMessage: "Gemini 返回内容不完整。", retryable: true, retryAfterMs: null };
  }
  return { code: "UNKNOWN", userMessage: raw.length <= 120 && !raw.trim().startsWith("{") ? raw : "Gemini 分析失败，请稍后重试。", retryable: false, retryAfterMs: null };
}

export function shouldRetryAutomatically(mode: AiMode, keyExists: boolean, status: AiStatus, error: string | null, code: AnalysisErrorCode | null = null): boolean {
  if (mode !== "automatic" || !keyExists) return false;
  if (status === "pending" || status === "waiting-retry" || status === "analyzing") return true;
  if (status !== "failed") return false;
  if (["RATE_LIMIT", "NETWORK", "SERVER", "INVALID_RESPONSE"].includes(code ?? "")) return true;
  const message = error?.toLocaleLowerCase() ?? "";
  return message.includes("fetch failed") || message.includes("connect timeout") || message.includes("err_connection_closed") || message.includes("暂时无法连接 gemini") || message.includes("resource_exhausted") || message.includes("额度限制") || message.includes("gemini 分析失败") || message.includes("请先在设置中配置 gemini api 密钥") || message.includes("gemini-2.5-flash");
}

export function shouldAnalyzeAutomatically(mode: AiMode, keyExists: boolean, image: Pick<LibraryImage, "terms" | "aiStatus" | "aiError" | "aiErrorCode">): boolean {
  if (image.terms.length > 0) return false;
  return shouldRetryAutomatically(mode, keyExists, image.aiStatus, image.aiError, image.aiErrorCode);
}

export class GeminiAnalyzer implements Analyzer {
  constructor(private readonly apiKey: string, private readonly paths: AppPaths) {}

  async analyze(image: LibraryImage, categories: string[]): Promise<AnalysisResult> {
    const source = await readFile(join(this.paths.root, image.originalPath));
    const sanitized = await sharp(source).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: "image/jpeg", data: sanitized.toString("base64") } },
        { text: `识别并理解图片中可见的文字、界面层级、版式、色彩与视觉风格，然后分析设计语言。主分类必须从以下列表选择一个：${categories.join("、")}。再给出 5 到 10 个具体、可搜索的中文设计术语。只输出 JSON：{\"primaryCategory\":\"...\",\"terms\":[\"...\"]}` },
      ] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["primaryCategory", "terms"],
          properties: {
            primaryCategory: { type: "string", enum: categories },
            terms: { type: "array", minItems: 5, maxItems: 10, items: { type: "string" } },
          },
        },
      },
    });
    try {
      return analysisResultSchema.parse(JSON.parse(response.text ?? "{}"));
    } catch {
      throw new Error("INVALID_RESPONSE");
    }
  }
}

export async function testGeminiKey(apiKey: string): Promise<boolean> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({ model: GEMINI_MODEL, contents: "只回复 OK" });
  return Boolean(response.text?.trim());
}

export async function analyzeAndSaveAttempt(repository: Repository, analyzer: Analyzer, imageId: string): Promise<AnalysisAttempt> {
  const image = repository.getImage(imageId);
  if (!image) throw new Error("图片不存在");
  const beforeEdit = image.userEditedAt;
  repository.updateImage(imageId, { aiStatus: "analyzing", aiError: null, aiErrorCode: null, aiNextRetryAt: null });
  try {
    const categories = repository.listCategories();
    const result = await analyzer.analyze(image, categories.map((item) => item.name));
    const category = categories.find((item) => item.name === result.primaryCategory) ?? categories.find((item) => item.name === "其他");
    const current = repository.getImage(imageId)!;
    if (current.userEditedAt === beforeEdit) {
      repository.setTerms(imageId, result.terms, "gemini");
      repository.updateImage(imageId, { categoryId: category?.id ?? null, aiStatus: "completed", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null });
    } else repository.updateImage(imageId, { aiStatus: "completed", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null });
  } catch (error) {
    const failure = explainAnalysisError(error);
    repository.updateImage(imageId, { aiStatus: "failed", aiError: failure.userMessage, aiErrorCode: failure.code });
    return { image: repository.getImage(imageId)!, failure };
  }
  return { image: repository.getImage(imageId)!, failure: null };
}

export async function analyzeAndSave(repository: Repository, analyzer: Analyzer, imageId: string): Promise<LibraryImage> {
  return (await analyzeAndSaveAttempt(repository, analyzer, imageId)).image;
}
