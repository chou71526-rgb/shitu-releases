import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { AppSettings, ImportRequest, WeeklyNote } from "../shared/types.js";
import { createDroppedImageRequest } from "./drop-import.js";

const api = {
  listImages: (query?: string) => ipcRenderer.invoke("library:list", query),
  getImage: (id: string) => ipcRenderer.invoke("library:get", id),
  importImage: (request: ImportRequest) => ipcRenderer.invoke("library:import", request),
  importDroppedFile: async (file: File, source: "pet" | "picker" = "picker") => ipcRenderer.invoke("library:import", await createDroppedImageRequest(file, webUtils.getPathForFile(file), source)),
  pickImages: () => ipcRenderer.invoke("library:pick"),
  updateImage: (id: string, patch: unknown) => ipcRenderer.invoke("library:update", id, patch),
  trashImage: (id: string) => ipcRenderer.invoke("library:trash", id),
  restoreImage: (id: string) => ipcRenderer.invoke("library:restore", id),
  permanentlyDeleteImage: (id: string) => ipcRenderer.invoke("library:delete-permanently", id),
  listTrash: () => ipcRenderer.invoke("library:trash-list"),
  analyzeImage: (id: string) => ipcRenderer.invoke("library:analyze", id),
  addTerm: (id: string, name: string) => ipcRenderer.invoke("library:term-add", id, name),
  removeTerm: (id: string, name: string) => ipcRenderer.invoke("library:term-remove", id, name),
  recommendations: (id: string) => ipcRenderer.invoke("library:recommend", id),
  categories: () => ipcRenderer.invoke("categories:list"),
  createCategory: (name: string, color: string) => ipcRenderer.invoke("categories:create", name, color),
  updateCategory: (id: string, patch: unknown) => ipcRenderer.invoke("categories:update", id, patch),
  deleteCategory: (id: string, migrateToId: string) => ipcRenderer.invoke("categories:delete", id, migrateToId),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("settings:save", settings),
  setApiKey: (key: string) => ipcRenderer.invoke("settings:key", key),
  hasApiKey: () => ipcRenderer.invoke("settings:key-exists"),
  testGemini: () => ipcRenderer.invoke("settings:test-gemini"),
  getStats: () => ipcRenderer.invoke("library:stats"),
  getAnalysisQueueStatus: () => ipcRenderer.invoke("analysis:status"),
  retryFailedAnalyses: () => ipcRenderer.invoke("analysis:retry-failed"),
  pauseAnalyses: () => ipcRenderer.invoke("analysis:pause"),
  resumeAnalyses: () => ipcRenderer.invoke("analysis:resume"),
  rebuildThumbnails: () => ipcRenderer.invoke("library:rebuild-thumbnails"),
  setPetVisible: (visible: boolean) => ipcRenderer.invoke("window:pet-visible", visible),
  getPetPosition: () => ipcRenderer.invoke("window:pet-position") as Promise<[number, number]>,
  movePetTo: (x: number, y: number) => ipcRenderer.invoke("window:pet-move", x, y),
  getWeeklyNote: (weekStart: string) => ipcRenderer.invoke("journal:get-note", weekStart),
  saveWeeklyNote: (note: WeeklyNote) => ipcRenderer.invoke("journal:save-note", note),
  createBackup: () => ipcRenderer.invoke("backup:create"),
  validateBackup: () => ipcRenderer.invoke("backup:validate"),
  restoreBackup: () => ipcRenderer.invoke("backup:restore"),
  showImageInFolder: (id: string) => ipcRenderer.invoke("library:show", id),
  openMain: () => ipcRenderer.invoke("window:open-main"),
  onLibraryChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("library:changed", listener);
    return () => { ipcRenderer.removeListener("library:changed", listener); };
  },
  exit: () => ipcRenderer.invoke("app:exit"),
};
contextBridge.exposeInMainWorld("appApi", api);
export type AppApi = typeof api;
