import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AppSettings, LibraryImage } from "../../shared/types";
import { INGEST_SEQUENCE, PET_FRAME_SOURCES, SUCCESS_SEQUENCE, type PetFrame, type PetFrameStep } from "../pet-animation";

type PetState = "idle" | "drag-valid" | "ingesting" | "saved" | "failed";

const wait = (durationMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
const ingestParticles = [
  { x: -82, y: 72, size: 5, delay: -40, color: "#26d9ff" },
  { x: -58, y: 108, size: 4, delay: -260, color: "#0a84ff" },
  { x: -34, y: 58, size: 3, delay: -410, color: "#69fff0" },
  { x: -12, y: 98, size: 5, delay: -170, color: "#3b9cff" },
  { x: 18, y: 116, size: 3, delay: -350, color: "#26d9ff" },
  { x: 42, y: 68, size: 5, delay: -90, color: "#69fff0" },
  { x: 70, y: 96, size: 4, delay: -300, color: "#0a84ff" },
  { x: 84, y: 48, size: 3, delay: -470, color: "#26d9ff" },
  { x: -70, y: 30, size: 3, delay: -520, color: "#69fff0" },
  { x: 64, y: 26, size: 4, delay: -210, color: "#3b9cff" },
] as const;

export function PetPage() {
  const [state, setState] = useState<PetState>("idle"); const [frame, setFrame] = useState<PetFrame>("idle"); const [message, setMessage] = useState(""); const [settings, setSettings] = useState<AppSettings | null>(null);
  const drag = useRef<{ pointerX: number; pointerY: number; windowX: number; windowY: number } | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    void window.appApi.getSettings().then(setSettings);
    Object.values(PET_FRAME_SOURCES).forEach((source) => { const image = new Image(); image.src = source; });
  }, []);
  const beep = () => { if (!settings?.petSound) return; const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 520; gain.gain.value = settings.petVolume * .08; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .12); };
  const playFrameSequence = async (sequence: readonly PetFrameStep[]) => {
    if (settings?.reducedMotion) { setFrame(sequence[sequence.length - 1].frame); return; }
    for (const step of sequence) { setFrame(step.frame); await wait(step.durationMs); }
  };
  const reset = () => { busy.current = false; setState("idle"); setFrame("idle"); setMessage(""); };

  return <main className={`pet-page ${state}`} onDoubleClick={() => window.appApi.openMain()} onDragOver={(event) => { event.preventDefault(); if (!busy.current) { setState("drag-valid"); setFrame("notice"); } }} onDragLeave={() => { if (!busy.current) { setState("idle"); setFrame("idle"); } }} onDrop={async (event) => {
    event.preventDefault(); const file = event.dataTransfer.files[0]; if (!file || busy.current) return; busy.current = true; setState("ingesting"); setMessage("啊呜…");
    const importOutcome = window.appApi.importDroppedFile(file, "pet").then(
      (value) => ({ ok: true as const, value: value as { image: LibraryImage; duplicate: boolean } }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await playFrameSequence(INGEST_SEQUENCE);
    const outcome = await importOutcome;
    if (!outcome.ok) { setState("failed"); setFrame("idle"); setMessage(outcome.error instanceof Error ? outcome.error.message : "没能吃掉"); await wait(1600); reset(); return; }
    setState("saved"); setMessage(outcome.value.duplicate ? "已经吃过啦" : "收藏好了"); beep(); await playFrameSequence(SUCCESS_SEQUENCE); reset();
  }}><div className="pac-body" title="拖动桌宠，双击打开图库" onPointerDown={async (event) => { event.currentTarget.setPointerCapture(event.pointerId); const [windowX, windowY] = await window.appApi.getPetPosition(); drag.current = { pointerX: event.screenX, pointerY: event.screenY, windowX, windowY }; }} onPointerMove={(event) => { if (!drag.current) return; void window.appApi.movePetTo(drag.current.windowX + event.screenX - drag.current.pointerX, drag.current.windowY + event.screenY - drag.current.pointerY); }} onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }}><img className="pet-sprite" src={PET_FRAME_SOURCES[frame]} alt="" draggable={false}/>{state === "ingesting" && !settings?.reducedMotion && <div className="ingest-effects" data-testid="ingest-effects" aria-hidden="true"><span className="ingest-vortex"/>{ingestParticles.map((particle, index) => <span className="ingest-particle" key={index} style={{ "--particle-x": `${particle.x}px`, "--particle-y": `${particle.y}px`, "--particle-size": `${particle.size}px`, "--particle-delay": `${particle.delay}ms`, "--particle-color": particle.color } as CSSProperties}/>)}</div>}</div>{message && <div className="pet-bubble" role="status">{message}</div>}</main>;
}
