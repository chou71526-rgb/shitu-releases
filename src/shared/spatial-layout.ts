export interface SpatialPlacement {
  z: number;
  rotateX: number;
  rotateY: number;
  opacity: number;
  scale: number;
}

export interface SpatialCanvasItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpatialCanvasFit {
  pan: { x: number; y: number };
  zoom: number;
}

const DEPTH_BANDS = [60, -40, -130, -220, -80, -180, -300] as const;
const DECORATION_COLORS = ["coral", "cobalt", "mint", "violet", "rose", "lemon", "sky", "tangerine"] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export interface CompactSpatialSlot {
  page: number;
  pageSize: number;
  x: number;
  y: number;
}

export interface DepthLayerStyle {
  opacity: number;
  scale: number;
  zIndex: number;
  interactive: boolean;
}

export interface ArchivePoint {
  x: number;
  y: number;
  z: number;
}

export interface ArchiveCamera {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface ArchiveProjection {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  perspective: number;
  depth: number;
  visible: boolean;
  interactive: boolean;
  zIndex: number;
}

export function archiveViewVector(camera: Pick<ArchiveCamera, "yaw" | "pitch">): ArchivePoint {
  const cosPitch = Math.cos(camera.pitch);
  return {
    x: Math.sin(camera.yaw) * cosPitch,
    y: Math.sin(camera.pitch),
    z: Math.cos(camera.yaw) * cosPitch,
  };
}

function normalizeArchiveVector(vector: ArchivePoint): ArchivePoint {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

export function archiveCloudPoint(seed: string, index: number): ArchivePoint {
  const hash = stableHash(`${seed}:${index}:archive`);
  const goldenAngle = 2.399963229728653;
  const angle = index * goldenAngle + ((hash & 255) / 255 - .5) * .42;
  const radius = 150 + ((hash >>> 8) % 360);
  const x = Math.round(Math.cos(angle) * radius + (((hash >>> 19) % 121) - 60));
  const y = Math.round(Math.sin(angle * 1.43) * 220 + (((hash >>> 15) % 91) - 45) + 72);
  const z = Math.round(320 + index * 92 + ((hash >>> 23) % 73) - 36);
  return { x, y, z };
}

export function archiveCloudDepth(imageCount: number): number {
  return Math.max(1_800, 740 + Math.max(1, imageCount) * 125);
}

export function advanceArchiveCamera(camera: ArchiveCamera, distance: number, verticalLimit = 700): ArchiveCamera {
  return advanceArchiveCameraAlong(camera, archiveViewVector(camera), distance, verticalLimit);
}

export function advanceArchiveCameraAlong(camera: ArchiveCamera, direction: ArchivePoint, distance: number, verticalLimit = 700): ArchiveCamera {
  const normalized = normalizeArchiveVector(direction);
  return {
    ...camera,
    x: camera.x + normalized.x * distance,
    y: Math.max(-verticalLimit, Math.min(verticalLimit, camera.y + normalized.y * distance)),
    z: camera.z + normalized.z * distance,
  };
}

export function projectArchivePoint(point: ArchivePoint, camera: ArchiveCamera, viewport: { width: number; height: number }): ArchiveProjection {
  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const dz = point.z - camera.z;
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const x1 = cosYaw * dx - sinYaw * dz;
  const z1 = sinYaw * dx + cosYaw * dz;
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const y2 = cosPitch * dy - sinPitch * z1;
  const z2 = sinPitch * dy + cosPitch * z1;
  const focal = Math.min(viewport.width, viewport.height) * 1.05;
  const perspective = focal / Math.max(1, z2);
  const x = x1 * perspective;
  const y = -y2 * perspective;
  const scale = Number(Math.max(.06, Math.min(7, 560 / Math.max(1, z2))).toFixed(4));
  const farFade = Math.max(0, Math.min(1, (3_100 - z2) / 900));
  const nearFade = Math.max(0, Math.min(1, (z2 - 12) / 70));
  const opacity = Number((farFade * nearFade).toFixed(4));
  const visible = z2 > 12 && z2 < 3_100 && Math.abs(x) < viewport.width * .85 && Math.abs(y) < viewport.height * .85;
  const interactive = visible && z2 > 24 && scale >= .6 && opacity > .3;
  return { x, y, scale, opacity: visible ? opacity : 0, perspective, depth: z2, visible, interactive, zIndex: Math.max(1, Math.round(3_500 - z2)) };
}

export function compactSpatialSlot(index: number, viewportWidth: number, viewportHeight: number): CompactSpatialSlot {
  const columns = viewportWidth >= 1_100 ? 4 : viewportWidth >= 760 ? 3 : 2;
  const rows = viewportHeight >= 620 ? 3 : 2;
  const pageSize = columns * rows;
  const slot = index % pageSize;
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const usableWidth = Math.min(1_040, Math.max(420, viewportWidth - 240));
  const usableHeight = Math.min(516, Math.max(260, viewportHeight - 210));
  const x = -usableWidth / 2 + column * (usableWidth / (columns - 1));
  const y = -usableHeight / 2 + row * (usableHeight / (rows - 1));
  const stagger = ((stableHash(`slot:${index}`) % 25) - 12);
  return { page: Math.floor(index / pageSize), pageSize, x: Math.round(x), y: Math.round(y + stagger) };
}

export function depthPageCount(imageCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(imageCount / Math.max(1, pageSize)));
}

export function depthLayerStyle(relativePage: number): DepthLayerStyle {
  if (relativePage < 0 || relativePage > 2) return { opacity: 0, scale: relativePage < 0 ? 1.16 : 0.38, zIndex: 0, interactive: false };
  if (relativePage === 0) return { opacity: 1, scale: 1, zIndex: 300, interactive: true };
  if (relativePage === 1) return { opacity: 0.32, scale: 0.72, zIndex: 200, interactive: false };
  return { opacity: 0.12, scale: 0.52, zIndex: 100, interactive: false };
}

export function journalDecorationColor(seed: string): typeof DECORATION_COLORS[number] {
  return DECORATION_COLORS[stableHash(seed) % DECORATION_COLORS.length];
}

export function spatialPlacement(seed: string, index: number, _x: number): SpatialPlacement {
  const hash = stableHash(`${seed}:${index}`);
  const z = DEPTH_BANDS[index % DEPTH_BANDS.length] + ((hash >>> 8) % 41) - 20;
  const opacity = Number(Math.max(0.82, Math.min(1, 0.9 + z / 3_000)).toFixed(3));
  const scale = Number(Math.max(0.84, Math.min(1.06, 0.86 + (z + 320) / 2_000)).toFixed(3));
  return { z, rotateX: 0, rotateY: 0, opacity, scale };
}

export function fitSpatialCanvas(items: SpatialCanvasItem[], viewportWidth: number, viewportHeight: number): SpatialCanvasFit {
  if (!items.length) return { pan: { x: viewportWidth / 2, y: viewportHeight / 2 }, zoom: 0.85 };
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const zoom = Math.max(0.55, Math.min(0.95, (viewportWidth - 180) / contentWidth, (viewportHeight - 150) / contentHeight));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return { pan: { x: viewportWidth / 2 - centerX * zoom, y: viewportHeight / 2 - centerY * zoom }, zoom };
}
