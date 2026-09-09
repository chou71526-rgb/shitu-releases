import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface AppPaths {
  root: string;
  database: string;
  originals: string;
  thumbnails: string;
  backups: string;
  temporary: string;
}

export function createAppPaths(root: string): AppPaths {
  const paths = {
    root,
    database: join(root, "database"),
    originals: join(root, "images", "originals"),
    thumbnails: join(root, "thumbnails"),
    backups: join(root, "backups"),
    temporary: join(root, "temporary"),
  };
  Object.values(paths).forEach((path) => mkdirSync(path, { recursive: true }));
  return paths;
}
