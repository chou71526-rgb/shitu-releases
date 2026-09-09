import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  sortOrder: integer("sort_order").notNull(),
  preset: integer("preset", { mode: "boolean" }).notNull().default(false),
});

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  originalPath: text("original_path").notNull(),
  thumbnailPath: text("thumbnail_path").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  size: integer("size").notNull(),
  hash: text("hash").notNull(),
  source: text("source").notNull(),
  importedAt: text("imported_at").notNull(),
  journalDate: text("journal_date").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  note: text("note").notNull().default(""),
  aiStatus: text("ai_status").notNull().default("pending"),
  aiError: text("ai_error"),
  aiErrorCode: text("ai_error_code"),
  aiAttemptCount: integer("ai_attempt_count").notNull().default(0),
  aiNextRetryAt: text("ai_next_retry_at"),
  canvasX: real("canvas_x").notNull(),
  canvasY: real("canvas_y").notNull(),
  canvasWidth: real("canvas_width").notNull(),
  canvasManual: integer("canvas_manual", { mode: "boolean" }).notNull().default(false),
  journalX: real("journal_x").notNull(),
  journalY: real("journal_y").notNull(),
  journalScale: real("journal_scale").notNull().default(1),
  journalRotation: real("journal_rotation").notNull(),
  journalDecoration: text("journal_decoration").notNull(),
  dominantColor: text("dominant_color"),
  brightness: real("brightness"),
  deletedAt: text("deleted_at"),
  userEditedAt: text("user_edited_at"),
}, (table) => [uniqueIndex("images_hash_unique").on(table.hash)]);

export const terms = sqliteTable("terms", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  source: text("source").notNull(),
});

export const imageTerms = sqliteTable("image_terms", {
  imageId: text("image_id").notNull().references(() => images.id, { onDelete: "cascade" }),
  termId: text("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
}, (table) => [uniqueIndex("image_term_unique").on(table.imageId, table.termId)]);

export const weeklyNotes = sqliteTable("weekly_notes", {
  weekStart: text("week_start").primaryKey(),
  content: text("content").notNull().default(""),
  height: integer("height").notNull().default(220),
  updatedAt: text("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
