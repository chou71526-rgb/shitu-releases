export interface JournalCardPosition {
  column: number;
  top: number;
  offsetX: number;
  widthPercent: number;
  rotation: number;
}

const CARD_ROW_HEIGHT = 236;
const DAY_HEADER_HEIGHT = 70;

function seededNumber(seed: string): number {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 2246822507);
  value ^= value >>> 13;
  return value >>> 0;
}

export function journalCardPosition(index: number, seed = String(index)): JournalCardPosition {
  const offsetX = (seededNumber(`${seed}:${index}:x`) % 17) - 8;
  const offsetY = (seededNumber(`${seed}:${index}:y`) % 9) - 4;
  const widthPercent = 38 + (seededNumber(`${seed}:${index}:width`) % 9);
  const rotation = ((seededNumber(`${seed}:${index}:rotation`) % 49) - 24) / 10;
  return {
    column: index % 2,
    top: 24 + Math.floor(index / 2) * CARD_ROW_HEIGHT + offsetY,
    offsetX,
    widthPercent,
    rotation,
  };
}

export function journalDayHeight(imageCount: number): number {
  const rows = Math.max(1, Math.ceil(imageCount / 2));
  return Math.max(360, DAY_HEADER_HEIGHT + rows * CARD_ROW_HEIGHT);
}

export function clampJournalScale(scale: number): number {
  return Math.max(0.55, Math.min(2.25, Number(scale.toFixed(2))));
}
