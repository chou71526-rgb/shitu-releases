import { describe, expect, it } from "vitest";
import { createDroppedImageRequest } from "../../src/preload/drop-import";

describe("浏览器图片拖入", () => {
  const file = {
    name: "browser-image.png",
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  };

  it("有本机路径时使用路径", async () => {
    expect(await createDroppedImageRequest(file, "C:\\temp\\image.png", "pet")).toEqual({
      filePath: "C:\\temp\\image.png", originalName: "browser-image.png", source: "pet",
    });
  });

  it("浏览器不提供路径时改用图片内容", async () => {
    const request = await createDroppedImageRequest(file, "", "pet");
    expect(request.filePath).toBeUndefined();
    expect([...request.bytes!]).toEqual([1, 2, 3]);
  });
});
