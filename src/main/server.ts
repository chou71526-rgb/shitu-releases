import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import express from "express";

export interface LocalServer { server: Server; token: string; port: number; }

export async function startLocalServer(): Promise<LocalServer> {
  const token = randomBytes(32).toString("hex");
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    if (request.path === "/health") return next();
    if (request.header("authorization") !== `Bearer ${token}`) return response.status(401).json({ error: "unauthorized" });
    next();
  });
  app.get("/health", (_request, response) => response.json({ ok: true }));
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("本机服务启动失败");
  return { server, token, port: address.port };
}
