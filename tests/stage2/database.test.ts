import { describe, expect, it } from "vitest";
import { createFixture } from "../helpers";

describe("阶段 2 SQLite 和持久化", () => {
  it("初始化预设分类并保存设置和周笔记", async () => {
    const fixture = await createFixture();
    try {
      expect(fixture.repository.listCategories()).toHaveLength(8);
      const settings = { ...fixture.repository.getSettings(), theme: "dark" as const };
      fixture.repository.saveSettings(settings);
      expect(fixture.repository.getSettings().theme).toBe("dark");
      fixture.repository.saveWeeklyNote({ weekStart: "2026-08-31", content: "本周笔记", height: 260, updatedAt: new Date().toISOString() });
      expect(fixture.repository.getWeeklyNote("2026-08-31").content).toBe("本周笔记");
    } finally { await fixture.cleanup(); }
  });
});
