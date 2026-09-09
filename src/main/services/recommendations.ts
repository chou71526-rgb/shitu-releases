import type { LibraryImage } from "../../shared/types.js";

function colorDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 1;
  const values = (color: string) => [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const [ar, ag, ab] = values(a); const [br, bg, bb] = values(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2) / 441.67;
}

export function recommendationScore(source: LibraryImage, candidate: LibraryImage): number {
  if (source.id === candidate.id || source.hash === candidate.hash || candidate.deletedAt) return Number.NEGATIVE_INFINITY;
  const sharedTerms = source.terms.filter((term) => candidate.terms.includes(term)).length;
  const category = source.categoryId && source.categoryId === candidate.categoryId ? 50 : 0;
  const color = (1 - colorDistance(source.dominantColor, candidate.dominantColor)) * 12;
  const brightness = source.brightness !== null && candidate.brightness !== null ? (1 - Math.abs(source.brightness - candidate.brightness)) * 8 : 0;
  const aspectA = source.width / source.height; const aspectB = candidate.width / candidate.height;
  const composition = Math.max(0, 1 - Math.abs(aspectA - aspectB) / 2) * 8;
  const days = Math.abs(new Date(source.importedAt).getTime() - new Date(candidate.importedAt).getTime()) / 86_400_000;
  const recency = Math.max(0, 5 - days / 30);
  return category + sharedTerms * 18 + color + brightness + composition + recency;
}

export function recommend(source: LibraryImage, candidates: LibraryImage[], limit = 30): LibraryImage[] {
  return candidates.map((image) => ({ image, score: recommendationScore(source, image) }))
    .filter((item) => item.score >= 18).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.image);
}
