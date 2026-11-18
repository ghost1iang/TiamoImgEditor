/**
 * 导入图形图层纯算法与 8 点触控吸附计算模块
 *
 * 1. 统一定义全矩阵 8 点触控把手元数据（四角方形锁定宽高比、四边圆形单向调节宽/高）；
 * 2. 提供图形移动（move）与缩放（resize）的画布边界/中心线/其他图形对齐吸附计算；
 * 3. 提供离屏 Canvas 镜像翻转、90 度旋转与多层合成输出函数。
 */

export type EightPointHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface EightPointHandleDef {
  id: EightPointHandleId;
  x: string;
  y: string;
  cursor: string;
  /** 四角为 true（方形把手，固定缩放宽高比）；上下左右为 false（圆形把手，仅调宽或高） */
  isCorner: boolean;
}

export const EIGHT_POINT_HANDLES: EightPointHandleDef[] = [
  { id: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize', isCorner: true },
  { id: 'n', x: '50%', y: '0%', cursor: 'ns-resize', isCorner: false },
  { id: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize', isCorner: true },
  { id: 'e', x: '100%', y: '50%', cursor: 'ew-resize', isCorner: false },
  { id: 'se', x: '100%', y: '100%', cursor: 'nwse-resize', isCorner: true },
  { id: 's', x: '50%', y: '100%', cursor: 'ns-resize', isCorner: false },
  { id: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize', isCorner: true },
  { id: 'w', x: '0%', y: '50%', cursor: 'ew-resize', isCorner: false },
];

export interface GraphicBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImportedGraphic extends GraphicBox {
  id: string;
  name: string;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  /** 是否锁定（锁定后不响应任何鼠标点击/移动/缩放，便于编辑下方图层） */
  locked?: boolean;
}

export interface EditorLayerState {
  version: string;
  type: 'tiamo-image-editor-state';
  timestamp: string;
  baseImage: string;
  baseLayerIndex: number;
  graphics: ImportedGraphic[];
  baseElement?: {
    url: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
}

export interface SnapGuideLines {
  x: number | null;
  y: number | null;
}

export type GraphicInputSource = string | Blob | File | HTMLImageElement | HTMLCanvasElement;

export interface ImportGraphicOptions {
  /** 图形名称（用于标识与无障碍 alt 文本） */
  name?: string;
  /** 放置在画布上的左上角 X 坐标（画布原图像素坐标系，默认居中） */
  x?: number;
  /** 放置在画布上的左上角 Y 坐标（画布原图像素坐标系，默认居中） */
  y?: number;
  /** 指定初始宽度（仅传 w 时按原图宽高比自动推算 h） */
  w?: number;
  /** 指定初始高度（仅传 h 时按原图宽高比自动推算 w） */
  h?: number;
  /** 未显式指定 w/h 时，限制图形不超过底图尺寸的最大比例（默认 0.6；传 0 或 Infinity 可禁用自动缩放） */
  maxScaleRatio?: number;
  /** 导入后是否自动选中并显示 8 点触控框（默认 true） */
  autoSelect?: boolean;
}

export type OnRequestImportGraphicItem =
  | GraphicInputSource
  | { source: GraphicInputSource; options?: ImportGraphicOptions };

export type OnRequestImportGraphicResult =
  | OnRequestImportGraphicItem
  | OnRequestImportGraphicItem[]
  | null
  | undefined
  | void;

export type OnRequestImportGraphicHandler = (
  importGraphic: (source: GraphicInputSource, options?: ImportGraphicOptions) => Promise<ImportedGraphic | null>
) => OnRequestImportGraphicResult | Promise<OnRequestImportGraphicResult>;

const MIN_GRAPHIC_SIZE = 12;

function collectSnapTargets(
  canvasW: number,
  canvasH: number,
  otherGraphics: ImportedGraphic[],
  extraSnapBoxes: GraphicBox[] = []
): { xTargets: number[]; yTargets: number[] } {
  const xTargets = [0, canvasW / 2, canvasW];
  const yTargets = [0, canvasH / 2, canvasH];

  for (const g of otherGraphics) {
    xTargets.push(g.x, g.x + g.w / 2, g.x + g.w);
    yTargets.push(g.y, g.y + g.h / 2, g.y + g.h);
  }

  for (const b of extraSnapBoxes) {
    xTargets.push(b.x, b.x + b.w / 2, b.x + b.w);
    yTargets.push(b.y, b.y + b.h / 2, b.y + b.h);
  }

  return { xTargets, yTargets };
}

function findClosestTarget(
  value: number,
  targets: number[],
  threshold: number
): { target: number; dist: number } | null {
  let bestTarget: number | null = null;
  let bestDist = threshold + 0.0001;

  for (const t of targets) {
    const dist = Math.abs(t - value);
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestTarget = t;
    }
  }

  return bestTarget !== null ? { target: bestTarget, dist: bestDist } : null;
}

/**
 * 移动图形时的吸附计算：左/水平中/右 对齐画布与其它图形，上/垂直中/下 对齐画布与其它图形
 */
export function computeGraphicMoveWithSnap(
  candX: number,
  candY: number,
  w: number,
  h: number,
  canvasW: number,
  canvasH: number,
  otherGraphics: ImportedGraphic[],
  snapThreshold: number,
  extraSnapBoxes: GraphicBox[] = []
): { x: number; y: number; snapLines: SnapGuideLines } {
  const { xTargets, yTargets } = collectSnapTargets(canvasW, canvasH, otherGraphics, extraSnapBoxes);

  const xLines = [
    { pos: candX, offset: 0 },
    { pos: candX + w / 2, offset: w / 2 },
    { pos: candX + w, offset: w },
  ];
  let bestX: { target: number; offset: number; dist: number } | null = null;
  for (const line of xLines) {
    const match = findClosestTarget(line.pos, xTargets, snapThreshold);
    if (match && (!bestX || match.dist < bestX.dist)) {
      bestX = { target: match.target, offset: line.offset, dist: match.dist };
    }
  }

  const yLines = [
    { pos: candY, offset: 0 },
    { pos: candY + h / 2, offset: h / 2 },
    { pos: candY + h, offset: h },
  ];
  let bestY: { target: number; offset: number; dist: number } | null = null;
  for (const line of yLines) {
    const match = findClosestTarget(line.pos, yTargets, snapThreshold);
    if (match && (!bestY || match.dist < bestY.dist)) {
      bestY = { target: match.target, offset: line.offset, dist: match.dist };
    }
  }

  return {
    x: bestX ? bestX.target - bestX.offset : candX,
    y: bestY ? bestY.target - bestY.offset : candY,
    snapLines: {
      x: bestX ? bestX.target : null,
      y: bestY ? bestY.target : null,
    },
  };
}

/**
 * 8 点触控缩放图形时的吸附计算：
 * - 四角 (nw/ne/se/sw)：严格固定初始宽高比例 (startBox.w / startBox.h)
 * - 左右 (e/w)：仅调整宽度（高度与 y 保持不变）
 * - 上下 (n/s)：仅调整高度（宽度与 x 保持不变）
 */
export function computeGraphicResizeWithSnap(
  handleId: EightPointHandleId,
  rawX: number,
  rawY: number,
  startBox: GraphicBox,
  canvasW: number,
  canvasH: number,
  otherGraphics: ImportedGraphic[],
  snapThreshold: number,
  extraSnapBoxes: GraphicBox[] = []
): { box: GraphicBox; snapLines: SnapGuideLines } {
  const { xTargets, yTargets } = collectSnapTargets(canvasW, canvasH, otherGraphics, extraSnapBoxes);
  const minW = Math.min(MIN_GRAPHIC_SIZE, Math.max(1, startBox.w));
  const minH = Math.min(MIN_GRAPHIC_SIZE, Math.max(1, startBox.h));

  // 左右把手：仅调节宽度
  if (handleId === 'e') {
    const candRight = Math.max(startBox.x + minW, rawX);
    const snap = findClosestTarget(candRight, xTargets, snapThreshold);
    const finalRight = snap && snap.target - startBox.x >= minW ? snap.target : candRight;
    return {
      box: {
        x: startBox.x,
        y: startBox.y,
        w: finalRight - startBox.x,
        h: startBox.h,
      },
      snapLines: {
        x: snap && snap.target - startBox.x >= minW ? snap.target : null,
        y: null,
      },
    };
  }

  if (handleId === 'w') {
    const anchorRight = startBox.x + startBox.w;
    const candLeft = Math.min(anchorRight - minW, rawX);
    const snap = findClosestTarget(candLeft, xTargets, snapThreshold);
    const finalLeft = snap && anchorRight - snap.target >= minW ? snap.target : candLeft;
    return {
      box: {
        x: finalLeft,
        y: startBox.y,
        w: anchorRight - finalLeft,
        h: startBox.h,
      },
      snapLines: {
        x: snap && anchorRight - snap.target >= minW ? snap.target : null,
        y: null,
      },
    };
  }

  // 上下把手：仅调节高度
  if (handleId === 's') {
    const candBottom = Math.max(startBox.y + minH, rawY);
    const snap = findClosestTarget(candBottom, yTargets, snapThreshold);
    const finalBottom = snap && snap.target - startBox.y >= minH ? snap.target : candBottom;
    return {
      box: {
        x: startBox.x,
        y: startBox.y,
        w: startBox.w,
        h: finalBottom - startBox.y,
      },
      snapLines: {
        x: null,
        y: snap && snap.target - startBox.y >= minH ? snap.target : null,
      },
    };
  }

  if (handleId === 'n') {
    const anchorBottom = startBox.y + startBox.h;
    const candTop = Math.min(anchorBottom - minH, rawY);
    const snap = findClosestTarget(candTop, yTargets, snapThreshold);
    const finalTop = snap && anchorBottom - snap.target >= minH ? snap.target : candTop;
    return {
      box: {
        x: startBox.x,
        y: finalTop,
        w: startBox.w,
        h: anchorBottom - finalTop,
      },
      snapLines: {
        x: null,
        y: snap && anchorBottom - snap.target >= minH ? snap.target : null,
      },
    };
  }

  // 四角把手：严格固定宽高比例缩放
  const aspect = startBox.w / Math.max(1, startBox.h);
  const dirX = handleId === 'ne' || handleId === 'se' ? 1 : -1;
  const dirY = handleId === 'sw' || handleId === 'se' ? 1 : -1;
  const anchorX = dirX === 1 ? startBox.x : startBox.x + startBox.w;
  const anchorY = dirY === 1 ? startBox.y : startBox.y + startBox.h;

  const minScale = Math.max(minW / Math.max(1, startBox.w), minH / Math.max(1, startBox.h));
  const rawW = (rawX - anchorX) * dirX;
  const rawH = (rawY - anchorY) * dirY;
  const rx = rawW / Math.max(1, startBox.w);
  const ry = rawH / Math.max(1, startBox.h);

  const baseScale = Math.max(minScale, Math.abs(rx - 1) >= Math.abs(ry - 1) ? rx : ry);
  let w = startBox.w * baseScale;
  let h = startBox.h * baseScale;

  const edgeX = anchorX + dirX * w;
  const edgeY = anchorY + dirY * h;

  const snapX = findClosestTarget(edgeX, xTargets, snapThreshold);
  const snapY = findClosestTarget(edgeY, yTargets, snapThreshold);

  const validSnapX = snapX && dirX * (snapX.target - anchorX) >= minW && (dirX * (snapX.target - anchorX)) / aspect >= minH ? snapX : null;
  const validSnapY = snapY && dirY * (snapY.target - anchorY) >= minH && dirY * (snapY.target - anchorY) * aspect >= minW ? snapY : null;

  let guideX: number | null = null;
  let guideY: number | null = null;

  if (validSnapX && (!validSnapY || validSnapX.dist <= validSnapY.dist)) {
    w = dirX * (validSnapX.target - anchorX);
    h = w / aspect;
    guideX = validSnapX.target;
    const syncedEdgeY = anchorY + dirY * h;
    const secondaryY = findClosestTarget(syncedEdgeY, yTargets, 1);
    if (secondaryY) guideY = secondaryY.target;
  } else if (validSnapY) {
    h = dirY * (validSnapY.target - anchorY);
    w = h * aspect;
    guideY = validSnapY.target;
    const syncedEdgeX = anchorX + dirX * w;
    const secondaryX = findClosestTarget(syncedEdgeX, xTargets, 1);
    if (secondaryX) guideX = secondaryX.target;
  }

  return {
    box: {
      x: dirX === 1 ? anchorX : anchorX - w,
      y: dirY === 1 ? anchorY : anchorY - h,
      w,
      h,
    },
    snapLines: {
      x: guideX,
      y: guideY,
    },
  };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * 对导入图形执行像素级左右/上下镜像或顺/逆时针 90° 旋转
 */
export async function transformGraphicImage(
  graphic: ImportedGraphic,
  action: 'flipH' | 'flipV' | 'rotateCw' | 'rotateCcw'
): Promise<ImportedGraphic> {
  const img = await loadHtmlImage(graphic.url);
  const nw = img.naturalWidth || graphic.naturalWidth;
  const nh = img.naturalHeight || graphic.naturalHeight;

  const isRotate90 = action === 'rotateCw' || action === 'rotateCcw';
  const canvas = document.createElement('canvas');
  canvas.width = isRotate90 ? nh : nw;
  canvas.height = isRotate90 ? nw : nh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建图形变换画布上下文');

  if (action === 'flipH') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  } else if (action === 'flipV') {
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
  } else if (action === 'rotateCw') {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
  }

  ctx.drawImage(img, 0, 0);
  const newUrl = canvas.toDataURL('image/png');

  if (isRotate90) {
    const cx = graphic.x + graphic.w / 2;
    const cy = graphic.y + graphic.h / 2;
    const newW = graphic.h;
    const newH = graphic.w;
    return {
      ...graphic,
      url: newUrl,
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      x: cx - newW / 2,
      y: cy - newH / 2,
      w: newW,
      h: newH,
    };
  }

  return {
    ...graphic,
    url: newUrl,
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  };
}

/**
 * 导入图形与底图统一的层级调整动作类型
 */
export type GraphicLayerOrderAction = 'front' | 'forward' | 'backward' | 'back';

/**
 * 基于“导入图形 + 底图”统一图层栈调整目标图形层级（支持移动到最顶、上一层、下一层、最底，可跨过底图）
 */
export function reorderGraphicLayer(
  graphics: ImportedGraphic[],
  baseLayerIndex: number,
  targetId: string,
  action: GraphicLayerOrderAction
): { graphics: ImportedGraphic[]; baseLayerIndex: number } {
  const clampedBaseIdx = Math.max(0, Math.min(graphics.length, baseLayerIndex));
  const BASE_MARKER = '__BASE__' as const;
  const stack: Array<ImportedGraphic | typeof BASE_MARKER> = [
    ...graphics.slice(0, clampedBaseIdx),
    BASE_MARKER,
    ...graphics.slice(clampedBaseIdx),
  ];

  const currentPos = stack.findIndex((item) => item !== BASE_MARKER && item.id === targetId);
  if (currentPos === -1) {
    return { graphics, baseLayerIndex: clampedBaseIdx };
  }

  let targetPos = currentPos;
  if (action === 'front') targetPos = stack.length - 1;
  else if (action === 'forward') targetPos = Math.min(stack.length - 1, currentPos + 1);
  else if (action === 'backward') targetPos = Math.max(0, currentPos - 1);
  else if (action === 'back') targetPos = 0;

  if (targetPos === currentPos) {
    return { graphics, baseLayerIndex: clampedBaseIdx };
  }

  const [moved] = stack.splice(currentPos, 1);
  stack.splice(targetPos, 0, moved);

  const nextBaseIdx = stack.indexOf(BASE_MARKER);
  const nextGraphics = stack.filter((item): item is ImportedGraphic => item !== BASE_MARKER);
  return { graphics: nextGraphics, baseLayerIndex: nextBaseIdx };
}

/**
 * 仅将单个选中图形与当前底图合成为一张新底图 Canvas（其余未选中图形保留，当前底图与该层合并后整体变为最底层）
 */
export async function compositeSingleGraphicToCanvas(
  baseImg: HTMLImageElement,
  graphic: ImportedGraphic,
  isBelowBase = false
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth || baseImg.width;
  canvas.height = baseImg.naturalHeight || baseImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建合成画布上下文');

  const gImg = await loadHtmlImage(graphic.url);

  if (isBelowBase) {
    ctx.drawImage(gImg, graphic.x, graphic.y, graphic.w, graphic.h);
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(gImg, graphic.x, graphic.y, graphic.w, graphic.h);
  }

  return canvas;
}

/**
 * 将底图与所有已导入的图形图层按层级顺序（含底图以下与底图以上）合成为单张高分辨率 Canvas
 */
export async function compositeGraphicsToCanvas(
  baseImg: HTMLImageElement,
  graphics: ImportedGraphic[],
  baseLayerIndex = 0
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth || baseImg.width;
  canvas.height = baseImg.naturalHeight || baseImg.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建合成画布上下文');

  const clampedBaseIdx = Math.max(0, Math.min(graphics.length, baseLayerIndex));

  for (let i = 0; i < clampedBaseIdx; i++) {
    const g = graphics[i];
    const gImg = await loadHtmlImage(g.url);
    ctx.drawImage(gImg, g.x, g.y, g.w, g.h);
  }

  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  for (let i = clampedBaseIdx; i < graphics.length; i++) {
    const g = graphics[i];
    const gImg = await loadHtmlImage(g.url);
    ctx.drawImage(gImg, g.x, g.y, g.w, g.h);
  }

  return canvas;
}

export interface ExpandedCanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  shiftX: number;
  shiftY: number;
}

/**
 * 计算底图元素与所有已导入图形的外边框并集最大值，得到扩展后新画布尺寸与平移偏移量
 */
export function calculateExpandedCanvasBounds(
  baseBox: GraphicBox,
  graphics: ImportedGraphic[]
): ExpandedCanvasBounds {
  let minX = baseBox.x;
  let minY = baseBox.y;
  let maxX = baseBox.x + baseBox.w;
  let maxY = baseBox.y + baseBox.h;

  for (const g of graphics) {
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w);
    maxY = Math.max(maxY, g.y + g.h);
  }

  const snappedMinX = Math.floor(minX);
  const snappedMinY = Math.floor(minY);
  const snappedMaxX = Math.ceil(maxX);
  const snappedMaxY = Math.ceil(maxY);

  return {
    minX: snappedMinX,
    minY: snappedMinY,
    maxX: snappedMaxX,
    maxY: snappedMaxY,
    width: Math.max(1, snappedMaxX - snappedMinX),
    height: Math.max(1, snappedMaxY - snappedMinY),
    shiftX: -snappedMinX,
    shiftY: -snappedMinY,
  };
}

/**
 * 将原始底图按新画布尺寸和平移偏移绘制到扩展后的透明底布上
 */
export async function renderExpandedBaseCanvas(
  baseImgSrc: string,
  baseBox: GraphicBox,
  width: number,
  height: number,
  shiftX: number,
  shiftY: number
): Promise<string> {
  const baseImg = await loadHtmlImage(baseImgSrc);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建扩展画布上下文');

  ctx.drawImage(
    baseImg,
    baseBox.x + shiftX,
    baseBox.y + shiftY,
    baseBox.w,
    baseBox.h
  );
  return canvas.toDataURL('image/png');
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string' && result) {
        resolve(result);
      } else {
        reject(new Error('无法读取图形文件内容'));
      }
    };
    reader.onerror = () => reject(new Error('读取图形文件失败'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImagePermissive(src: string): Promise<HTMLImageElement> {
  return loadHtmlImage(src).catch((err) => {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(err);
        img.src = src;
      });
    }
    throw err;
  });
}

function tryImageElementToDataUrl(img: HTMLImageElement, fallbackUrl: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvas.width || !canvas.height) return fallbackUrl;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[TiamoImageEditor] 画布转 DataURL 失败（可能受跨域 CORS 限制），保留原始地址:', fallbackUrl, err);
    return fallbackUrl;
  }
}

/**
 * 将宿主传入的任意图形数据源统一解析为 DataURL（或安全 URL）及自然像素尺寸
 */
export async function resolveGraphicSourceToDataUrl(source: GraphicInputSource): Promise<{
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  defaultName: string;
}> {
  if (!source) {
    throw new Error('导入的图形数据源为空');
  }

  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    const w = source.width || 120;
    const h = source.height || 120;
    return {
      dataUrl: source.toDataURL('image/png'),
      naturalWidth: w,
      naturalHeight: h,
      defaultName: '导入图形',
    };
  }

  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    const loadedImg =
      source.complete && source.naturalWidth > 0
        ? source
        : await loadHtmlImagePermissive(source.src);
    const w = loadedImg.naturalWidth || loadedImg.width || 120;
    const h = loadedImg.naturalHeight || loadedImg.height || 120;
    return {
      dataUrl: loadedImg.src.startsWith('data:')
        ? loadedImg.src
        : tryImageElementToDataUrl(loadedImg, loadedImg.src),
      naturalWidth: w,
      naturalHeight: h,
      defaultName: loadedImg.alt || '导入图形',
    };
  }

  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    if (source.type && !source.type.startsWith('image/') && source.type !== 'application/octet-stream') {
      throw new Error('错误: 导入图形仅支持图片格式');
    }
    const rawDataUrl = await readBlobAsDataUrl(source);
    const loadedImg = await loadHtmlImagePermissive(rawDataUrl);
    return {
      dataUrl: rawDataUrl,
      naturalWidth: loadedImg.naturalWidth || 120,
      naturalHeight: loadedImg.naturalHeight || 120,
      defaultName: (source as File).name || '导入图形',
    };
  }

  if (typeof source === 'string') {
    const loadedImg = await loadHtmlImagePermissive(source);
    const w = loadedImg.naturalWidth || loadedImg.width || 120;
    const h = loadedImg.naturalHeight || loadedImg.height || 120;
    const dataUrl = source.startsWith('data:')
      ? source
      : tryImageElementToDataUrl(loadedImg, source);
    let defaultName = '导入图形';
    if (!source.startsWith('data:')) {
      const cleanPath = source.split('?')[0].split('#')[0];
      const seg = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
      if (seg) defaultName = seg;
    }
    return {
      dataUrl,
      naturalWidth: w,
      naturalHeight: h,
      defaultName,
    };
  }

  throw new Error('不支持的导入图形数据源类型');
}

const LAYER_STATE_STORAGE_KEY = 'tiamo_editor_layer_state_cache_v1';

/**
 * 校验并解析图层状态数据结构
 */
export function isValidEditorLayerState(data: any): data is EditorLayerState {
  if (!data || typeof data !== 'object') return false;
  if (data.type !== 'tiamo-image-editor-state') return false;
  if (typeof data.baseImage !== 'string' || !data.baseImage) return false;
  if (!Array.isArray(data.graphics)) return false;
  return true;
}

/**
 * 深拷贝并标准化图层状态数据（接受对象或 JSON 字符串）
 */
export function parseEditorLayerState(raw: unknown): EditorLayerState | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isValidEditorLayerState(obj)) return null;
    const graphics: ImportedGraphic[] = obj.graphics
      .filter((g: any) => g && typeof g.url === 'string' && typeof g.id === 'string')
      .map((g: any) => ({
        id: String(g.id),
        name: String(g.name || '导入图形'),
        url: String(g.url),
        naturalWidth: Number(g.naturalWidth) || Number(g.w) || 120,
        naturalHeight: Number(g.naturalHeight) || Number(g.h) || 120,
        x: Number(g.x) || 0,
        y: Number(g.y) || 0,
        w: Math.max(1, Number(g.w) || 120),
        h: Math.max(1, Number(g.h) || 120),
        locked: !!g.locked,
      }));

    const clampedBaseIdx = Math.max(0, Math.min(graphics.length, Number(obj.baseLayerIndex) || 0));
    const baseElement =
      obj.baseElement && typeof obj.baseElement.url === 'string'
        ? {
            url: String(obj.baseElement.url),
            x: Number(obj.baseElement.x) || 0,
            y: Number(obj.baseElement.y) || 0,
            w: Math.max(1, Number(obj.baseElement.w) || 1),
            h: Math.max(1, Number(obj.baseElement.h) || 1),
          }
        : null;

    return {
      version: String(obj.version || '1.0.0'),
      type: 'tiamo-image-editor-state',
      timestamp: String(obj.timestamp || new Date().toISOString()),
      baseImage: obj.baseImage,
      baseLayerIndex: clampedBaseIdx,
      graphics,
      baseElement,
    };
  } catch (err) {
    console.warn('[TiamoImageEditor] 解析图层状态快照失败:', err);
    return null;
  }
}

/**
 * 为长图片 DataURL 或资源路径生成快速轻量级指纹，用于在外部存储图片后继承分层数据
 */
export function computeImageFingerprint(input: string): string {
  if (!input || typeof input !== 'string') return '';
  if (!input.startsWith('data:') && input.length <= 256) {
    return input;
  }
  const len = input.length;
  let h1 = 2166136261 >>> 0;
  let h2 = 33554467 >>> 0;
  const step = Math.max(1, Math.floor(len / 512));
  for (let i = 0; i < len; i += step) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (Math.imul(h2, 31) + c) >>> 0;
  }
  // 同时混入末尾片段确保分辨率/透明边缘微调也有独立指纹
  const tailStart = Math.max(0, len - 64);
  for (let i = tailStart; i < len; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619) >>> 0;
  }
  return `fp_${len}_${h1.toString(16)}_${h2.toString(16)}`;
}

function getMemoryLayerStateMap(): Map<string, EditorLayerState> | null {
  if (typeof window === 'undefined') return null;
  const g = window as any;
  if (!(g.__TIAMO_LAYER_STATE_CACHE__ instanceof Map)) {
    g.__TIAMO_LAYER_STATE_CACHE__ = new Map<string, EditorLayerState>();
  }
  return g.__TIAMO_LAYER_STATE_CACHE__;
}

function isEphemeralBlobUrl(val: unknown): boolean {
  return typeof val === 'string' && val.startsWith('blob:');
}

/**
 * 在图片之外单独缓存分层状态（同时关联合成预览图指纹、底图指纹及可选外部 key）
 */
export function saveLayerStateToCache(
  compositeDataUrl: string | null | undefined,
  state: EditorLayerState,
  extraKeys: Array<string | null | undefined> = []
): void {
  const memMap = getMemoryLayerStateMap();
  const memKeys = new Set<string>();
  const persistentKeys = new Set<string>();

  const registerKey = (rawKey: string | null | undefined) => {
    if (!rawKey || typeof rawKey !== 'string') return;
    const fp = computeImageFingerprint(rawKey);
    if (isEphemeralBlobUrl(rawKey)) {
      memKeys.add(rawKey);
      if (fp) memKeys.add(fp);
      return;
    }
    if (fp) {
      memKeys.add(fp);
      persistentKeys.add(fp);
    }
  };

  registerKey(compositeDataUrl);
  if (state.baseImage && state.graphics.length > 0) {
    registerKey(state.baseImage);
  }
  for (const k of extraKeys) {
    if (typeof k === 'string' && k) {
      memKeys.add(k);
      if (!isEphemeralBlobUrl(k)) {
        persistentKeys.add(k);
      }
      registerKey(k);
    }
  }
  if (memKeys.size === 0) return;

  const cloned = parseEditorLayerState(state);
  if (!cloned) return;

  if (memMap) {
    for (const k of memKeys) {
      if (cloned.graphics.length === 0) {
        memMap.delete(k);
      } else {
        if (memMap.has(k)) memMap.delete(k);
        memMap.set(k, cloned);
        while (memMap.size > 24) {
          const firstKey = memMap.keys().next().value;
          if (!firstKey) break;
          memMap.delete(firstKey);
        }
      }
    }
  }

  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(LAYER_STATE_STORAGE_KEY);
    let entries: Array<{ fp: string; state: EditorLayerState; savedAt: number }> = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) entries = parsed;
      } catch (parseErr) {
        console.warn('[TiamoImageEditor] 解析本地分层状态缓存失败，将重置损坏条目:', parseErr);
        entries = [];
      }
    }

    entries = entries.filter(
      (item) => item && !persistentKeys.has(item.fp) && !isEphemeralBlobUrl(item.fp)
    );
    if (cloned.graphics.length > 0 && compositeDataUrl && !isEphemeralBlobUrl(compositeDataUrl)) {
      const compFp = computeImageFingerprint(compositeDataUrl);
      if (compFp && !isEphemeralBlobUrl(compFp)) {
        entries.unshift({ fp: compFp, state: cloned, savedAt: Date.now() });
      }
    }
    if (entries.length > 5) entries = entries.slice(0, 5);

    let saved = false;
    let evictedCount = 0;
    while (entries.length > 0) {
      try {
        localStorage.setItem(LAYER_STATE_STORAGE_KEY, JSON.stringify(entries));
        saved = true;
        break;
      } catch (quotaErr) {
        evictedCount++;
        const dropped = entries.pop();
        if (entries.length === 0) {
          console.warn(
            '[TiamoImageEditor] localStorage 存储配额不足，无法持久化分层状态（已退回会话内存缓存，建议使用 .layers.json 或 onSaveState 保存）:',
            dropped?.fp,
            quotaErr
          );
        }
      }
    }
    if (saved && evictedCount > 0) {
      console.warn(
        `[TiamoImageEditor] localStorage 存储空间紧张，已淘汰 ${evictedCount} 条较早的分层状态缓存以保留最新记录`
      );
    }
    if (entries.length === 0) {
      localStorage.removeItem(LAYER_STATE_STORAGE_KEY);
    }
  } catch (storageErr) {
    console.warn('[TiamoImageEditor] 持久化分层状态至 localStorage 失败，仅保留当前会话内存缓存:', storageErr);
  }
}

/**
 * 根据图片内容或资源键查找之前保存的独立分层状态
 */
export function findCachedLayerState(
  imageSourceOrKey: string | null | undefined
): EditorLayerState | null {
  if (!imageSourceOrKey || typeof imageSourceOrKey !== 'string') return null;
  const fp = computeImageFingerprint(imageSourceOrKey);
  const candidates = fp && fp !== imageSourceOrKey ? [imageSourceOrKey, fp] : [imageSourceOrKey];

  const memMap = getMemoryLayerStateMap();
  if (memMap) {
    for (const key of candidates) {
      const hit = memMap.get(key);
      if (hit) {
        const parsed = parseEditorLayerState(hit);
        if (parsed && parsed.graphics.length > 0) return parsed;
      }
    }
  }

  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAYER_STATE_STORAGE_KEY);
    if (!raw) return null;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return null;
    for (const key of candidates) {
      const hit = entries.find((item: any) => item && item.fp === key);
      if (hit && hit.state) {
        const parsed = parseEditorLayerState(hit.state);
        if (parsed && parsed.graphics.length > 0) return parsed;
      }
    }
  } catch (readErr) {
    console.warn('[TiamoImageEditor] 读取 localStorage 分层状态缓存异常:', readErr);
    return null;
  }

  return null;
}


