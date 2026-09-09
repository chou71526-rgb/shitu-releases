import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { CATEGORY_NAMES } from "../src/shared/types";
import { openDatabase } from "../src/main/db/database";
import { Repository } from "../src/main/db/repository";
import { createAppPaths } from "../src/main/services/paths";

export async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "image-pet-test-"));
  const paths = createAppPaths(root);
  const ctx = openDatabase(join(paths.database, "library.sqlite"));
  const repository = new Repository(ctx); repository.seedCategories(CATEGORY_NAMES);
  return { root, paths, ctx, repository, cleanup: async () => { ctx.sqlite.close(); await rm(root, { recursive: true, force: true }); } };
}

export async function png(color = "#d9892b", width = 320, height = 240): Promise<Buffer> { return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer(); }
