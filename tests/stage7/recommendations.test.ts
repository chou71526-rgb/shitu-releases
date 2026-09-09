import { describe, expect, it } from "vitest";
import type { LibraryImage } from "../../src/shared/types";
import { recommend, recommendationScore } from "../../src/main/services/recommendations";

const base = (id: string, patch: Partial<LibraryImage> = {}): LibraryImage => ({ id, originalName: `${id}.png`, originalPath: "", thumbnailPath: "", mimeType: "image/png", width: 400, height: 300, size: 1, hash: id, source: "picker", importedAt: "2026-09-03T00:00:00Z", journalDate: "2026-09-03", categoryId: "web", categoryName: "网页设计", favorite: false, note: "", aiStatus: "completed", aiError: null, aiErrorCode: null, aiAttemptCount: 0, aiNextRetryAt: null, terms: ["玻璃拟态", "网格"], canvasX: 0, canvasY: 0, canvasWidth: 180, canvasManual: false, journalX: 0, journalY: 0, journalScale: 1, journalRotation: 0, journalDecoration: "pin", dominantColor: "#d9892b", brightness: .6, deletedAt: null, userEditedAt: null, ...patch });

describe("阶段 7 本地相关推荐", () => {
  it("相同分类和术语的图片优先", () => {
    const source = base("source"); const close = base("close", { terms: ["玻璃拟态", "网格"] }); const far = base("far", { categoryId: "photo", terms: ["摄影"] });
    expect(recommend(source, [far, close])[0].id).toBe("close");
    expect(recommendationScore(source, source)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("排除最近删除和低相关图片", () => {
    const source = base("source"); const deleted = base("deleted", { deletedAt: new Date().toISOString() });
    expect(recommend(source, [deleted])).toHaveLength(0);
  });
});
