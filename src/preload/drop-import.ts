import type { ImportRequest, ImportSource } from "../shared/types.js";

interface DroppedFile {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function createDroppedImageRequest(file: DroppedFile, filePath: string, source: ImportSource): Promise<ImportRequest> {
  if (filePath) return { filePath, originalName: file.name, source };
  return { bytes: new Uint8Array(await file.arrayBuffer()), originalName: file.name, source };
}
