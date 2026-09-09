export const PET_FRAME_SOURCES = {
  idle: "./pet/frame-idle.webp",
  notice: "./pet/frame-notice.webp",
  enter: "./pet/frame-enter.webp",
  intake: "./pet/frame-intake.webp",
  close: "./pet/frame-close.webp",
  squash: "./pet/frame-squash.webp",
  rebound: "./pet/frame-rebound.webp",
  saved: "./pet/frame-saved.webp",
  successRise: "./pet/frame-success-rise.webp",
  success: "./pet/frame-success.webp",
} as const;

export type PetFrame = keyof typeof PET_FRAME_SOURCES;
export type PetFrameStep = { frame: PetFrame; durationMs: number };

export const INGEST_SEQUENCE: readonly PetFrameStep[] = [
  { frame: "notice", durationMs: 70 },
  { frame: "enter", durationMs: 110 },
  { frame: "intake", durationMs: 105 },
  { frame: "close", durationMs: 100 },
  { frame: "squash", durationMs: 145 },
];

export const SUCCESS_SEQUENCE: readonly PetFrameStep[] = [
  { frame: "rebound", durationMs: 120 },
  { frame: "saved", durationMs: 220 },
  { frame: "successRise", durationMs: 140 },
  { frame: "success", durationMs: 720 },
];
