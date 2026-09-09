import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import yauzl from "yauzl";

export async function secureExtractZip(zipPath: string, destination: string): Promise<void> {
  const root = normalize(destination + sep);
  await mkdir(destination, { recursive: true });
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => yauzl.open(zipPath, { lazyEntries: true }, (error, file) => error || !file ? reject(error ?? new Error("无法打开备份")) : resolve(file)));
  await new Promise<void>((resolve, reject) => {
    const fail = (error: Error) => { zip.close(); reject(error); };
    zip.on("error", fail);
    zip.on("end", resolve);
    zip.on("entry", async (entry) => {
      try {
        const unixPath = entry.fileName.replaceAll("\\", "/");
        if (unixPath.startsWith("/") || unixPath.includes("../") || /^[A-Za-z]:/.test(unixPath)) throw new Error(`备份包含不安全路径：${entry.fileName}`);
        const target = normalize(join(destination, unixPath));
        if (!target.startsWith(root)) throw new Error(`备份路径越界：${entry.fileName}`);
        const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
        if ((mode & 0o170000) === 0o120000) throw new Error(`备份不能包含符号链接：${entry.fileName}`);
        if (entry.fileName.endsWith("/")) { await mkdir(target, { recursive: true }); zip.readEntry(); return; }
        await mkdir(dirname(target), { recursive: true });
        zip.openReadStream(entry, (error, stream) => {
          if (error || !stream) return fail(error ?? new Error("无法读取备份条目"));
          const output = createWriteStream(target, { flags: "wx" });
          stream.on("error", fail); output.on("error", fail); output.on("close", () => zip.readEntry()); stream.pipe(output);
        });
      } catch (error) { fail(error instanceof Error ? error : new Error("备份解压失败")); }
    });
    zip.readEntry();
  });
}
