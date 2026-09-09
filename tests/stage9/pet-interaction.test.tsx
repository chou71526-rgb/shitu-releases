// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PetPage } from "../../src/renderer/pages/PetPage";

describe("阶段 9 桌宠逐帧交互", () => {
  let finishImport: (value: { image: object; duplicate: boolean }) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    const importPromise = new Promise<{ image: object; duplicate: boolean }>((resolve) => { finishImport = resolve; });
    window.appApi = {
      getSettings: vi.fn().mockResolvedValue({ petSound: false, reducedMotion: false }),
      importDroppedFile: vi.fn().mockReturnValue(importPromise),
      getPetPosition: vi.fn().mockResolvedValue([0, 0]),
      movePetTo: vi.fn(),
      openMain: vi.fn(),
    } as unknown as typeof window.appApi;
  });

  afterEach(() => { vi.useRealTimers(); });

  it("悬停时提示接图，保存确认前停在吞咽末帧，确认后播放成功帧", async () => {
    const { container } = render(<PetPage />);
    await act(async () => {});
    const page = container.querySelector("main")!;
    const sprite = container.querySelector(".pet-sprite") as HTMLImageElement;

    fireEvent.dragOver(page);
    expect(sprite.src).toContain("frame-notice.webp");

    const file = new File(["image"], "idea.png", { type: "image/png" });
    fireEvent.drop(page, { dataTransfer: { files: [file] } });
    await act(async () => { await vi.advanceTimersByTimeAsync(530); });
    expect(sprite.src).toContain("frame-squash.webp");
    expect(screen.getByRole("status")).toHaveTextContent("啊呜");
    expect(screen.getByTestId("ingest-effects").querySelectorAll(".ingest-particle")).toHaveLength(10);

    await act(async () => { finishImport({ image: {}, duplicate: false }); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(sprite.src).toContain("frame-success.webp");
    expect(screen.getByRole("status")).toHaveTextContent("收藏好了");
    expect(screen.queryByTestId("ingest-effects")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(sprite.src).toContain("frame-idle.webp");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
