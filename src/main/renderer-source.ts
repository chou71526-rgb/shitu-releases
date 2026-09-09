export type RendererSource =
  | { kind: "file" }
  | { kind: "url"; url: string };

export function getRendererSource(isPackaged: boolean, devServerUrl?: string): RendererSource {
  if (isPackaged) return { kind: "file" };
  return { kind: "url", url: devServerUrl ?? "http://localhost:5173" };
}
