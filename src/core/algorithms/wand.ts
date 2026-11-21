/**
 * 智能魔棒选区与色彩漫水/全色相去溢色纯算法模块
 */

import { Point, SelectionRegion } from '../../types/canvas';

export interface SampledColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 判断指定 (x, y) 坐标是否落在锁定的矩形或套索选区内部
 */
export function isInsideLockedRegion(
  x: number,
  y: number,
  region: SelectionRegion | null,
  isRegionInverted: boolean
): boolean {
  if (!region) return true;
  let inside = false;
  if (region.type === 'rect') {
    const r = region.data;
    inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  } else if (region.type === 'path') {
    const path = region.data as Point[];
    if (path.length < 3) return true;
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const xi = path[i].x, yi = path[i].y;
      const xj = path[j].x, yj = path[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
  }
  return isRegionInverted ? !inside : inside;
}

/**
 * 全色相智能去溢色算法 (Universal De-Spill)
 * 智能识别绿幕、蓝幕、红幕、黄幕、青幕、品红及复合色相，自动中和边缘残留色相
 */
export function applyDeSpillToPixel(
  data: Uint8ClampedArray,
  i: number,
  isGreen: boolean,
  isBlue: boolean,
  isRed: boolean,
  isYellow: boolean,
  isCyan: boolean,
  isMagenta: boolean,
  tr: number,
  tg: number,
  tb: number,
  tolRange: number,
  tolSq: number
): boolean {
  const a = data[i + 3];
  if (a === 0) return false;

  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  if (isGreen) {
    if (g > r && g > b) {
      const limit = (r + b) / 2;
      if (g > limit) {
        const excess = g - limit;
        data[i + 1] = Math.round(limit);
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
        return true;
      }
    }
  } else if (isBlue) {
    if (b > r && b > g) {
      const limit = (r + g) / 2;
      if (b > limit) {
        const excess = b - limit;
        data[i + 2] = Math.round(limit);
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
        return true;
      }
    }
  } else if (isRed) {
    if (r > g && r > b) {
      const limit = (g + b) / 2;
      if (r > limit) {
        const excess = r - limit;
        data[i] = Math.round(limit);
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
        return true;
      }
    }
  } else if (isYellow) {
    if (r > b && g > b) {
      const excess = Math.min(r - b, g - b);
      if (excess > 12) {
        const damp = excess * 0.55;
        data[i] = Math.round(r - damp);
        data[i + 1] = Math.round(g - damp);
        data[i + 2] = Math.min(255, Math.round(b + damp * 0.3));
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
        return true;
      }
    }
  } else if (isCyan) {
    if (g > r && b > r) {
      const excess = Math.min(g - r, b - r);
      if (excess > 12) {
        const damp = excess * 0.55;
        data[i + 1] = Math.round(g - damp);
        data[i + 2] = Math.round(b - damp);
        data[i] = Math.min(255, Math.round(r + damp * 0.3));
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
        return true;
      }
    }
  } else if (isMagenta) {
    if (r > g && b > g) {
      const excess = Math.min(r - g, b - g);
      if (excess > 12) {
        const damp = excess * 0.55;
        data[i] = Math.round(r - damp);
        data[i + 2] = Math.round(b - damp);
        data[i + 1] = Math.min(255, Math.round(g + damp * 0.3));
        data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.25)));
        return true;
      }
    }
  } else {
    const dr = r - tr;
    const dg = g - tg;
    const db = b - tb;
    const distSq = dr * dr + dg * dg + db * db;
    if (distSq < tolSq) {
      const factor = 1 - Math.sqrt(distSq) / tolRange;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const blend = factor * 0.6;
      data[i] = Math.round(r * (1 - blend) + lum * blend);
      data[i + 1] = Math.round(g * (1 - blend) + lum * blend);
      data[i + 2] = Math.round(b * (1 - blend) + lum * blend);
      data[i + 3] = Math.max(0, Math.min(255, Math.round(a - factor * 35)));
      return true;
    }
  }
  return false;
}

export function processUniversalDeSpill(
  data: Uint8ClampedArray,
  bg: { r: number; g: number; b: number } | null,
  tol: number
): boolean {
  const tr = bg ? bg.r : 0;
  const tg = bg ? bg.g : 255;
  const tb = bg ? bg.b : 0;

  const isGreen = tg > tr * 1.15 && tg > tb * 1.15;
  const isBlue = tb > tr * 1.15 && tb > tg * 1.15;
  const isRed = tr > tg * 1.15 && tr > tb * 1.15;
  const isYellow = tr > tb * 1.25 && tg > tb * 1.25 && Math.abs(tr - tg) < 70;
  const isCyan = tg > tr * 1.25 && tb > tr * 1.25 && Math.abs(tg - tb) < 70;
  const isMagenta = tr > tg * 1.25 && tb > tg * 1.25 && Math.abs(tr - tg) < 70;

  const tolRange = Math.max(40, tol * 1.5);
  const tolSq = tolRange * tolRange;
  let modified = false;

  for (let i = 0; i < data.length; i += 4) {
    if (applyDeSpillToPixel(
      data,
      i,
      isGreen,
      isBlue,
      isRed,
      isYellow,
      isCyan,
      isMagenta,
      tr,
      tg,
      tb,
      tolRange,
      tolSq
    )) {
      modified = true;
    }
  }

  return modified;
}

/**
 * 局部过渡带智能去溢色算法 (Local Boundary De-Spill)
 * 仅对擦除区域边界外沿 radius 像素内的未擦除像素执行去溢色，绝不触碰主体内部
 * @param data 当前画布 RGBA 像素数据
 * @param width 画面宽度
 * @param height 画面高度
 * @param maskData 魔棒蒙版 RGBA 数据 (maskData[p*4+3] > 0 表示本次被选中的擦除区域)
 * @param bg 采样背景色
 * @param tol 容差
 * @param radius 影响半径 (像素)。<=0 不处理；>= max(w,h) 全图处理；1~N 仅处理边缘 N 像素
 */
export function processLocalDeSpill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maskData: Uint8ClampedArray,
  bg: { r: number; g: number; b: number } | null,
  tol: number,
  radius: number
): boolean {
  if (radius <= 0) return false;
  const maxDim = Math.max(width, height);
  if (radius >= maxDim) {
    return processUniversalDeSpill(data, bg, tol);
  }

  const tr = bg ? bg.r : 0;
  const tg = bg ? bg.g : 255;
  const tb = bg ? bg.b : 0;

  const isGreen = tg > tr * 1.15 && tg > tb * 1.15;
  const isBlue = tb > tr * 1.15 && tb > tg * 1.15;
  const isRed = tr > tg * 1.15 && tr > tb * 1.15;
  const isYellow = tr > tb * 1.25 && tg > tb * 1.25 && Math.abs(tr - tg) < 70;
  const isCyan = tg > tr * 1.25 && tb > tr * 1.25 && Math.abs(tg - tb) < 70;
  const isMagenta = tr > tg * 1.25 && tb > tg * 1.25 && Math.abs(tr - tg) < 70;

  const tolRange = Math.max(40, tol * 1.5);
  const tolSq = tolRange * tolRange;

  const totalPixels = width * height;
  const visitedDist = new Int16Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let qTail = 0;

  // 1. 寻找种子像素：自身未被擦除 (maskData === 0 且 data alpha > 0)，且 4 邻域有至少一个被擦除像素
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const p = rowOffset + x;
      const maskA = maskData[p * 4 + 3];
      if (maskA > 0) continue; // 属于擦除区自身，跳过
      if (data[p * 4 + 3] === 0) continue; // 原本就是透明的，跳过

      // 检查 4 邻域是否存在被擦除的像素 (maskData > 0)
      const hasErasedNeighbor =
        (x > 0 && maskData[(p - 1) * 4 + 3] > 0) ||
        (x < width - 1 && maskData[(p + 1) * 4 + 3] > 0) ||
        (y > 0 && maskData[(p - width) * 4 + 3] > 0) ||
        (y < height - 1 && maskData[(p + width) * 4 + 3] > 0);

      if (hasErasedNeighbor) {
        visitedDist[p] = 1;
        queue[qTail++] = p;
      }
    }
  }

  if (qTail === 0) return false;

  // 2. BFS 向外扩展至 radius 像素层
  let qHead = 0;
  while (qHead < qTail) {
    const p = queue[qHead++];
    const d = visitedDist[p];
    if (d >= radius) continue;

    const x = p % width;
    const y = (p - x) / width;

    // 左
    if (x > 0) {
      const np = p - 1;
      if (visitedDist[np] === 0 && maskData[np * 4 + 3] === 0 && data[np * 4 + 3] > 0) {
        visitedDist[np] = d + 1;
        queue[qTail++] = np;
      }
    }
    // 右
    if (x < width - 1) {
      const np = p + 1;
      if (visitedDist[np] === 0 && maskData[np * 4 + 3] === 0 && data[np * 4 + 3] > 0) {
        visitedDist[np] = d + 1;
        queue[qTail++] = np;
      }
    }
    // 上
    if (y > 0) {
      const np = p - width;
      if (visitedDist[np] === 0 && maskData[np * 4 + 3] === 0 && data[np * 4 + 3] > 0) {
        visitedDist[np] = d + 1;
        queue[qTail++] = np;
      }
    }
    // 下
    if (y < height - 1) {
      const np = p + width;
      if (visitedDist[np] === 0 && maskData[np * 4 + 3] === 0 && data[np * 4 + 3] > 0) {
        visitedDist[np] = d + 1;
        queue[qTail++] = np;
      }
    }
  }

  // 3. 仅对过渡带内部像素执行去溢色中和
  let modified = false;
  for (let k = 0; k < qTail; k++) {
    const p = queue[k];
    const i = p * 4;
    const res = applyDeSpillToPixel(
      data,
      i,
      isGreen,
      isBlue,
      isRed,
      isYellow,
      isCyan,
      isMagenta,
      tr,
      tg,
      tb,
      tolRange,
      tolSq
    );
    if (res) modified = true;
  }

  return modified;
}
