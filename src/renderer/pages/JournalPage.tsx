import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowsOutSimple, ArrowsVertical, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { AppSettings, LibraryImage, WeeklyNote } from "../../shared/types";
import { clampJournalScale, journalCardPosition, journalDayHeight } from "../../shared/journal-layout";
import { journalDecorationColor } from "../../shared/spatial-layout";
import { TopBar } from "../components/TopBar";

const imageUrl = (path: string) => `local-image://asset/${path.replaceAll("\\", "/")}`;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const COLLAPSED_IMAGE_COUNT = 6;

export function mondayOf(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

export function weekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - first.getTime()) / 86400000) + 1) / 7);
}

type CardView = Pick<LibraryImage, "journalX" | "journalY" | "journalScale">;
type CardInteraction = CardView & {
  kind: "move" | "resize";
  startClientX: number;
  startClientY: number;
  moved: boolean;
};

function JournalCard({ image, index, refresh, onOpen, onDragTarget }: { onDragTarget(date: string | null): void; image: LibraryImage; index: number; refresh(): Promise<void>; onOpen(id: string): void }) {
  const [view, setView] = useState<CardView>({ journalX: image.journalX, journalY: image.journalY, journalScale: image.journalScale });
  const viewRef = useRef(view);
  const interaction = useRef<CardInteraction | null>(null);
  const suppressClick = useRef(false);
  const position = journalCardPosition(index, image.hash);

  useEffect(() => {
    const next = { journalX: image.journalX, journalY: image.journalY, journalScale: image.journalScale };
    viewRef.current = next;
    setView(next);
  }, [image.journalX, image.journalY, image.journalScale]);

  const updateView = (next: CardView) => { viewRef.current = next; setView(next); };
  const startInteraction = (event: ReactPointerEvent<HTMLElement>, kind: CardInteraction["kind"]) => {
    const card = event.currentTarget.closest<HTMLElement>(".polaroid") ?? event.currentTarget;
    card.setPointerCapture(event.pointerId);
    interaction.current = { kind, startClientX: event.clientX, startClientY: event.clientY, moved: false, ...viewRef.current };
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const dateAtPoint = (x: number, y: number) => document.elementsFromPoint(x, y).find((element) => element instanceof HTMLElement && element.matches("[data-journal-date]"))?.getAttribute("data-journal-date") ?? null;
  const moveInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    const start = interaction.current;
    if (!start) return;
    const deltaX = event.clientX - start.startClientX;
    const deltaY = event.clientY - start.startClientY;
    const moved = Math.abs(deltaX) + Math.abs(deltaY) > 4;
    interaction.current = { ...start, moved: start.moved || moved };
    suppressClick.current ||= moved;
    if (start.kind === "move") {
      onDragTarget(dateAtPoint(event.clientX, event.clientY));
      updateView({ journalX: start.journalX + deltaX, journalY: start.journalY + deltaY, journalScale: start.journalScale });
    } else {
      updateView({ journalX: start.journalX, journalY: start.journalY, journalScale: clampJournalScale(start.journalScale + (deltaX + deltaY) / 260) });
    }
  };

  const finishInteraction = async (event: ReactPointerEvent<HTMLElement>) => {
    if (!interaction.current) return;
    const completed = interaction.current;
    interaction.current = null;
    onDragTarget(null);
    if (!completed.moved) return;
    const targetDay = completed.kind === "move" ? dateAtPoint(event.clientX, event.clientY) : null;
    const current = viewRef.current;
    await window.appApi.updateImage(image.id, {
      journalX: current.journalX,
      journalY: current.journalY,
      journalScale: current.journalScale,
      ...(targetDay && targetDay !== image.journalDate ? { journalDate: targetDay, journalX: 0, journalY: 0 } : {}),
    });
    await refresh();
  };

  const terms = image.terms.length ? image.terms : [image.categoryName ?? "未分类"];
  return <article
    className={`polaroid ${image.journalDecoration} decor-${journalDecorationColor(image.hash)}`}
    style={{
      left: `calc(${position.column * 49 + 3.5}% + ${position.offsetX}px)`,
      top: position.top,
      width: `${position.widthPercent}%`,
      transform: `translate3d(${view.journalX}px, ${view.journalY}px, 0) rotate(${position.rotation + image.journalRotation}deg) scale(${view.journalScale})`,
    }}
    onPointerDown={(event) => startInteraction(event, "move")}
    onPointerMove={moveInteraction}
    onPointerUp={(event) => void finishInteraction(event)}
    onPointerCancel={() => { interaction.current = null; onDragTarget(null); updateView({ journalX: image.journalX, journalY: image.journalY, journalScale: image.journalScale }); }}
    title="双击查看详情"
    onDoubleClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onOpen(image.id); }}
  >
    <div className="polaroid-photo">
      <img src={imageUrl(image.thumbnailPath)} alt={image.originalName}/>
      <div className="polaroid-terms" onDoubleClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <button className="term-summary" title="复制首个设计术语" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(terms[0]); }}>{terms[0]}{terms.length > 1 ? ` +${terms.length - 1}` : ""}</button>
        <div className="term-popover" role="list" aria-label="完整设计术语">
          {image.terms.length ? image.terms.map((term) => <div className="term-popover-row" role="listitem" key={term}>
            <button title={`复制 ${term}`} onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(term); }}>{term}</button>
            <button className="term-delete" title={`删除 ${term}`} onClick={async (event) => { event.stopPropagation(); await window.appApi.removeTerm(image.id, term); await refresh(); }}><X size={12}/></button>
          </div>) : <div className="term-popover-empty">等待生成设计术语</div>}
        </div>
      </div>
    </div>
    <button onDoubleClick={(event) => event.stopPropagation()} className="journal-resize-handle" aria-label="拖动调整图片大小" title="拖动调整大小" onPointerDown={(event) => startInteraction(event, "resize")}><ArrowsOutSimple size={15}/></button>
  </article>;
}

export function JournalPage({ images, refresh, onOpen, onMenu, settings, onSettings }: { images: LibraryImage[]; refresh(): Promise<void>; onOpen(id: string): void; onMenu(): void; settings: AppSettings; onSettings(value: AppSettings): void }) {
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [note, setNote] = useState<WeeklyNote | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const resize = useRef<{ y: number; height: number } | null>(null);
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return iso(date); }), [monday]);
  const key = iso(monday);

  useEffect(() => { void window.appApi.getWeeklyNote(key).then(setNote); }, [key]);

  const labels = ["周一", "周二", "周三", "周四", "周五", "周末"];
  const groups = [dates.slice(0, 1), dates.slice(1, 2), dates.slice(2, 3), dates.slice(3, 4), dates.slice(4, 5), dates.slice(5, 7)];
  const moveWeek = (delta: number) => { const next = new Date(monday); next.setDate(next.getDate() + delta * 7); setMonday(next); };

  return <main className="journal-page">
    <TopBar onMenu={onMenu} settings={settings} onSettings={onSettings}>
      <div className="week-title"><strong>第 {weekNumber(monday)} 周</strong><span>{dates[0]} 至 {dates[6]}</span></div>
      <div className="week-nav"><button aria-label="上一周" onClick={() => moveWeek(-1)}><CaretLeft size={17}/></button><button onClick={() => setMonday(mondayOf(new Date()))}>今天</button><button aria-label="下一周" onClick={() => moveWeek(1)}><CaretRight size={17}/></button></div>
    </TopBar>
    <section className="week-grid">
      {groups.map((group, index) => {
        const dayImages = images.filter((image) => group.includes(image.journalDate));
        const expanded = expandedDays.has(index);
        const visible = expanded ? dayImages : dayImages.slice(0, COLLAPSED_IMAGE_COUNT);
        return <div key={labels[index]} data-journal-date={group[0]} className={`day-cell day-${index} ${expanded ? "expanded" : ""} ${dragTarget === group[0] ? "drop-target" : ""}`} style={{ minHeight: journalDayHeight(visible.length) }}>
          <header><strong>{labels[index]}</strong>{dragTarget === group[0] && <span role="status" className="drop-hint">移到{labels[index]}</span>}<span>{group.map((date) => date.slice(8)).join("/")}</span></header>
          <div className="polaroid-area">
            {visible.map((image, imageIndex) => <JournalCard key={image.id} image={image} index={imageIndex} refresh={refresh} onOpen={onOpen} onDragTarget={setDragTarget}/>)}
            {dayImages.length > COLLAPSED_IMAGE_COUNT && <button className="more-stack" onClick={() => { const next = new Set(expandedDays); next.has(index) ? next.delete(index) : next.add(index); setExpandedDays(next); }}>{expanded ? "收起" : `还有 ${dayImages.length - COLLAPSED_IMAGE_COUNT} 张`}</button>}
          </div>
        </div>;
      })}
    </section>
    {note && <section className="weekly-note" style={{ height: note.height }}>
      <button className="resize-handle" aria-label="调整笔记高度" onPointerDown={(event) => resize.current = { y: event.clientY, height: note.height }} onPointerMove={(event) => { if (!resize.current) return; setNote({ ...note, height: Math.max(140, resize.current.height + event.clientY - resize.current.y) }); }} onPointerUp={async () => { resize.current = null; await window.appApi.saveWeeklyNote({ ...note, updatedAt: new Date().toISOString() }); }}><ArrowsVertical size={16}/></button>
      <label>本周笔记<textarea value={note.content} onChange={(event) => setNote({ ...note, content: event.target.value })} onBlur={() => window.appApi.saveWeeklyNote({ ...note, updatedAt: new Date().toISOString() })} placeholder="记录这周发现的设计语言…"/></label>
    </section>}
  </main>;
}
