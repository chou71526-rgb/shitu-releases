import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export interface DatabaseContext {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
}

export function openDatabase(filePath: string): DatabaseContext {
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL, sort_order INTEGER NOT NULL, preset INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY, original_name TEXT NOT NULL, original_path TEXT NOT NULL, thumbnail_path TEXT NOT NULL,
      mime_type TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, size INTEGER NOT NULL, hash TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL, imported_at TEXT NOT NULL, journal_date TEXT NOT NULL, category_id TEXT REFERENCES categories(id),
      favorite INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', ai_status TEXT NOT NULL DEFAULT 'pending', ai_error TEXT,
      ai_error_code TEXT, ai_attempt_count INTEGER NOT NULL DEFAULT 0, ai_next_retry_at TEXT,
      canvas_x REAL NOT NULL, canvas_y REAL NOT NULL, canvas_width REAL NOT NULL, canvas_manual INTEGER NOT NULL DEFAULT 0,
      journal_x REAL NOT NULL, journal_y REAL NOT NULL, journal_scale REAL NOT NULL DEFAULT 1, journal_rotation REAL NOT NULL,
      journal_decoration TEXT NOT NULL, dominant_color TEXT, brightness REAL, deleted_at TEXT, user_edited_at TEXT
    );
    CREATE TABLE IF NOT EXISTS terms (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS image_terms (image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE, term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE, UNIQUE(image_id, term_id));
    CREATE TABLE IF NOT EXISTS weekly_notes (week_start TEXT PRIMARY KEY, content TEXT NOT NULL DEFAULT '', height INTEGER NOT NULL DEFAULT 220, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const imageColumns = new Set((sqlite.prepare("PRAGMA table_info(images)").all() as Array<{ name: string }>).map((column) => column.name));
  if (!imageColumns.has("ai_error_code")) sqlite.exec("ALTER TABLE images ADD COLUMN ai_error_code TEXT");
  if (!imageColumns.has("ai_attempt_count")) sqlite.exec("ALTER TABLE images ADD COLUMN ai_attempt_count INTEGER NOT NULL DEFAULT 0");
  if (!imageColumns.has("ai_next_retry_at")) sqlite.exec("ALTER TABLE images ADD COLUMN ai_next_retry_at TEXT");
  return { sqlite, db: drizzle(sqlite, { schema }) };
}
