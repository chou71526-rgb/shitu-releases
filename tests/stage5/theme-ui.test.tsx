// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppApi } from "../../src/preload";
import type { AppSettings } from "../../src/shared/types";
import { TopBar } from "../../src/renderer/components/TopBar";

const settings: AppSettings = { theme: "light", reducedMotion: false, aiMode: "automatic", petAlwaysOnTop: true, petSound: true, petVolume: .7, petSize: 128, petX: null, petY: null, launchAtLogin: false, canvasZoom: 1, canvasX: 0, canvasY: 0 };

describe("阶段 5 顶部主题快捷操作", () => {
  it("点击夜间模式按钮会持久化主题", async () => {
    document.documentElement.dataset.theme = "light"; const saveSettings = vi.fn().mockResolvedValue(undefined);
    window.appApi = { saveSettings } as unknown as AppApi;
    const onSettings = vi.fn(); render(<TopBar onMenu={() => undefined} settings={settings} onSettings={onSettings}/>);
    fireEvent.click(screen.getByRole("button", { name: "切换夜间模式" }));
    expect(onSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
    expect(saveSettings).toHaveBeenCalled();
  });
});
