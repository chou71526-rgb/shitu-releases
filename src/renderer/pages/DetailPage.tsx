import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, FolderOpen, Heart, MagnifyingGlass, Trash, X } from "@phosphor-icons/react";
import type { AppSettings, Category, LibraryImage } from "../../shared/types";
import { balanceMasonryColumns } from "../../shared/masonry-layout";
import { useLibraryFeedback } from "../components/LibraryFeedback";
import { TopBar } from "../components/TopBar";

const imageUrl = (path: string) => `local-image://asset/${path.replaceAll("\\", "/")}`;

function RelatedCard({ item, onOpen }: { item: LibraryImage; onOpen(id: string): void }) {
  return <button className="related-card" onDoubleClick={() => onOpen(item.id)} title="双击查看详情">
    <span className="related-image-frame"><img src={imageUrl(item.originalPath)} alt={item.originalName} loading="lazy" decoding="async"/></span>
    <span className="related-card-meta"><strong>{item.terms[0] ?? item.categoryName ?? "未分类"}</strong>{item.terms.length > 1 && <small>+{item.terms.length - 1} 个术语</small>}</span>
  </button>;
}

export function DetailPage({ id, onOpen, onBack, onDeleted, onRestored, onMenu, settings, onSettings }: { id: string; onOpen(id: string): void; onBack(): void; onDeleted(): Promise<void>; onRestored?(): Promise<void>; onMenu(): void; settings: AppSettings; onSettings(value: AppSettings): void }) {
  const { notify } = useLibraryFeedback();
  const [saveState, setSaveState] = useState("");
  const [copied, setCopied] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRevision = useRef(0);
  const currentId = useRef(id);
  currentId.current = id;
  const [zoomMode, setZoomMode] = useState<"fit" | "original">("fit");
  const [zoomReset, setZoomReset] = useState(0);
  const [image, setImage] = useState<LibraryImage | null>(null);
  const [related, setRelated] = useState<LibraryImage[]>([]);
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [term, setTerm] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const load = async () => {
    const [nextImage, nextRelated, nextCategories, nextLibrary] = await Promise.all([
      window.appApi.getImage(id), window.appApi.recommendations(id), window.appApi.categories(), window.appApi.listImages(),
    ]);
    setImage(nextImage); setRelated(nextRelated); setCategories(nextCategories); setLibraryImages(nextLibrary);
  };
  useEffect(() => { setDetailSearch(""); void load(); }, [id]);

  const searchResults = useMemo(() => {
    const query = detailSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    return libraryImages.filter((item) => item.id !== id && [item.originalName, item.note, item.categoryName ?? "", ...item.terms].some((value) => value.toLocaleLowerCase().includes(query))).slice(0, 8);
  }, [detailSearch, id, libraryImages]);

  useEffect(() => {
    if (!zoomOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setZoomOpen(false); setZoom(1); setZoomMode("fit"); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [zoomOpen]);
  useEffect(() => { setSaveState(""); setCopied(""); return () => { if (copyTimer.current) clearTimeout(copyTimer.current); }; }, [id]);

  if (!image) return <div className="loading">正在打开图片…</div>;
  const update = async (patch: unknown) => setImage(await window.appApi.updateImage(id, patch));
  const isTallImage = image.height / Math.max(1, image.width) > 1.45;
  const railRelated = related.filter((_, index) => index % 3 === 0);
  const railColumns = balanceMasonryColumns(railRelated, 2);
  const feedRelated = related.filter((_, index) => index % 3 !== 0);

  return <main className="detail-page">
    <TopBar onMenu={onMenu} settings={settings} onSettings={onSettings}>
      <button className="icon-button detail-back" onClick={onBack} aria-label="返回"><ArrowLeft size={19}/></button>
      <div className="search-shell detail-search-shell">
        <MagnifyingGlass size={18}/>
        <input value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} onKeyDown={(event) => event.key === "Escape" && setDetailSearch("")} placeholder="搜索本地图片、分类或设计术语"/>
        {detailSearch && <button className="search-clear" onClick={() => setDetailSearch("")} aria-label="清除搜索"><X size={16}/></button>}
        {detailSearch && <div className="detail-search-results">{searchResults.length ? searchResults.map((item) => <button key={item.id} onClick={() => { setDetailSearch(""); onOpen(item.id); }}><img src={imageUrl(item.thumbnailPath)} alt=""/><span><strong>{item.originalName}</strong><small>{item.categoryName ?? item.terms[0] ?? "未分类"}</small></span></button>) : <p>没有找到本地图片</p>}</div>}
      </div>
    </TopBar>

    <section className="detail-layout">
      <div className="detail-primary-stream">
        <article className="selected-panel">
        <div className={`detail-media-column ${isTallImage ? "is-scrollable" : ""}`} tabIndex={isTallImage ? 0 : undefined} title={isTallImage ? "长图可上下滚动" : undefined}>
          <motion.img layoutId={`image-${id}`} className="detail-image" src={imageUrl(image.originalPath)} alt={image.originalName} onClick={() => { setZoomMode("fit"); setZoom(1); setZoomReset((value) => value + 1); setZoomOpen(true); }}/>
        </div>
        <aside className="image-info">
          <div className="info-actions"><button onClick={() => update({ favorite: !image.favorite })}><Heart size={17} weight={image.favorite ? "fill" : "regular"}/>{image.favorite ? "已收藏" : "收藏"}</button><button onClick={() => window.appApi.showImageInFolder(id)}><FolderOpen size={17}/>在文件夹中显示</button><button className="danger" onClick={async () => { await window.appApi.trashImage(id); notify("已移至最近删除", async () => { await window.appApi.restoreImage(id); await onRestored?.(); }); await onDeleted(); }}><Trash size={17}/>删除</button></div>
          <label>主分类<select value={image.categoryId ?? ""} onChange={(event) => update({ categoryId: event.target.value || null })}><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div><label>设计术语</label><div className="term-list">{image.terms.map((value) => <span key={value} className="term"><button title="复制" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(value); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(""), 1800); } catch { notify("复制失败，请重试"); } }}>{copied === value ? "已复制" : value}</button><button title="删除" aria-label={`删除 ${value}`} onClick={async () => { await window.appApi.removeTerm(id, value); await load(); }}><X size={13}/></button></span>)}</div><div className="term-add"><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="添加术语"/><button onClick={async () => { if (!term.trim()) return; await window.appApi.addTerm(id, term); setTerm(""); await load(); }}>添加</button></div></div>
          <label>私人笔记<span className="save-feedback" role="status">{saveState}</span><textarea value={image.note} onChange={(event) => { noteRevision.current += 1; setImage({ ...image, note: event.target.value }); setSaveState("待保存"); }} onBlur={async () => { const revision = noteRevision.current; setSaveState("保存中…"); try { await window.appApi.updateImage(id, { note: image.note }); if (currentId.current === id && revision === noteRevision.current) setSaveState("已保存"); } catch { if (currentId.current === id) setSaveState("保存失败，请重新点击输入框后重试"); } }}/></label>
          <div className="analysis-row" role="status"><span>{isAnalyzing ? "正在排队分析，失败后会逐步延长等待时间" : image.aiStatus === "failed" ? image.aiError : image.aiStatus === "waiting-retry" ? `${image.aiError ?? "等待重新分析"}${image.aiNextRetryAt ? `，预计 ${new Date(image.aiNextRetryAt).toLocaleTimeString()} 继续` : ""}` : image.aiStatus === "completed" ? "AI 分析已完成" : image.aiStatus === "waiting-confirmation" ? "等待你确认发送给 Gemini" : image.aiStatus === "local-only" ? "AI 已关闭，图片仅保存在本机" : "等待 AI 分析"}</span><button disabled={isAnalyzing} onClick={async () => { setIsAnalyzing(true); try { setImage(await window.appApi.analyzeImage(id)); await load(); } finally { setIsAnalyzing(false); } }}>{isAnalyzing ? "分析中…" : "重新分析"}</button></div>
        </aside>
        </article>

        {feedRelated.length > 0 && <section className="detail-related-feed" aria-label="更多相关灵感"><div className="detail-masonry">{feedRelated.map((item) => <RelatedCard key={item.id} item={item} onOpen={onOpen}/>)}</div></section>}
      </div>

      <aside className="related related-rail" aria-label="相关灵感">{railRelated.length ? <div className="rail-grid">{railColumns.filter((column) => column.length).map((column, columnIndex) => <div className="rail-column" key={columnIndex}>{column.map((item) => <RelatedCard key={item.id} item={item} onOpen={onOpen}/>)}</div>)}</div> : <p className="muted">图库中还没有足够相似的图片。</p>}</aside>
    </section>

    {zoomOpen && <div className="zoom-viewer" onClick={() => { setZoomOpen(false); setZoom(1); }} onWheel={(event) => { event.stopPropagation(); setZoom(Math.max(.5, Math.min(5, zoom - event.deltaY * .002))); }}><button aria-label="关闭大图" onClick={() => { setZoomOpen(false); setZoom(1); }}><X size={20}/></button><div className="zoom-controls" onClick={(event) => event.stopPropagation()}><button aria-pressed={zoomMode === "fit"} onClick={() => { setZoomMode("fit"); setZoom(1); setZoomReset((value) => value + 1); }}>适应窗口</button><button aria-pressed={zoomMode === "original"} onClick={() => { setZoomMode("original"); setZoom(1); setZoomReset((value) => value + 1); }}>原始尺寸</button></div><motion.img key={zoomReset} className={zoomMode === "original" ? "original-size" : ""} width={zoomMode === "original" ? image.width : undefined} height={zoomMode === "original" ? image.height : undefined} drag dragMomentum={false} onClick={(event) => event.stopPropagation()} style={{ scale: zoom }} src={imageUrl(image.originalPath)} alt={image.originalName}/><span>{zoomMode === "fit" ? "适应窗口 · " : "原始尺寸 · "}{Math.round(zoom * 100)}%</span></div>}
  </main>;
}
