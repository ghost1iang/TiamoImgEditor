/**
 * 智能魔棒选区与色彩漫水/全色相去溢色纯算法模块
 */

import { Point, SelectionRegion } from '../useImageEditorCore';

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
    const a = data[i + 3];
    if (a === 0) continue;

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
          modified = true;
        }
      }
    } else if (isBlue) {
      if (b > r && b > g) {
        const limit = (r + g) / 2;
        if (b > limit) {
          const excess = b - limit;
          data[i + 2] = Math.round(limit);
          data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
          modified = true;
        }
      }
    } else if (isRed) {
      if (r > g && r > b) {
        const limit = (g + b) / 2;
        if (r > limit) {
          const excess = r - limit;
          data[i] = Math.round(limit);
          data[i + 3] = Math.max(0, Math.min(255, Math.round(a - excess * 0.35)));
          modified = true;
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
          modified = true;
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
          modified = true;
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
          modified = true;
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
        modified = true;
      }
    }
  }

  return modified;
}
