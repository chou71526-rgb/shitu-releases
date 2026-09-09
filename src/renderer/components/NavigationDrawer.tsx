import { AnimatePresence, motion } from "motion/react";
import { CalendarDots, ImagesSquare, SlidersHorizontal, X } from "@phosphor-icons/react";
import type { AiMode, AppRoute } from "../../shared/types";

const labels = [
  { route: "library" as AppRoute, label: "全部图片", Icon: ImagesSquare },
  { route: "journal" as AppRoute, label: "周手账", Icon: CalendarDots },
  { route: "settings" as AppRoute, label: "数据与设置", Icon: SlidersHorizontal },
];
const aiLabels: Record<AiMode, string> = { automatic: "AI 自动分析", confirm: "AI 发送前确认", off: "AI 已关闭" };

export function NavigationDrawer({ open, onClose, current, navigate, aiMode }: { open: boolean; onClose(): void; current: AppRoute | "pet"; navigate(route: AppRoute): void; aiMode: AiMode }) {
  return <AnimatePresence>{open && <>
    <motion.button className="drawer-backdrop" aria-label="关闭菜单" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.aside className="drawer" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", stiffness: 280, damping: 30 }}>
      <header><div className="brand-mark"><img src="./pet/frame-idle.webp" alt=""/></div><strong>拾图</strong><button className="icon-button" aria-label="关闭菜单" onClick={onClose}><X size={19}/></button></header>
      <nav>{labels.map(({ route, label, Icon }) => <button className={current === route ? "active" : ""} key={route} onClick={() => navigate(route)}><Icon size={20} weight={current === route ? "fill" : "regular"}/><span>{label}</span></button>)}</nav>
      <footer><span className={`ai-status ${aiMode}`}>{aiLabels[aiMode]}</span><button className="text-button" onClick={() => window.appApi.exit()}>退出应用</button></footer>
    </motion.aside>
  </>}</AnimatePresence>;
}
