import type { AppSettings } from "../../shared/types";
import { List, Moon, Sun } from "@phosphor-icons/react";

export function TopBar({ onMenu, settings, onSettings, children }: { onMenu(): void; settings: AppSettings; onSettings(value: AppSettings): void; children?: React.ReactNode }) {
  const toggleTheme = async () => {
    const dark = document.documentElement.dataset.theme === "dark";
    const next = { ...settings, theme: dark ? "light" : "dark" } as AppSettings;
    onSettings(next); await window.appApi.saveSettings(next);
  };
  const dark = document.documentElement.dataset.theme === "dark";
  return <header className="top-bar"><button className="icon-button menu-button" onClick={onMenu} aria-label="打开菜单"><List size={20} weight="regular"/></button><div className="top-content">{children}</div><button className="icon-button theme-button" onClick={toggleTheme} aria-label="切换夜间模式">{dark ? <Sun size={19} weight="regular"/> : <Moon size={19} weight="regular"/>}</button></header>;
}
