import { readFile, writeFile } from "node:fs/promises";
import { safeStorage } from "electron";

export class SecretStore {
  constructor(private readonly filePath: string) {}
  async setApiKey(value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows 安全存储当前不可用");
    await writeFile(this.filePath, safeStorage.encryptString(value.trim()));
  }
  async getApiKey(): Promise<string | null> {
    try { return safeStorage.decryptString(await readFile(this.filePath)); } catch { return null; }
  }
  async hasApiKey(): Promise<boolean> { return Boolean(await this.getApiKey()); }
}
