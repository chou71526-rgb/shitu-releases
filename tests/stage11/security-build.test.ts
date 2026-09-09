import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { startLocalServer } from "../../src/main/server";

describe("阶段 11 本机服务和密钥边界", () => {
  it("健康检查可用，受保护接口拒绝无令牌请求", async () => {
    const local = await startLocalServer();
    try {
      const health = await fetch(`http://127.0.0.1:${local.port}/health`); expect(health.status).toBe(200);
      const protectedResponse = await fetch(`http://127.0.0.1:${local.port}/anything`); expect(protectedResponse.status).toBe(401);
    } finally { local.server.close(); }
  });
  it("密钥文件不进入普通数据库和备份目录", async () => {
    const source = await readFile(new URL("../../src/main/services/app-service.ts", import.meta.url), "utf8");
    expect(source).toContain('new SecretStore(join(root, "gemini.key"))');
    expect(source).not.toContain("originals, \"gemini.key\"");
  });
});
