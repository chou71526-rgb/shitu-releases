import { describe, expect, it } from "vitest";
import { advanceArchiveCamera, advanceArchiveCameraAlong, archiveCloudDepth, archiveCloudPoint, archiveViewVector, compactSpatialSlot, depthLayerStyle, depthPageCount, fitSpatialCanvas, projectArchivePoint, spatialPlacement } from "../../src/shared/spatial-layout";

describe("首页图片空间布局", () => {
  it("同一张图片的空间层级保持稳定", () => {
    expect(spatialPlacement("same-hash", 4, 320)).toEqual(spatialPlacement("same-hash", 4, 320));
  });

  it("前七张图片保留清晰而克制的纵深层级", () => {
    const placements = Array.from({ length: 7 }, (_, index) => spatialPlacement(`image-${index}`, index, index * 140 - 420));
    const depths = placements.map((item) => item.z);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(250);
    expect(Math.min(...depths)).toBeGreaterThanOrEqual(-360);
    expect(Math.min(...placements.map((item) => item.opacity))).toBeGreaterThanOrEqual(0.82);
    expect(Math.min(...placements.map((item) => item.scale))).toBeGreaterThanOrEqual(0.84);
  });

  it("所有图片保持正向，不因处在画布边缘而倾斜", () => {
    const left = spatialPlacement("left", 0, -700);
    const right = spatialPlacement("right", 0, 700);
    expect(left.rotateX).toBe(0);
    expect(left.rotateY).toBe(0);
    expect(right.rotateX).toBe(0);
    expect(right.rotateY).toBe(0);
  });

  it("适应画布会根据内容边界缩放并居中", () => {
    const fit = fitSpatialCanvas([
      { x: -900, y: -500, width: 200, height: 300 },
      { x: 800, y: 600, width: 300, height: 220 },
    ], 1360, 788);
    expect(fit.zoom).toBeLessThan(0.7);
    expect(fit.pan.x).toBeGreaterThan(500);
    expect(fit.pan.y).toBeGreaterThan(300);
  });

  it("大量图片会被分层收纳在单个视口内，而不是无限向横向展开", () => {
    const slots = Array.from({ length: 36 }, (_, index) => compactSpatialSlot(index, 1360, 760));
    expect(new Set(slots.map((slot) => slot.page)).size).toBeGreaterThan(1);
    expect(Math.max(...slots.map((slot) => Math.abs(slot.x)))).toBeLessThanOrEqual(520);
    expect(Math.max(...slots.map((slot) => Math.abs(slot.y)))).toBeLessThanOrEqual(270);
    expect(depthPageCount(36, slots[0].pageSize)).toBe(3);
  });

  it("当前层清晰，后续层缩小淡出形成前后纵深", () => {
    expect(depthLayerStyle(0)).toMatchObject({ opacity: 1, scale: 1, interactive: true });
    expect(depthLayerStyle(1).scale).toBeLessThan(1);
    expect(depthLayerStyle(1).opacity).toBeLessThan(1);
    expect(depthLayerStyle(2).opacity).toBeLessThan(depthLayerStyle(1).opacity);
    expect(depthLayerStyle(-1).opacity).toBe(0);
  });

  it("图片会在三轴空间中稳定散布并拥有足够纵深", () => {
    const points = Array.from({ length: 48 }, (_, index) => archiveCloudPoint(`image-${index}`, index));
    expect(archiveCloudPoint("same", 7)).toEqual(archiveCloudPoint("same", 7));
    expect(Math.max(...points.map((point) => point.z)) - Math.min(...points.map((point) => point.z))).toBeGreaterThan(1_000);
    expect(new Set(points.map((point) => `${point.x}:${point.y}`)).size).toBe(48);
    expect(archiveCloudDepth(48)).toBeGreaterThan(Math.max(...points.map((point) => point.z)));
    expect(new Set(points.map((point) => point.z)).size).toBe(48);
  });

  it("大屏首屏会保留足够多的可见灵感图片", () => {
    const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const viewport = { width: 1895, height: 1195 };
    const visible = Array.from({ length: 32 }, (_, index) => archiveCloudPoint(`image-${index}`, index))
      .map((point) => projectArchivePoint(point, camera, viewport))
      .filter((projection) => projection.visible && projection.opacity > 0.08);
    expect(visible.length).toBeGreaterThanOrEqual(20);
  });

  it("相机前后移动和转向会连续改变屏幕投影", () => {
    const point = { x: 180, y: 40, z: 800 };
    const initial = projectArchivePoint(point, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { width: 1360, height: 760 });
    const forward = projectArchivePoint(point, { x: 0, y: 0, z: 200, yaw: 0, pitch: 0 }, { width: 1360, height: 760 });
    const turned = projectArchivePoint(point, { x: 0, y: 0, z: 0, yaw: .2, pitch: 0 }, { width: 1360, height: 760 });
    expect(forward.scale).toBeGreaterThan(initial.scale);
    expect(turned.x).not.toBe(initial.x);
    expect(initial.visible).toBe(true);
  });

  it("只有进入近距离清晰范围的图片可以响应鼠标", () => {
    const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const close = projectArchivePoint({ x: 0, y: 0, z: 100 }, camera, { width: 1360, height: 760 });
    const near = projectArchivePoint({ x: 0, y: 0, z: 720 }, camera, { width: 1360, height: 760 });
    const small = projectArchivePoint({ x: 0, y: 0, z: 1100 }, camera, { width: 1360, height: 760 });
    const far = projectArchivePoint({ x: 0, y: 0, z: 1900 }, camera, { width: 1360, height: 760 });
    expect(close.interactive).toBe(true);
    expect(near.interactive).toBe(true);
    expect(small.visible).toBe(true);
    expect(small.interactive).toBe(false);
    expect(far.visible).toBe(true);
    expect(far.interactive).toBe(false);
  });

  it("视线向上或向下时滚轮移动沿同一方向推进", () => {
    const up = archiveViewVector({ yaw: 0, pitch: .5 });
    const down = archiveViewVector({ yaw: 0, pitch: -.5 });
    const right = archiveViewVector({ yaw: .5, pitch: 0 });
    expect(up.y).toBeGreaterThan(0);
    expect(down.y).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(up.z).toBeGreaterThan(0);
  });

  it("镜头视线与屏幕中心使用同一套三维坐标方向", () => {
    const camera = { x: 60, y: -30, z: 120, yaw: .38, pitch: .31 };
    const direction = archiveViewVector(camera);
    const point = { x: camera.x + direction.x * 900, y: camera.y + direction.y * 900, z: camera.z + direction.z * 900 };
    const projection = projectArchivePoint(point, camera, { width: 1360, height: 760 });
    expect(projection.x).toBeCloseTo(0, 5);
    expect(projection.y).toBeCloseTo(0, 5);
  });

  it("滚轮沿当前视线自然靠近，不把偏离中心的图片强制吸到中央", () => {
    const camera = { x: 0, y: 0, z: 0, yaw: .2, pitch: .12 };
    const direction = archiveViewVector(camera);
    const target = { x: direction.x * 900 + 80, y: direction.y * 900 + 35, z: direction.z * 900 };
    const near = advanceArchiveCameraAlong(camera, direction, 700);
    const passed = advanceArchiveCameraAlong(near, direction, 400);
    expect(Math.abs(projectArchivePoint(target, near, { width: 1360, height: 760 }).x)).toBeGreaterThan(0);
    expect(Math.abs(projectArchivePoint(target, near, { width: 1360, height: 760 }).y)).toBeGreaterThan(0);
    expect(passed.z).toBeGreaterThan(target.z);
  });

  it("相机能够持续靠近并穿过图片，不在图片前设置停止距离", () => {
    const first = advanceArchiveCamera({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, 500);
    const second = advanceArchiveCamera(first, 500);
    expect(second.z).toBe(1000);
    expect(second.x).toBe(0);
  });

  it("图片靠近镜头时会持续放大，而不是停在小卡片尺寸", () => {
    const camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const close = projectArchivePoint({ x: 0, y: 0, z: 100 }, camera, { width: 1360, height: 760 });
    expect(close.visible).toBe(true);
    expect(close.scale).toBeGreaterThan(3);
  });
});
