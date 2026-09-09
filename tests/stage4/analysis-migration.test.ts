import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";

describe("分析任务数据库迁移", () => {
  it("旧图库启动时自动增加持久化分析字段", async () => {
    const root = await mkdtemp(join(tmpdir(), "analysis-migration-"));
    const file = join(root, "library.sqlite");
    const legacy = new Database(file);
    legacy.exec(`
      CREATE TABLE images (
        id TEXT PRIMARY KEY, original_name TEXT NOT NULL, original_path TEXT NOT NULL, thumbnail_path TEXT NOT NULL,
        mime_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, size INTEGER NOT NULL, hash TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL, imported_at TEXT NOT NULL, journal_date TEXT NOT NULL, category_id TEXT,
        favorite INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', ai_status TEXT NOT NULL DEFAULT 'pending', ai_error TEXT,
        canvas_x REAL NOT NULL, canvas_y REAL NOT NULL, canvas_width REAL NOT NULL, canvas_manual INTEGER NOT NULL DEFAULT 0,
        journal_x REAL NOT NULL, journal_y REAL NOT NULL, journal_scale REAL NOT NULL DEFAULT 1, journal_rotation REAL NOT NULL,
        journal_decoration TEXT NOT NULL, dominant_color TEXT, brightness REAL, deleted_at TEXT, user_edited_at TEXT
      );
    `);
    legacy.close();
    const ctx = openDatabase(file);
    try {
      const columns = (ctx.sqlite.prepare("PRAGMA table_info(images)").all() as Array<{ name: string }>).map((column) => column.name);
      expect(columns).toEqual(expect.arrayContaining(["ai_error_code", "ai_attempt_count", "ai_next_retry_at"]));
    } finally {
      ctx.sqlite.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
