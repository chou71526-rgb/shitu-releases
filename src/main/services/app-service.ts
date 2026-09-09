import { copyFile, cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AnalysisQueueStatus, AppSettings, ImportRequest, LibraryImage, LibraryStats, WeeklyNote } from "../../shared/types.js";
import { CATEGORY_NAMES } from "../../shared/types.js";
import { imageUpdateSchema } from "../../shared/schemas.js";
import { openDatabase, type DatabaseContext } from "../db/database.js";
import { Repository } from "../db/repository.js";
import { analyzeAndSaveAttempt, explainAnalysisError, GeminiAnalyzer, retryAnalysis, shouldAnalyzeAutomatically, testGeminiKey } from "./analysis.js";
import { AnalysisRequestQueue } from "./analysis-queue.js";
import { BackupService } from "./backup.js";
import { ImageImporter } from "./importer.js";
import { seededPoint } from "./layout.js";
import { createAppPaths, type AppPaths } from "./paths.js";
import { recommend } from "./recommendations.js";
import { SecretStore } from "./secrets.js";
import { secureExtractZip } from "./zip.js";

export class AppService {
  readonly paths: AppPaths;
  ctx!: DatabaseContext;
  repository!: Repository;
  importer!: ImageImporter;
  backup!: BackupService;
  readonly secrets: SecretStore;
  private readonly analysisJobQueue = new AnalysisRequestQueue(0);
  private readonly analysisRequestQueue = new AnalysisRequestQueue(30_000);
  private readonly analysisJobs = new Map<string, Promise<LibraryImage>>();
  private resumePromise: Promise<void> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: string, private readonly onLibraryChanged: () => void = () => undefined) {
    this.paths = createAppPaths(root);
    this.initializeDataServices();
    this.secrets = new SecretStore(join(root, "gemini.key"));
  }

  private initializeDataServices(): void {
    this.ctx = openDatabase(join(this.paths.database, "library.sqlite"));
    this.repository = new Repository(this.ctx);
    this.repository.seedCategories(CATEGORY_NAMES);
    this.importer = new ImageImporter(this.repository, this.paths);
    this.repository.listImages({ includeDeleted: true }).forEach((image) => {
      if (image.aiStatus !== "failed" || !image.aiError) return;
      const failure = explainAnalysisError(new Error(image.aiError));
      if (failure.userMessage !== image.aiError || image.aiErrorCode !== failure.code) this.repository.updateImage(image.id, { aiError: failure.userMessage, aiErrorCode: failure.code });
    });
    this.repository.listImages({ includeDeleted: true }).sort((a, b) => a.importedAt.localeCompare(b.importedAt)).forEach((image, index) => {
      if (!image.canvasManual) this.repository.updateImage(image.id, { canvasX: seededPoint(image.hash, index).x, canvasY: seededPoint(image.hash, index).y });
    });
    this.backup = new BackupService(this.paths, this.ctx, this.repository);
  }

  listImages(query?: string): LibraryImage[] { return this.repository.listImages({ query }); }
  getImage(id: string): LibraryImage | null { return this.repository.getImage(id); }
  async importImage(request: ImportRequest) {
    const result = await this.importer.import(request);
    if (!result.duplicate) {
      const settings = this.repository.getSettings();
      if (settings.aiMode === "off") this.repository.updateImage(result.image.id, { aiStatus: "local-only" });
      else if (settings.aiMode === "confirm") this.repository.updateImage(result.image.id, { aiStatus: "waiting-confirmation" });
      else void this.analyzeImage(result.image.id, true).then(() => this.onLibraryChanged());
    }
    return { ...result, image: this.repository.getImage(result.image.id)! };
  }
  async analyzeImage(id: string, automatic = false): Promise<LibraryImage> {
    const active = this.analysisJobs.get(id);
    if (active) return active;
    const job = this.analysisJobQueue.enqueue(() => this.runAnalysis(id, automatic)).finally(() => this.analysisJobs.delete(id));
    this.analysisJobs.set(id, job);
    return job;
  }
  private async runAnalysis(id: string, automatic: boolean): Promise<LibraryImage> {
    const current = this.repository.getImage(id);
    if (!current) throw new Error("图片不存在");
    if (automatic && current.terms.length > 0) {
      return this.repository.updateImage(id, { aiStatus: "completed", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null });
    }
    if (automatic) {
      const mode = this.repository.getSettings().aiMode;
      if (mode !== "automatic") return this.repository.updateImage(id, { aiStatus: mode === "off" ? "local-only" : "waiting-confirmation", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null });
      if (this.analysisIsPaused()) return this.repository.updateImage(id, { aiStatus: "pending" });
    }
    const key = await this.secrets.getApiKey();
    if (!key) return this.repository.updateImage(id, { aiStatus: "failed", aiError: "请先在设置中配置 Gemini API 密钥", aiErrorCode: "AUTH", aiNextRetryAt: null });
    const analyzer = new GeminiAnalyzer(key, this.paths);
    const scheduledAt = current.aiNextRetryAt ? new Date(current.aiNextRetryAt).getTime() : 0;
    if (automatic && scheduledAt > Date.now()) await new Promise<void>((resolve) => setTimeout(resolve, scheduledAt - Date.now()));
    if (automatic && this.analysisIsPaused()) return this.repository.updateImage(id, { aiStatus: "pending", aiNextRetryAt: null });
    const previousAttempts = automatic ? current.aiAttemptCount : 0;
    let attemptNumber = 0;
    const result = await retryAnalysis(async () => this.analysisRequestQueue.enqueue(async () => {
      attemptNumber += 1;
      this.repository.updateImage(id, { aiAttemptCount: previousAttempts + attemptNumber, aiNextRetryAt: null });
      const latest = this.repository.getImage(id);
      if (!latest) throw new Error("图片不存在");
      if (automatic && latest.terms.length > 0) {
        return { image: this.repository.updateImage(id, { aiStatus: "completed", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null }), failure: null };
      }
      if (automatic && this.repository.getSettings().aiMode !== "automatic") {
        const mode = this.repository.getSettings().aiMode;
        return { image: this.repository.updateImage(id, { aiStatus: mode === "off" ? "local-only" : "waiting-confirmation", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null }), failure: null };
      }
      return analyzeAndSaveAttempt(this.repository, analyzer, id);
    }), {
      maxAttempts: Math.max(1, 5 - previousAttempts),
      shouldContinue: () => !automatic || !this.analysisIsPaused(),
      onRetry: (failure, attemptCount, delayMs) => this.repository.updateImage(id, {
        aiStatus: "waiting-retry",
        aiError: failure.userMessage,
        aiErrorCode: failure.code,
        aiAttemptCount: previousAttempts + attemptCount,
        aiNextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      }),
    });
    const failure = result.attempt.failure;
    if (!failure) return this.repository.getImage(id)!;
    const totalAttempts = previousAttempts + result.attempts;
    if (failure.code === "DAILY_QUOTA") {
      const pauseUntil = nextPacificMidnight().toISOString();
      this.setAnalysisPause("daily-quota", pauseUntil);
      this.scheduleAutomaticResume(pauseUntil);
      return this.repository.updateImage(id, { aiStatus: "waiting-retry", aiError: failure.userMessage, aiErrorCode: failure.code, aiAttemptCount: totalAttempts, aiNextRetryAt: pauseUntil });
    }
    if (result.stopped && automatic) return this.repository.updateImage(id, { aiStatus: "pending", aiAttemptCount: totalAttempts, aiNextRetryAt: null });
    const finalMessage = failure.retryable && totalAttempts >= 5 ? `${failure.userMessage} 已自动尝试 5 次，可在数据页重新加入队列。` : failure.userMessage;
    return this.repository.updateImage(id, { aiStatus: "failed", aiError: finalMessage, aiErrorCode: failure.code, aiAttemptCount: totalAttempts, aiNextRetryAt: null });
  }
  async resumeAutomaticAnalyses(onComplete?: () => void): Promise<void> {
    if (this.resumePromise) return this.resumePromise;
    this.resumePromise = this.runAutomaticAnalyses(onComplete).finally(() => { this.resumePromise = null; });
    return this.resumePromise;
  }
  private async runAutomaticAnalyses(onComplete?: () => void): Promise<void> {
    const settings = this.repository.getSettings();
    const pause = this.repository.getAnalysisPause();
    const keyExists = await this.secrets.hasApiKey();
    if (pause.paused) {
      if (pause.reason === "daily-quota" && pause.until && new Date(pause.until).getTime() <= Date.now()) this.setAnalysisPause(null, null);
      else {
        if (pause.until) this.scheduleAutomaticResume(pause.until);
        return;
      }
    }
    const retryable = this.repository.listImages().filter((image) => shouldAnalyzeAutomatically(settings.aiMode, keyExists, image));
    for (const image of retryable) {
      await this.analyzeImage(image.id, true);
      onComplete?.();
      if (this.analysisIsPaused()) break;
    }
  }
  getAnalysisQueueStatus(): AnalysisQueueStatus {
    const images = this.repository.listImages();
    const pause = this.repository.getAnalysisPause();
    return {
      paused: pause.paused,
      pauseReason: pause.reason,
      pauseUntil: pause.until,
      pending: images.filter((image) => image.aiStatus === "pending" || image.aiStatus === "waiting-retry").length,
      analyzing: images.filter((image) => image.aiStatus === "analyzing").length,
      completed: images.filter((image) => image.aiStatus === "completed").length,
      failed: images.filter((image) => image.aiStatus === "failed").length,
    };
  }
  pauseAnalyses(): AnalysisQueueStatus {
    this.setAnalysisPause("manual", null);
    return this.getAnalysisQueueStatus();
  }
  resumeAnalyses(): AnalysisQueueStatus {
    this.setAnalysisPause(null, null);
    void this.resumeAutomaticAnalyses(() => this.onLibraryChanged());
    return this.getAnalysisQueueStatus();
  }
  retryFailedAnalyses(): number {
    const failed = this.repository.listImages().filter((image) => image.aiStatus === "failed" && image.terms.length === 0);
    for (const image of failed) this.repository.updateImage(image.id, { aiStatus: "pending", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null });
    this.setAnalysisPause(null, null);
    void this.resumeAutomaticAnalyses(() => this.onLibraryChanged());
    return failed.length;
  }
  async setApiKey(key: string): Promise<void> {
    await this.secrets.setApiKey(key);
    if (this.repository.getSettings().aiMode === "automatic") this.retryFailedAnalyses();
  }
  private analysisIsPaused(): boolean { return this.repository.getAnalysisPause().paused; }
  private setAnalysisPause(reason: AnalysisQueueStatus["pauseReason"], until: string | null): void {
    this.repository.saveAnalysisPause({ paused: reason !== null, reason, until });
  }
  private scheduleAutomaticResume(until: string): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    const delay = Math.max(0, new Date(until).getTime() - Date.now());
    this.resumeTimer = setTimeout(() => {
      this.setAnalysisPause(null, null);
      void this.resumeAutomaticAnalyses(() => this.onLibraryChanged());
    }, delay);
  }
  updateImage(id: string, patch: unknown): LibraryImage {
    const parsed = imageUpdateSchema.parse(patch);
    return this.repository.updateImage(id, { ...parsed, userEditedAt: new Date().toISOString() });
  }
  trashImage(id: string): LibraryImage { return this.repository.updateImage(id, { deletedAt: new Date().toISOString() }); }
  restoreImage(id: string): LibraryImage { return this.repository.updateImage(id, { deletedAt: null }); }
  async permanentlyDeleteImage(id: string): Promise<void> {
    const image = this.repository.getImage(id); if (!image?.deletedAt) throw new Error("只能永久删除最近删除中的图片");
    const holding = join(this.paths.temporary, `delete-${id}`); await mkdir(holding, { recursive: true });
    const original = join(this.paths.root, image.originalPath); const thumbnail = join(this.paths.root, image.thumbnailPath);
    try {
      await rename(original, join(holding, "original")).catch(() => undefined);
      await rename(thumbnail, join(holding, "thumbnail")).catch(() => undefined);
      this.repository.deleteImage(id);
      await rm(holding, { recursive: true, force: true });
    } catch (error) {
      await rename(join(holding, "original"), original).catch(() => undefined);
      await rename(join(holding, "thumbnail"), thumbnail).catch(() => undefined);
      throw error;
    }
  }
  listTrash(): LibraryImage[] { return this.repository.listImages({ includeDeleted: true }).filter((item) => item.deletedAt); }
  recommendations(id: string): LibraryImage[] { const image = this.getImage(id); return image ? recommend(image, this.listImages()) : []; }
  getSettings(): AppSettings { return this.repository.getSettings(); }
  saveSettings(value: AppSettings): void {
    this.repository.saveSettings(value);
    if (value.aiMode === "automatic") void this.resumeAutomaticAnalyses(() => this.onLibraryChanged());
  }
  async testGemini(): Promise<boolean> { const key = await this.secrets.getApiKey(); if (!key) throw new Error("请先保存 API 密钥"); return testGeminiKey(key); }
  async getStats(): Promise<LibraryStats> {
    const sizeOf = async (directory: string): Promise<number> => { let total = 0; for (const entry of await readdir(directory, { withFileTypes: true })) total += entry.isDirectory() ? await sizeOf(join(directory, entry.name)) : (await stat(join(directory, entry.name))).size; return total; };
    const all = this.repository.listImages({ includeDeleted: true });
    return { imageCount: all.length, originalBytes: await sizeOf(this.paths.originals), thumbnailBytes: await sizeOf(this.paths.thumbnails), databaseBytes: (await stat(join(this.paths.database, "library.sqlite"))).size, pending: all.filter((item) => ["pending", "waiting-retry", "analyzing", "waiting-confirmation"].includes(item.aiStatus)).length, completed: all.filter((item) => item.aiStatus === "completed").length, failed: all.filter((item) => item.aiStatus === "failed").length };
  }
  async rebuildThumbnails(): Promise<void> {
    for (const image of this.repository.listImages({ includeDeleted: true })) {
      const source = join(this.paths.root, image.originalPath); const target = join(this.paths.root, image.thumbnailPath);
      const sharp = (await import("sharp")).default; await sharp(source).rotate().resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(target);
    }
  }
  getWeeklyNote(weekStart: string): WeeklyNote { return this.repository.getWeeklyNote(weekStart); }
  saveWeeklyNote(note: WeeklyNote): void { this.repository.saveWeeklyNote(note); }
  async restoreBackup(backupPath: string): Promise<void> {
    await this.backup.validate(backupPath);
    const rollbackZip = join(this.paths.backups, `恢复前备份-${new Date().toISOString().replaceAll(":", "-")}.zip`);
    await this.backup.create(rollbackZip);
    const staging = join(this.paths.temporary, `restore-${Date.now()}`); const rollback = join(this.paths.temporary, `rollback-${Date.now()}`);
    await mkdir(staging, { recursive: true }); await mkdir(rollback, { recursive: true });
    await secureExtractZip(backupPath, staging);
    this.ctx.sqlite.close();
    try {
      await rename(join(this.paths.database, "library.sqlite"), join(rollback, "library.sqlite"));
      await rename(this.paths.originals, join(rollback, "originals"));
      await rename(this.paths.thumbnails, join(rollback, "thumbnails"));
      await copyFile(join(staging, "database", "library.sqlite"), join(this.paths.database, "library.sqlite"));
      await cp(join(staging, "images", "originals"), this.paths.originals, { recursive: true });
      await cp(join(staging, "thumbnails"), this.paths.thumbnails, { recursive: true });
      this.initializeDataServices();
      await rm(rollback, { recursive: true, force: true }); await rm(staging, { recursive: true, force: true });
    } catch (error) {
      await rm(join(this.paths.database, "library.sqlite"), { force: true }); await rm(this.paths.originals, { recursive: true, force: true }); await rm(this.paths.thumbnails, { recursive: true, force: true });
      await rename(join(rollback, "library.sqlite"), join(this.paths.database, "library.sqlite")).catch(() => undefined);
      await rename(join(rollback, "originals"), this.paths.originals).catch(() => undefined);
      await rename(join(rollback, "thumbnails"), this.paths.thumbnails).catch(() => undefined);
      this.initializeDataServices();
      throw error;
    }
  }
  close(): void { if (this.resumeTimer) clearTimeout(this.resumeTimer); this.ctx.sqlite.close(); }
}

export function nextPacificMidnight(now = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 86_400_000);
  const target = { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() };
  let guess = Date.UTC(target.year, target.month - 1, target.day, 8);
  for (let index = 0; index < 3; index += 1) {
    const shown = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const difference = Date.UTC(target.year, target.month - 1, target.day) - Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    guess += difference;
  }
  return new Date(guess);
}
