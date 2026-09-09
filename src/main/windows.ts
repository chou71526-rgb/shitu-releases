import { app, BrowserWindow, Menu, screen } from "electron";
import { join } from "node:path";
import type { AppSettings } from "../shared/types.js";
import { getRendererSource } from "./renderer-source.js";

let mainWindow: BrowserWindow | null = null;
let petWindow: BrowserWindow | null = null;

function load(window: BrowserWindow, route = ""): void {
  const source = getRendererSource(app.isPackaged, process.env.VITE_DEV_SERVER_URL);
  if (source.kind === "url") void window.loadURL(`${source.url}${route}`);
  else void window.loadFile(join(import.meta.dirname, "../../dist/index.html"), { hash: route.replace(/^\/#?/, "") });
}

const securePreferences = { preload: join(import.meta.dirname, "../preload/index.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true };

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return mainWindow; }
  mainWindow = new BrowserWindow({ title: "拾图", width: 1360, height: 860, minWidth: 980, minHeight: 680, show: false, backgroundColor: "#EEE9DF", webPreferences: securePreferences });
  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => { if (!(globalThis as { quitting?: boolean }).quitting) { event.preventDefault(); mainWindow?.hide(); } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  load(mainWindow);
  return mainWindow;
}

export function createPetWindow(settings: AppSettings): BrowserWindow {
  const display = screen.getPrimaryDisplay().workArea;
  const size = settings.petSize;
  petWindow = new BrowserWindow({
    width: size, height: size, x: settings.petX ?? display.width - size - 28, y: settings.petY ?? display.height - size - 28,
    transparent: true, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: settings.petAlwaysOnTop,
    hasShadow: false, webPreferences: securePreferences,
  });
  petWindow.setAlwaysOnTop(settings.petAlwaysOnTop, "floating");
  petWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  petWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: "打开图库", click: () => createMainWindow() },
      { label: "隐藏桌宠", click: () => petWindow?.hide() },
      { type: "separator" },
      { label: "退出", click: () => { (globalThis as { quitting?: boolean }).quitting = true; petWindow?.destroy(); mainWindow?.destroy(); } },
    ]).popup();
  });
  load(petWindow, "#/pet");
  return petWindow;
}

export function showMainWindow(): void { createMainWindow(); }
export function getPetWindow(): BrowserWindow | null { return petWindow; }
export function applyPetSettings(settings: AppSettings): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setAlwaysOnTop(settings.petAlwaysOnTop, "floating");
  petWindow.setSize(settings.petSize, settings.petSize, true);
}
