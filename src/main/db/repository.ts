import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, like, or } from "drizzle-orm";
import type { AnalysisPauseReason, AppSettings, Category, LibraryImage, WeeklyNote } from "../../shared/types.js";
import type { DatabaseContext } from "./database.js";
import { categories, images, imageTerms, settings, terms, weeklyNotes } from "./schema.js";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system", reducedMotion: false, aiMode: "automatic", petAlwaysOnTop: true,
  petSound: true, petVolume: 0.7, petSize: 144, petX: null, petY: null,
  launchAtLogin: false, canvasZoom: 1, canvasX: 0, canvasY: 0,
};

const COLORS = ["#D9892B", "#C5684B", "#8B7355", "#A87855", "#B65D44", "#94705B", "#C18B3E", "#7A6A5B"];

export class Repository {
  constructor(private readonly ctx: DatabaseContext) {}

  seedCategories(names: readonly string[]): void {
    const insert = this.ctx.sqlite.prepare("INSERT OR IGNORE INTO categories (id,name,color,sort_order,preset) VALUES (?,?,?,?,1)");
    const tx = this.ctx.sqlite.transaction(() => names.forEach((name, index) => insert.run(randomUUID(), name, COLORS[index], index)));
    tx();
  }

  listCategories(): Category[] {
    return this.ctx.db.select().from(categories).orderBy(asc(categories.sortOrder)).all();
  }

  createCategory(name: string, color: string): Category {
    const item = { id: randomUUID(), name: name.trim(), color, sortOrder: this.listCategories().length, preset: false };
    this.ctx.db.insert(categories).values(item).run();
    return item;
  }

  updateCategory(id: string, patch: Partial<Pick<Category, "name" | "color" | "sortOrder">>): void {
    this.ctx.db.update(categories).set(patch).where(eq(categories.id, id)).run();
  }

  deleteCategory(id: string, migrateToId: string): void {
    this.ctx.sqlite.transaction(() => {
      this.ctx.db.update(images).set({ categoryId: migrateToId }).where(eq(images.categoryId, id)).run();
      this.ctx.db.delete(categories).where(eq(categories.id, id)).run();
    })();
  }

  findByHash(hash: string): LibraryImage | null {
    const row = this.ctx.db.select().from(images).where(eq(images.hash, hash)).get();
    return row ? this.hydrate(row) : null;
  }

  insertImage(row: typeof images.$inferInsert): LibraryImage {
    this.ctx.db.insert(images).values(row).run();
    return this.getImage(row.id)!;
  }

  getImage(id: string): LibraryImage | null {
    const row = this.ctx.db.select().from(images).where(eq(images.id, id)).get();
    return row ? this.hydrate(row) : null;
  }

  listImages(options: { includeDeleted?: boolean; query?: string } = {}): LibraryImage[] {
    const rows = this.ctx.db.select().from(images).where(options.includeDeleted ? undefined : isNull(images.deletedAt)).all();
    const hydrated = rows.map((row) => this.hydrate(row));
    const query = options.query?.trim().toLocaleLowerCase();
    if (!query) return hydrated;
    return hydrated.filter((item) => [item.originalName, item.note, item.categoryName ?? "", ...item.terms].some((value) => value.toLocaleLowerCase().includes(query)));
  }

  updateImage(id: string, patch: Partial<typeof images.$inferInsert>): LibraryImage {
    this.ctx.db.update(images).set(patch).where(eq(images.id, id)).run();
    return this.getImage(id)!;
  }

  deleteImage(id: string): void {
    this.ctx.db.delete(images).where(eq(images.id, id)).run();
  }

  setTerms(imageId: string, names: string[], source = "gemini"): void {
    this.ctx.sqlite.transaction(() => {
      this.ctx.db.delete(imageTerms).where(eq(imageTerms.imageId, imageId)).run();
      for (const name of [...new Set(names.map((value) => value.trim()).filter(Boolean))]) {
        const existing = this.ctx.db.select().from(terms).where(eq(terms.name, name)).get();
        const termId = existing?.id ?? randomUUID();
        if (!existing) this.ctx.db.insert(terms).values({ id: termId, name, source }).run();
        this.ctx.db.insert(imageTerms).values({ imageId, termId }).run();
      }
    })();
  }

  addTerm(imageId: string, name: string): void {
    const existing = this.ctx.db.select().from(terms).where(eq(terms.name, name.trim())).get();
    const termId = existing?.id ?? randomUUID();
    if (!existing) this.ctx.db.insert(terms).values({ id: termId, name: name.trim(), source: "user" }).run();
    this.ctx.db.insert(imageTerms).values({ imageId, termId }).onConflictDoNothing().run();
    this.updateImage(imageId, { userEditedAt: new Date().toISOString() });
  }

  removeTerm(imageId: string, name: string): void {
    const term = this.ctx.db.select().from(terms).where(eq(terms.name, name)).get();
    if (term) this.ctx.db.delete(imageTerms).where(and(eq(imageTerms.imageId, imageId), eq(imageTerms.termId, term.id))).run();
    this.updateImage(imageId, { userEditedAt: new Date().toISOString() });
  }

  getWeeklyNote(weekStart: string): WeeklyNote {
    return this.ctx.db.select().from(weeklyNotes).where(eq(weeklyNotes.weekStart, weekStart)).get() ?? { weekStart, content: "", height: 220, updatedAt: new Date().toISOString() };
  }

  saveWeeklyNote(note: WeeklyNote): void {
    this.ctx.db.insert(weeklyNotes).values(note).onConflictDoUpdate({ target: weeklyNotes.weekStart, set: { content: note.content, height: note.height, updatedAt: note.updatedAt } }).run();
  }

  getSettings(): AppSettings {
    const row = this.ctx.db.select().from(settings).where(eq(settings.key, "app")).get();
    return row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } : DEFAULT_SETTINGS;
  }

  saveSettings(value: AppSettings): void {
    this.ctx.db.insert(settings).values({ key: "app", value: JSON.stringify(value) }).onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } }).run();
  }

  getAnalysisPause(): { paused: boolean; reason: AnalysisPauseReason; until: string | null } {
    const row = this.ctx.db.select().from(settings).where(eq(settings.key, "analysis-queue")).get();
    return row ? { paused: false, reason: null, until: null, ...JSON.parse(row.value) } : { paused: false, reason: null, until: null };
  }

  saveAnalysisPause(value: { paused: boolean; reason: AnalysisPauseReason; until: string | null }): void {
    this.ctx.db.insert(settings).values({ key: "analysis-queue", value: JSON.stringify(value) }).onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } }).run();
  }

  private hydrate(row: typeof images.$inferSelect): LibraryImage {
    const category = row.categoryId ? this.ctx.db.select().from(categories).where(eq(categories.id, row.categoryId)).get() : null;
    const ids = this.ctx.db.select({ termId: imageTerms.termId }).from(imageTerms).where(eq(imageTerms.imageId, row.id)).all().map((item) => item.termId);
    const termNames = ids.length ? this.ctx.db.select({ name: terms.name }).from(terms).where(inArray(terms.id, ids)).all().map((item) => item.name) : [];
    return { ...row, source: row.source as LibraryImage["source"], aiStatus: row.aiStatus as LibraryImage["aiStatus"], aiErrorCode: row.aiErrorCode as LibraryImage["aiErrorCode"], categoryName: category?.name ?? null, terms: termNames };
  }
}
