import { describe, expect, it } from "vitest";
import { getRendererSource } from "../../src/main/renderer-source";

describe("安装版页面加载", () => {
  it("安装版始终使用内置页面，不连接本机开发服务", () => {
    expect(getRendererSource(true)).toEqual({ kind: "file" });
    expect(getRendererSource(true, "http://localhost:5173")).toEqual({ kind: "file" });
  });

  it("开发版才使用本地开发服务", () => {
    expect(getRendererSource(false)).toEqual({ kind: "url", url: "http://localhost:5173" });
    expect(getRendererSource(false, "http://localhost:4173")).toEqual({ kind: "url", url: "http://localhost:4173" });
  });
});
