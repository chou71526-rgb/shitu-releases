import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("阶段 1 Electron 安全边界", () => {
  it("窗口关闭 Node 集成并开启隔离和沙箱", async () => {
    const source = await readFile(new URL("../../src/main/windows.ts", import.meta.url), "utf8");
    expect(source).toContain("contextIsolation: true");
    expect(source).toContain("nodeIntegration: false");
    expect(source).toContain("sandbox: true");
    expect(source).toContain('action: "deny"');
  });
  it("本机服务只绑定回环地址", async () => {
    const source = await readFile(new URL("../../src/main/server.ts", import.meta.url), "utf8");
    expect(source).toContain('"127.0.0.1"');
    expect(source).not.toContain('"0.0.0.0"');
  });
});
