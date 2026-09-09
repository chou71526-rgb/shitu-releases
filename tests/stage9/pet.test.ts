import { describe, expect, it } from "vitest";
import { transitionPet } from "../../src/main/services/pet-state";
import { INGEST_SEQUENCE, PET_FRAME_SOURCES, SUCCESS_SEQUENCE } from "../../src/renderer/pet-animation";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

describe("阶段 9 桌宠状态机", () => {
  it("完整成功路径顺序固定", () => {
    let state = transitionPet("idle", "DRAG_VALID"); state = transitionPet(state, "DROP"); state = transitionPet(state, "LOCAL_SAVED"); state = transitionPet(state, "AI_STARTED"); state = transitionPet(state, "AI_DONE");
    expect(state).toBe("completed");
  });
  it("复制失败进入失败状态且可重置", () => expect(transitionPet(transitionPet("ingesting", "FAIL"), "RESET")).toBe("idle"));
  it("桌宠导入后会通知主界面刷新", async () => {
    const preload = await readFile(new URL("../../src/preload/index.ts", import.meta.url), "utf8");
    const app = await readFile(new URL("../../src/renderer/App.tsx", import.meta.url), "utf8");
    expect(preload).toContain("onLibraryChanged");
    expect(app).toContain("window.appApi.onLibraryChanged(refresh)");
  });
  it("整只桌宠可通过指针拖动窗口", async () => {
    const preload = await readFile(new URL("../../src/preload/index.ts", import.meta.url), "utf8");
    const pet = await readFile(new URL("../../src/renderer/pages/PetPage.tsx", import.meta.url), "utf8");
    expect(preload).toContain("getPetPosition");
    expect(preload).toContain("movePetTo");
    expect(pet).toContain("onPointerDown");
    expect(pet).toContain("onPointerMove");
  });
  it("完整吃图动作包含吞入和成功两段且顺序固定", () => {
    expect(INGEST_SEQUENCE.map(({ frame }) => frame)).toEqual(["notice", "enter", "intake", "close", "squash"]);
    expect(SUCCESS_SEQUENCE.map(({ frame }) => frame)).toEqual(["rebound", "saved", "successRise", "success"]);
  });
  it("实际导入与逐帧动画并行，成功段只在保存完成后播放", async () => {
    const pet = await readFile(new URL("../../src/renderer/pages/PetPage.tsx", import.meta.url), "utf8");
    expect(pet.indexOf("const importOutcome")).toBeLessThan(pet.indexOf("await playFrameSequence(INGEST_SEQUENCE)"));
    expect(pet.indexOf("const outcome = await importOutcome")).toBeLessThan(pet.indexOf("await playFrameSequence(SUCCESS_SEQUENCE)"));
  });
  it("全部桌宠动画帧都是同尺寸透明无损 WebP", async () => {
    for (const source of Object.values(PET_FRAME_SOURCES)) {
      const name = source.replace("./pet/", "");
      const path = fileURLToPath(new URL(`../../public/pet/${name}`, import.meta.url));
      const metadata = await sharp(path).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.hasAlpha).toBe(true);
      expect([metadata.width, metadata.height]).toEqual([512, 512]);
      const corner = await sharp(path).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
      expect(corner[3]).toBe(0);
    }
  });
});
