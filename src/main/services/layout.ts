export interface Point { x: number; y: number; }

export function seededPoint(seed: string, index: number): Point {
  let value = 2166136261;
  for (const char of `${seed}:${index}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  const distance = Math.ceil(index / 2);
  const column = index === 0 ? 0 : distance * (index % 2 === 1 ? 1 : -1);
  const lanes = [-80, 90, -170, 180, 15] as const;
  const jitterY = ((value >>> 16) % 25) - 12;
  return { x: column * 350, y: lanes[index % lanes.length] + jitterY };
}

export function journalDecoration(seed: string): { rotation: number; decoration: string; x: number; y: number } {
  let total = 0;
  for (const char of seed) total = (total * 31 + char.charCodeAt(0)) >>> 0;
  const decorations = ["pin-amber", "pin-coral", "pin-cobalt", "tape-mint", "tape-blue", "tape-rose", "sticker-star", "sticker-flower", "paperclip"];
  return { rotation: 0, decoration: decorations[total % decorations.length], x: 0, y: 0 };
}

export function visibleInViewport(item: { x: number; y: number; width: number; height: number }, viewport: { x: number; y: number; width: number; height: number }, buffer = 300): boolean {
  return item.x + item.width >= viewport.x - buffer && item.x <= viewport.x + viewport.width + buffer && item.y + item.height >= viewport.y - buffer && item.y <= viewport.y + viewport.height + buffer;
}
