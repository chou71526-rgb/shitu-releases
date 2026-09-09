import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLocalAsset } from "../../src/main/local-assets";
import { createFixture } from "../helpers";

describe("本地图片读取", () => {
  it("直接返回图片内容和正确类型", async () => {
    const fixture = await createFixture();
    try {
      const directory = join(fixture.paths.root, "thumbnails");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "sample.webp"), new Uint8Array([4, 5, 6]));
      const response = await loadLocalAsset(fixture.paths.root, "local-image://asset/thumbnails/sample.webp");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([4, 5, 6]);
    } finally { await fixture.cleanup(); }
  });

  it("拒绝访问图库目录之外的文件", async () => {
    const fixture = await createFixture();
    try {
      expect((await loadLocalAsset(fixture.paths.root, "local-image:///../secret.txt")).status).toBe(403);
    } finally { await fixture.cleanup(); }
  });
});
