import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp",
};

export async function loadLocalAsset(root: string, requestUrl: string): Promise<Response> {
  const decodedUrl = decodeURIComponent(requestUrl);
  if (decodedUrl.includes("/../") || decodedUrl.includes("\\..\\")) return new Response("Forbidden", { status: 403 });
  const requestedPath = decodeURIComponent(new URL(requestUrl).pathname).replace(/^\/+/, "");
  const target = normalize(join(root, requestedPath));
  const pathFromRoot = relative(normalize(root), target);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) return new Response("Forbidden", { status: 403 });
  try {
    const bytes = await readFile(target);
    return new Response(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": CONTENT_TYPES[extname(target).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
