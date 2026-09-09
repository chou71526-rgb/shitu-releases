import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { ArrowsOutCardinal, ArrowCounterClockwise, CheckSquare, Square, Compass, Funnel, Heart, MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import type { AiStatus, AppSettings, Category, LibraryImage } from "../../shared/types";
import { advanceArchiveCameraAlong, archiveCloudPoint, archiveViewVector, projectArchivePoint } from "../../shared/spatial-layout";
import type { ArchivePoint } from "../../shared/spatial-layout";
import { useLibraryFeedback } from "../components/LibraryFeedback";
import { TopBar } from "../components/TopBar";

const imageUrl = (path: string) => `local-image://asset/${path.replaceAll("\\", "/")}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface CameraMotion {
  x: MotionValue<number>;
  y: MotionValue<number>;
  z: MotionValue<number>;
  yaw: MotionValue<number>;
  pitch: MotionValue<number>;
}

function ArchiveImage({ image, point, camera, viewport, selected, refresh, onOpen, onToggleSelected, onTrash }: { onTrash(id: string): Promise<void>; image: LibraryImage; point: ArchivePoint; camera: CameraMotion; viewport: { width: number; height: number }; selected: boolean; refresh(): Promise<void>; onOpen(id: string): void; onToggleSelected(id: string): void }) {
  const initialOffsetX = image.canvasManual ? clamp(image.canvasX, -1_200, 1_200) : 0;
  const initialOffsetY = image.canvasManual ? -clamp(image.canvasY, -1_200, 1_200) : 0;
  const dragOffsetX = useMotionValue(initialOffsetX);
  const dragOffsetY = useMotionValue(initialOffsetY);
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressOpen = useRef(false);
  const inputs: MotionValue<number>[] = [camera.x, camera.y, camera.z, camera.yaw, camera.pitch];
  const projectionInputs: MotionValue<number>[] = [...inputs, dragOffsetX, dragOffsetY];
  const project = (values: number[]) => projectArchivePoint({ x: point.x + values[5], y: point.y + values[6], z: point.z }, { x: values[0], y: values[1], z: values[2], yaw: values[3], pitch: values[4] }, viewport);
  const x = useTransform(projectionInputs, (values: number[]) => project(values).x);
  const y = useTransform(projectionInputs, (values: number[]) => project(values).y);
  const scale = useTransform(projectionInputs, (values: number[]) => project(values).scale);
  const toolbarScale = useTransform(scale, (value) => 1 / value);
  const opacity = useTransform(projectionInputs, (values: number[]) => project(values).opacity);
  const visibility = useTransform(projectionInputs, (values: number[]) => project(values).visible ? "visible" : "hidden");
  const pointerEvents = useTransform(projectionInputs, (values: number[]) => project(values).interactive ? "auto" : "none");
  const zIndex = useTransform(projectionInputs, (values: number[]) => project(values).zIndex);
  const width = Math.round(Math.min(200, Math.max(86, Math.min(image.canvasWidth, 230 * image.width / Math.max(1, image.height)))));

  useEffect(() => { dragOffsetX.set(initialOffsetX); dragOffsetY.set(initialOffsetY); }, [initialOffsetX, initialOffsetY]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, offsetX: dragOffsetX.get(), offsetY: dragOffsetY.get(), moved: false };
    suppressOpen.current = false;
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    const current = project([camera.x.get(), camera.y.get(), camera.z.get(), camera.yaw.get(), camera.pitch.get(), drag.current.offsetX, drag.current.offsetY]);
    const pixelsPerUnit = Math.max(.08, current.perspective);
    dragOffsetX.set(clamp(drag.current.offsetX + dx / pixelsPerUnit, -1_200, 1_200));
    dragOffsetY.set(clamp(drag.current.offsetY - dy / pixelsPerUnit, -1_200, 1_200));
  };
  const finishDrag = async (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    suppressOpen.current = drag.current.moved;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    await window.appApi.updateImage(image.id, { canvasX: dragOffsetX.get(), canvasY: -dragOffsetY.get(), canvasManual: true });
    await refresh();
  };

  return <motion.article
    title="拖动环顾，双击查看详情"
    className={`canvas-image ${selected ? "selected" : ""}`}
    style={{ x, y, scale, opacity, visibility, pointerEvents, zIndex, width, marginLeft: -width / 2, marginTop: -110 }}
    onClick={(event) => { if (suppressOpen.current) { suppressOpen.current = false; return; } if (event.shiftKey) onToggleSelected(image.id); }}
    onDoubleClick={() => { if (!suppressOpen.current) onOpen(image.id); }}
  >
    <img src={imageUrl(image.originalPath)} alt={image.originalName} draggable={false} decoding="async"/>
    <motion.div className="image-hover-actions" style={{ scale: toolbarScale, originX: 1, originY: 0 }} onDoubleClick={(event) => event.stopPropagation()}>
      <button title="移动图片" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={(event) => void finishDrag(event)} onPointerCancel={(event) => void finishDrag(event)} onClick={(event) => event.stopPropagation()}><ArrowsOutCardinal size={15}/></button>
      <button title="收藏" onClick={async (event) => { event.stopPropagation(); await window.appApi.updateImage(image.id, { favorite: !image.favorite }); await refresh(); }}><Heart size={15} weight={image.favorite ? "fill" : "regular"}/></button>
      <button title={selected ? "取消选择" : "选择"} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); onToggleSelected(image.id); }}>{selected ? <CheckSquare size={18} weight="fill"/> : <Square size={18}/>}</button>
      <button className="danger" title="删除" onClick={async (event) => { event.stopPropagation(); await onTrash(image.id); }}><Trash size={15}/></button>
    </motion.div>
    <div className="image-meta"><span>{image.categoryName ?? (image.aiStatus === "analyzing" ? "正在辨认" : "未分类")}</span>{image.terms[0] && <small>{image.terms[0]}{image.terms.length > 1 ? ` +${image.terms.length - 1}` : ""}</small>}</div>
  </motion.article>;
}

export function LibraryPage({ images, refresh, onOpen, onMenu, settings, onSettings, active = true }: { active?: boolean; images: LibraryImage[]; refresh(): Promise<void>; onOpen(id: string): void; onMenu(): void; settings: AppSettings; onSettings(value: AppSettings): void }) {
  const { notify } = useLibraryFeedback();
  const [view, setView] = useState<"space" | "grid">("space");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | "">("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [cameraDragging, setCameraDragging] = useState(false);
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight - 64 }));
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraVelocity = useRef(0);
  const cameraDrag = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: boolean } | null>(null);
  const cameraTargetYaw = useRef(0);
  const cameraTargetPitch = useRef(0);
  const cameraTravelDirection = useRef<ArchivePoint>({ x: 0, y: 0, z: 1 });
  const lastWheelAt = useRef(0);
  const lastInteraction = useRef(performance.now());
  const cameraX = useMotionValue(0);
  const cameraY = useMotionValue(0);
  const cameraZ = useMotionValue(0);
  const cameraYaw = useMotionValue(0);
  const cameraPitch = useMotionValue(0);
  const camera = useMemo<CameraMotion>(() => ({ x: cameraX, y: cameraY, z: cameraZ, yaw: cameraYaw, pitch: cameraPitch }), []);

  useEffect(() => { if (active) void window.appApi.categories().then(setCategories); }, [active]);
  useEffect(() => {
    const updateViewport = () => setViewport({ width: innerWidth, height: innerHeight - 64 });
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  useEffect(() => {
    if (!images.some((image) => image.aiStatus === "pending" || image.aiStatus === "waiting-retry" || image.aiStatus === "analyzing")) return;
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, [images, refresh]);

  const shown = useMemo(() => images.filter((image) => (!query || [image.originalName, image.note, image.categoryName ?? "", ...image.terms].some((value) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase()))) && (!categoryId || image.categoryId === categoryId) && (!favoriteOnly || image.favorite) && (!aiStatus || image.aiStatus === aiStatus)), [images, query, categoryId, favoriteOnly, aiStatus]);
  const points = useMemo(() => shown.map((image, index) => archiveCloudPoint(image.hash, index)), [shown]);

  const resetCamera = () => {
    cameraVelocity.current = 0;
    cameraTargetYaw.current = 0; cameraTargetPitch.current = 0;
    cameraTravelDirection.current = { x: 0, y: 0, z: 1 };
    cameraX.set(0); cameraY.set(0); cameraZ.set(0); cameraYaw.set(0); cameraPitch.set(0);
  };

  useEffect(() => {
    if (!active) return;
    const request = sessionStorage.getItem("library-filter-request");
    if (request === "failed") {
      sessionStorage.removeItem("library-filter-request");
      setQuery(""); setCategoryId(""); setFavoriteOnly(false); setAiStatus("failed"); setView("grid");
    }
  }, [active]);
  useEffect(resetCamera, [query, categoryId, favoriteOnly, aiStatus]);
  useEffect(() => {
    if (!active || view !== "space") return;
    lastInteraction.current = performance.now();
    let frame = 0;
    let previous = performance.now();
    const update = (now: number) => {
      const delta = Math.min(2.2, Math.max(.25, (now - previous) / 16.667));
      previous = now;
      const idleDrift = !settings.reducedMotion && now - lastInteraction.current > 2600 ? .028 : 0;
      const angleEase = 1 - Math.pow(.9, delta);
      cameraYaw.set(cameraYaw.get() + (cameraTargetYaw.current - cameraYaw.get()) * angleEase);
      cameraPitch.set(cameraPitch.get() + (cameraTargetPitch.current - cameraPitch.get()) * angleEase);
      const movement = cameraVelocity.current * delta;
      if (Math.abs(movement) > .001) {
        const next = advanceArchiveCameraAlong({ x: cameraX.get(), y: cameraY.get(), z: cameraZ.get(), yaw: cameraYaw.get(), pitch: cameraPitch.get() }, cameraTravelDirection.current, movement);
        cameraX.set(next.x); cameraY.set(next.y); cameraZ.set(next.z);
      }
      if (idleDrift) {
        const drift = archiveViewVector({ yaw: cameraYaw.get(), pitch: 0 });
        cameraX.set(cameraX.get() + drift.x * idleDrift * delta);
        cameraZ.set(cameraZ.get() + drift.z * idleDrift * delta);
      }
      cameraVelocity.current *= Math.pow(.95, delta);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); cameraVelocity.current = 0; };
  }, [settings.reducedMotion, active, view]);

  useEffect(() => {
    if (!active || view !== "space") return;
    const keyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); lastInteraction.current = performance.now();
      if (event.key === "ArrowUp") cameraVelocity.current = clamp(cameraVelocity.current + 12, -36, 36);
      if (event.key === "ArrowDown") cameraVelocity.current = clamp(cameraVelocity.current - 12, -36, 36);
      if (event.key === "ArrowUp" || event.key === "ArrowDown") cameraTravelDirection.current = archiveViewVector({ yaw: cameraYaw.get(), pitch: cameraPitch.get() });
      if (event.key === "ArrowLeft") cameraTargetYaw.current += .08;
      if (event.key === "ArrowRight") cameraTargetYaw.current -= .08;
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [active, view]);

  const reportImport = async (operation: () => Promise<unknown>) => {
    const before = new Set((await window.appApi.listImages()).map((item: LibraryImage) => item.id));
    try { await operation(); } catch { notify("导入未全部完成，请检查文件后重试"); await refresh(); return; }
    const added: LibraryImage[] = (await window.appApi.listImages()).filter((item: LibraryImage) => !before.has(item.id));
    await refresh();
    if (added.length) notify(`已导入 ${added.length} 张${added.some((item) => ["pending", "analyzing", "waiting-retry"].includes(item.aiStatus)) ? "，正在排队分析" : ""}`);
    else notify("未新增图片，文件可能已在图库中或已取消选择");
  };
  const trashImages = async (ids: string[]) => {
    for (const id of ids) await window.appApi.trashImage(id);
    setSelected(new Set()); await refresh();
    notify(`已将 ${ids.length} 张图片移至最近删除`, async () => { for (const id of ids) await window.appApi.restoreImage(id); await refresh(); });
  };
  const importFiles = (files: FileList) => reportImport(async () => { for (const file of Array.from(files)) await window.appApi.importDroppedFile(file); });
  const statusLabels: Record<string, string> = { completed: "已分类", analyzing: "分析中", "waiting-retry": "等待重试", failed: "分析失败", "local-only": "仅本地" };
  const toggleSelected = (id: string) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next); };
  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    const now = performance.now();
    const cameraState = { x: cameraX.get(), y: cameraY.get(), z: cameraZ.get(), yaw: cameraYaw.get(), pitch: cameraPitch.get() };
    if (now - lastWheelAt.current > 180 || Math.abs(cameraVelocity.current) < .4) cameraTravelDirection.current = archiveViewVector(cameraState);
    lastWheelAt.current = now;
    lastInteraction.current = now;
    cameraVelocity.current = clamp(cameraVelocity.current - Math.sign(event.deltaY) * 6, -36, 36);
  };

  return <main className="library-page" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void importFiles(event.dataTransfer.files); }} onPaste={async (event) => {
    const item = [...event.clipboardData.items].find((value) => value.type.startsWith("image/")); const file = item?.getAsFile(); if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer()); await reportImport(() => window.appApi.importImage({ bytes, originalName: `截图-${Date.now()}.png`, source: "clipboard" }));
  }}>
    <TopBar onMenu={onMenu} settings={settings} onSettings={onSettings}><div className="search-shell"><MagnifyingGlass size={18}/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setQuery("")} placeholder="搜索图片、分类或设计术语"/><button className={categoryId || favoriteOnly || aiStatus ? "filter-active" : ""} aria-label="筛选" title="筛选" onClick={() => setFiltersOpen(!filtersOpen)}><Funnel size={17}/></button><button aria-label="导入图片" title="导入图片" onClick={() => reportImport(() => window.appApi.pickImages())}><Plus size={18}/></button></div></TopBar>
    {filtersOpen && <div className="filter-panel"><label>主分类<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">全部</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>AI 状态<select value={aiStatus} onChange={(event) => setAiStatus(event.target.value as AiStatus | "")}><option value="">全部</option><option value="completed">已分类</option><option value="analyzing">分析中</option><option value="waiting-retry">等待重试</option><option value="failed">失败</option><option value="local-only">仅本地</option></select></label><label className="check-row"><input type="checkbox" checked={favoriteOnly} onChange={(event) => setFavoriteOnly(event.target.checked)}/>只看收藏</label><button onClick={() => { setCategoryId(""); setFavoriteOnly(false); setAiStatus(""); }}>清除</button></div>}
    <div className="library-view-bar"><div role="group" aria-label="图库视图"><button aria-pressed={view === "space"} onClick={() => setView("space")}>空间</button><button aria-pressed={view === "grid"} onClick={() => setView("grid")}>网格</button></div><span role="status">{shown.length} 张图片</span>{query && <button onClick={() => setQuery("")}>搜索：{query} ×</button>}{categoryId && <button onClick={() => setCategoryId("")}>{categories.find((item) => item.id === categoryId)?.name} ×</button>}{favoriteOnly && <button onClick={() => setFavoriteOnly(false)}>只看收藏 ×</button>}{aiStatus && <button onClick={() => setAiStatus("")}>{statusLabels[aiStatus]} ×</button>}</div>
    {view === "grid" && <section className="library-grid" aria-label="网格图库">{shown.map((item) => <article className={selected.has(item.id) ? "selected" : ""} key={item.id} onDoubleClick={() => onOpen(item.id)} title="双击查看详情"><img src={imageUrl(item.thumbnailPath)} alt={item.originalName}/><div className="grid-image-actions" onDoubleClick={(event) => event.stopPropagation()}><button aria-label={selected.has(item.id) ? "取消选择" : "选择"} aria-pressed={selected.has(item.id)} onClick={() => toggleSelected(item.id)}>{selected.has(item.id) ? <CheckSquare size={18} weight="fill"/> : <Square size={18}/>}</button><button aria-label="收藏" onClick={async () => { await window.appApi.updateImage(item.id, { favorite: !item.favorite }); await refresh(); }}><Heart size={18} weight={item.favorite ? "fill" : "regular"}/></button><button className="danger" aria-label="删除" onClick={() => trashImages([item.id])}><Trash size={18}/></button></div><span>{item.originalName}</span></article>)}{shown.length === 0 && <p>没有符合条件的图片，请清除搜索或筛选。</p>}</section>}
    <section hidden={view !== "space"}
      className={`canvas-viewport archive-camera ${cameraDragging ? "is-looking" : ""}`}
      onWheel={handleWheel}
      onPointerDown={(event) => { if ((event.target as HTMLElement).closest("button,input,select,textarea")) return; cameraVelocity.current = 0; cameraDrag.current = { x: event.clientX, y: event.clientY, yaw: cameraTargetYaw.current, pitch: cameraTargetPitch.current, moved: false }; lastInteraction.current = performance.now(); }}
      onPointerMove={(event) => { if (!cameraDrag.current) return; const dx = event.clientX - cameraDrag.current.x; const dy = event.clientY - cameraDrag.current.y; if (!cameraDrag.current.moved && dx * dx + dy * dy <= 16) return; if (!cameraDrag.current.moved) { cameraDrag.current.moved = true; event.currentTarget.setPointerCapture(event.pointerId); setCameraDragging(true); } cameraTargetYaw.current = cameraDrag.current.yaw - dx * .002; cameraTargetPitch.current = clamp(cameraDrag.current.pitch + dy * .002, -.78, .78); }}
      onPointerUp={(event) => { cameraDrag.current = null; setCameraDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { cameraDrag.current = null; setCameraDragging(false); }}
    >
      <div className="canvas-depth-haze" aria-hidden="true"/>
      <div className="canvas-world">
        {shown.map((image, index) => <ArchiveImage key={image.id} image={image} point={points[index]} camera={camera} viewport={viewport} selected={selected.has(image.id)} refresh={refresh} onOpen={onOpen} onToggleSelected={toggleSelected} onTrash={(id) => trashImages([id])}/>) }
      </div>
      {shown.length === 0 && <div className="empty-state"><div className="brand-mark large"><img src="./pet/frame-idle.webp" alt=""/></div><h1>{images.length ? "没有符合条件的图片" : "把第一张灵感喂给我"}</h1><p>{images.length ? "清除搜索或筛选后再看看。" : "拖到桌宠、拖进这里，或在窗口中按 Ctrl+V。"}</p>{!images.length && <button className="primary" onClick={() => reportImport(() => window.appApi.pickImages())}>选择图片</button>}</div>}
    </section>
    {view === "space" && shown.length > 0 && <div className="archive-navigation" aria-label="空间浏览帮助"><Compass size={17}/><div><strong>拖动调整视角</strong><span>滚轮沿当前方向移动</span></div><button onClick={resetCamera} aria-label="回到起点" title="回到起点"><ArrowCounterClockwise size={17}/></button></div>}
    {selected.size > 0 && <div className="batch-bar"><strong>已选择 {selected.size} 张</strong><select defaultValue="" onChange={async (event) => { if (!event.target.value) return; for (const id of selected) await window.appApi.updateImage(id, { categoryId: event.target.value }); setSelected(new Set()); await refresh(); }}><option value="">修改分类</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><button onClick={async () => { for (const id of selected) await window.appApi.updateImage(id, { favorite: true }); setSelected(new Set()); await refresh(); }}>收藏</button><button className="danger" onClick={() => trashImages([...selected])}>删除</button><button onClick={() => setSelected(new Set())}>取消</button></div>}
  </main>;
}
