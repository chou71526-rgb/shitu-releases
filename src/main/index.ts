import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from "electron";
import { basename, join } from "node:path";
import type { AppSettings, ImportRequest, WeeklyNote } from "../shared/types.js";
import { AppService } from "./services/app-service.js";
import { startLocalServer, type LocalServer } from "./server.js";
import { applyPetSettings, createMainWindow, createPetWindow, getPetWindow, showMainWindow } from "./windows.js";
import { loadLocalAsset } from "./local-assets.js";
import { installNetworkFetch } from "./network-fetch.js";

protocol.registerSchemesAsPrivileged([{ scheme: "local-image", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let service: AppService;
let localServer: LocalServer;

function registerIpc(): void {
  ipcMain.handle("library:list", (_event, query?: string) => service.listImages(query));
  ipcMain.handle("library:get", (_event, id: string) => service.getImage(id));
  const importAndNotify = async (request: ImportRequest) => {
    const result = await service.importImage(request);
    BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("library:changed"));
    return result;
  };
  ipcMain.handle("library:import", (_event, request: ImportRequest) => importAndNotify(request));
  ipcMain.handle("library:pick", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] }] });
    if (result.canceled) return [];
    const imported = [];
    for (const filePath of result.filePaths) imported.push(await importAndNotify({ filePath, originalName: basename(filePath), source: "picker" }));
    return imported;
  });
  ipcMain.handle("library:update", (_event, id: string, patch: unknown) => service.updateImage(id, patch));
  ipcMain.handle("library:trash", (_event, id: string) => service.trashImage(id));
  ipcMain.handle("library:restore", (_event, id: string) => service.restoreImage(id));
  ipcMain.handle("library:delete-permanently", (_event, id: string) => service.permanentlyDeleteImage(id));
  ipcMain.handle("library:trash-list", () => service.listTrash());
  ipcMain.handle("library:analyze", (_event, id: string) => service.analyzeImage(id));
  ipcMain.handle("library:term-add", (_event, id: string, name: string) => { service.repository.addTerm(id, name); return service.getImage(id); });
  ipcMain.handle("library:term-remove", (_event, id: string, name: string) => { service.repository.removeTerm(id, name); return service.getImage(id); });
  ipcMain.handle("library:recommend", (_event, id: string) => service.recommendations(id));
  ipcMain.handle("library:show", async (_event, id: string) => { const image = service.getImage(id); if (image) shell.showItemInFolder(join(service.paths.root, image.originalPath)); });
  ipcMain.handle("categories:list", () => service.repository.listCategories());
  ipcMain.handle("categories:create", (_event, name: string, color: string) => service.repository.createCategory(name, color));
  ipcMain.handle("categories:update", (_event, id: string, patch: object) => service.repository.updateCategory(id, patch));
  ipcMain.handle("categories:delete", (_event, id: string, migrateToId: string) => service.repository.deleteCategory(id, migrateToId));
  ipcMain.handle("settings:get", () => service.getSettings());
  ipcMain.handle("settings:save", (_event, value: AppSettings) => { service.saveSettings(value); applyPetSettings(value); app.setLoginItemSettings({ openAtLogin: value.launchAtLogin }); });
  ipcMain.handle("settings:key", (_event, key: string) => service.setApiKey(key));
  ipcMain.handle("settings:key-exists", () => service.secrets.hasApiKey());
  ipcMain.handle("settings:test-gemini", () => service.testGemini());
  ipcMain.handle("library:stats", () => service.getStats());
  ipcMain.handle("analysis:status", () => service.getAnalysisQueueStatus());
  ipcMain.handle("analysis:retry-failed", () => service.retryFailedAnalyses());
  ipcMain.handle("analysis:pause", () => service.pauseAnalyses());
  ipcMain.handle("analysis:resume", () => service.resumeAnalyses());
  ipcMain.handle("library:rebuild-thumbnails", () => service.rebuildThumbnails());
  ipcMain.handle("window:pet-visible", (_event, visible: boolean) => visible ? getPetWindow()?.show() : getPetWindow()?.hide());
  ipcMain.handle("window:pet-position", () => getPetWindow()?.getPosition() ?? [0, 0]);
  ipcMain.handle("window:pet-move", (_event, x: number, y: number) => getPetWindow()?.setPosition(Math.round(x), Math.round(y)));
  ipcMain.handle("journal:get-note", (_event, weekStart: string) => service.getWeeklyNote(weekStart));
  ipcMain.handle("journal:save-note", (_event, note: WeeklyNote) => service.saveWeeklyNote(note));
  ipcMain.handle("backup:create", async () => { const result = await dialog.showSaveDialog({ defaultPath: `拾图-${new Date().toISOString().slice(0, 10)}.zip`, filters: [{ name: "备份", extensions: ["zip"] }] }); return result.canceled || !result.filePath ? null : service.backup.create(result.filePath); });
  ipcMain.handle("backup:validate", async () => { const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "备份", extensions: ["zip"] }] }); return result.canceled ? null : service.backup.validate(result.filePaths[0]); });
  ipcMain.handle("backup:restore", async () => { const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "备份", extensions: ["zip"] }] }); if (result.canceled) return null; const confirmation = await dialog.showMessageBox({ type: "warning", buttons: ["取消", "恢复"], defaultId: 0, cancelId: 0, message: "恢复将替换当前图库", detail: "应用会先自动创建当前图库的恢复前备份。" }); if (confirmation.response !== 1) return null; await service.restoreBackup(result.filePaths[0]); return true; });
  ipcMain.handle("window:open-main", () => showMainWindow());
  ipcMain.handle("app:exit", () => { (globalThis as { quitting?: boolean }).quitting = true; app.quit(); });
}

app.whenReady().then(async () => {
  installNetworkFetch(net.fetch as typeof fetch);
  const notifyLibraryChanged = () => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("library:changed"));
  service = new AppService(app.getPath("userData"), notifyLibraryChanged);
  localServer = await startLocalServer();
  protocol.handle("local-image", (request) => loadLocalAsset(service.paths.root, request.url));
  registerIpc();
  createMainWindow();
  const pet = createPetWindow(service.getSettings());
  void service.resumeAutomaticAnalyses(notifyLibraryChanged);
  pet.on("moved", () => { const [petX, petY] = pet.getPosition(); service.saveSettings({ ...service.getSettings(), petX, petY }); });
});

app.on("before-quit", () => { (globalThis as { quitting?: boolean }).quitting = true; localServer?.server.close(); service?.close(); });
app.on("window-all-closed", () => { /* Desktop pet apps stay alive until the explicit Exit action. */ });
