/**
 * 非透明像素边界探测与选区剪裁纯算法模块
 */

export interface BoundingBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * 扫描像素数组中所有非透明 (Alpha > 0) 像素的最小外接矩形边界
 */
export function findNonTransparentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number
): BoundingBox | null {
  let top: number | null = null;
  let left: number | null = null;
  let right: number | null = null;
  let bottom: number | null = null;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0) {
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      if (top === null || y < top) top = y;
      if (left === null || x < left) left = x;
      if (right === null || x > right) right = x;
      if (bottom === null || y > bottom) bottom = y;
    }
  }

  if (top !== null && left !== null && right !== null && bottom !== null) {
    return {
      top,
      left,
      right,
      bottom,
      width: right - left + 1,
      height: bottom - top + 1,
    };
  }

  return null;
}

