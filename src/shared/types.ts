export const CATEGORY_NAMES = ["网页设计", "App/UI", "海报", "品牌", "插画", "摄影", "动效参考", "其他"] as const;

export type AiMode = "automatic" | "confirm" | "off";
export type ThemeMode = "system" | "light" | "dark";
export type AiStatus = "local-only" | "waiting-confirmation" | "pending" | "waiting-retry" | "analyzing" | "completed" | "failed";
export type AnalysisErrorCode = "RATE_LIMIT" | "DAILY_QUOTA" | "NETWORK" | "SERVER" | "AUTH" | "MODEL" | "INVALID_RESPONSE" | "UNKNOWN";
export type AnalysisPauseReason = "manual" | "daily-quota" | null;
export type ImportSource = "pet" | "picker" | "clipboard";

export interface LibraryImage {
  id: string;
  originalName: string;
  originalPath: string;
  thumbnailPath: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  hash: string;
  source: ImportSource;
  importedAt: string;
  journalDate: string;
  categoryId: string | null;
  categoryName: string | null;
  favorite: boolean;
  note: string;
  aiStatus: AiStatus;
  aiError: string | null;
  aiErrorCode: AnalysisErrorCode | null;
  aiAttemptCount: number;
  aiNextRetryAt: string | null;
  terms: string[];
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasManual: boolean;
  journalX: number;
  journalY: number;
  journalScale: number;
  journalRotation: number;
  journalDecoration: string;
  dominantColor: string | null;
  brightness: number | null;
  deletedAt: string | null;
  userEditedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  preset: boolean;
}

export interface WeeklyNote {
  weekStart: string;
  content: string;
  height: number;
  updatedAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  reducedMotion: boolean;
  aiMode: AiMode;
  petAlwaysOnTop: boolean;
  petSound: boolean;
  petVolume: number;
  petSize: number;
  petX: number | null;
  petY: number | null;
  launchAtLogin: boolean;
  canvasZoom: number;
  canvasX: number;
  canvasY: number;
}

export interface ImportRequest {
  filePath?: string;
  bytes?: Uint8Array;
  originalName: string;
  source: ImportSource;
}

export interface ImportResult {
  image: LibraryImage;
  duplicate: boolean;
}

export interface AnalysisResult {
  primaryCategory: string;
  terms: string[];
}

export interface BackupResult {
  path: string;
  imageCount: number;
}

export interface LibraryStats { imageCount: number; originalBytes: number; thumbnailBytes: number; databaseBytes: number; pending: number; completed: number; failed: number; }

export interface AnalysisQueueStatus {
  paused: boolean;
  pauseReason: AnalysisPauseReason;
  pauseUntil: string | null;
  pending: number;
  analyzing: number;
  completed: number;
  failed: number;
}

export type AppRoute = "library" | "journal" | "settings" | "detail" | "trash";
