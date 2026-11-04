import { Point } from '../useImageEditorCore';

/**
 * 计算正交化目标矩形的宽高
 * 基于对边长度的最大值来保持合理的比例与分辨率
 */
export function calculateOrthoTargetDimensions(points: Point[]): { width: number; height: number } {
  if (points.length < 4) {
    return { width: 800, height: 600 };
  }

  // points 顺序: 0:左上, 1:右上, 2:右下, 3:左下
  const w1 = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  const w2 = Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y);
  const h1 = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);
  const h2 = Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y);

  let targetW = Math.round(Math.max(w1, w2));
  let targetH = Math.round(Math.max(h1, h2));

  // 限制最大输出尺寸，防止极端坐标导致浏览器内存溢出崩溃
  const MAX_OUT = 4096;
  if (targetW > MAX_OUT || targetH > MAX_OUT) {
    const s = MAX_OUT / Math.max(targetW, targetH);
    targetW = Math.round(targetW * s);
    targetH = Math.round(targetH * s);
  }

  return {
    width: Math.max(16, targetW),
    height: Math.max(16, targetH),
  };
}

/**
 * 透视变换 / 单应性矩阵逆向映射正交化算法 (与图象正交化工具.html 算法 100% 保真)
 * 将图像中任意凸四边形区域校正为平直的正交矩形
 */
export function performPerspectiveOrthogonalization(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  points: Point[],
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  if (points.length !== 4) {
    throw new Error('正交化需要精确的 4 个四边形控制顶点');
  }

  // 1. 获取原图原始分辨率与 ImageData
  const srcW = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const srcH = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  const tempSrcCanvas = document.createElement('canvas');
  tempSrcCanvas.width = srcW;
  tempSrcCanvas.height = srcH;
  const tempSrcCtx = tempSrcCanvas.getContext('2d', { willReadFrequently: true });
  if (!tempSrcCtx) {
    throw new Error('无法初始化源 Canvas 上下文');
  }
  tempSrcCtx.drawImage(sourceImage, 0, 0, srcW, srcH);
  const srcImgData = tempSrcCtx.getImageData(0, 0, srcW, srcH);
  const srcData = srcImgData.data;

  // 2. 计算目标尺寸
  const dims = calculateOrthoTargetDimensions(points);
  const targetW = targetWidth || dims.width;
  const targetH = targetHeight || dims.height;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = targetW;
  resultCanvas.height = targetH;
  const resCtx = resultCanvas.getContext('2d');
  if (!resCtx) {
    throw new Error('无法初始化目标 Canvas 上下文');
  }
  const resImgData = resCtx.createImageData(targetW, targetH);
  const dstData = resImgData.data;

  // 3. 计算单位正方形到源四边形的透视变换映射参数
  // 选点顺序: points[0]=左上, points[1]=右上, points[2]=右下, points[3]=左下
  const [x0, y0] = [points[0].x, points[0].y];
  const [x1, y1] = [points[1].x, points[1].y];
  const [x2, y2] = [points[2].x, points[2].y];
  const [x3, y3] = [points[3].x, points[3].y];

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;

  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;

  if (dx3 === 0 && dy3 === 0) {
    // 平行四边形 (仿射变换简化情形)
    g = 0;
    h = 0;
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
  } else {
    // 一般四边形 (透视变换情形)
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-7) {
      throw new Error('控制点存在共线或退化交叉，无法构建有效透视变换矩阵，请微调控制点位置');
    }
    g = (dx3 * dy2 - dy3 * dx2) / det;
    h = (dx1 * dy3 - dy1 * dx3) / det;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  // 4. 逆向映射遍历目标像素，执行双线性插值采样
  let ptr = 0;
  for (let v = 0; v < targetH; v++) {
    const vv = v / targetH; // [0, 1]
    for (let u = 0; u < targetW; u++) {
      const uu = u / targetW; // [0, 1]

      // 计算对应的源图像浮点物理坐标
      const denom = g * uu + h * vv + 1;
      const srcX = (a * uu + b * vv + c) / denom;
      const srcY = (d * uu + e * vv + f) / denom;

      // 双线性插值
      const ix = Math.floor(srcX);
      const iy = Math.floor(srcY);

      if (ix >= 0 && ix < srcW - 1 && iy >= 0 && iy < srcH - 1) {
        const fx = srcX - ix;
        const fy = srcY - iy;

        const i00 = (iy * srcW + ix) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        // Red
        dstData[ptr] = Math.round(w00 * srcData[i00] + w10 * srcData[i10] + w01 * srcData[i01] + w11 * srcData[i11]);
        // Green
        dstData[ptr + 1] = Math.round(w00 * srcData[i00 + 1] + w10 * srcData[i10 + 1] + w01 * srcData[i01 + 1] + w11 * srcData[i11 + 1]);
        // Blue
        dstData[ptr + 2] = Math.round(w00 * srcData[i00 + 2] + w10 * srcData[i10 + 2] + w01 * srcData[i01 + 2] + w11 * srcData[i11 + 2]);
        // Alpha (保留源图透明度通道)
        dstData[ptr + 3] = Math.round(w00 * srcData[i00 + 3] + w10 * srcData[i10 + 3] + w01 * srcData[i01 + 3] + w11 * srcData[i11 + 3]);
      } else if (ix >= 0 && ix < srcW && iy >= 0 && iy < srcH) {
        // 边缘刚好触碰最后一行或最后一列像素
        const idx = (iy * srcW + ix) * 4;
        dstData[ptr] = srcData[idx];
        dstData[ptr + 1] = srcData[idx + 1];
        dstData[ptr + 2] = srcData[idx + 2];
        dstData[ptr + 3] = srcData[idx + 3];
      } else {
        // 超出源图边界范围时填充完全透明
        dstData[ptr] = 0;
        dstData[ptr + 1] = 0;
        dstData[ptr + 2] = 0;
        dstData[ptr + 3] = 0;
      }

      ptr += 4;
    }
  }

  resCtx.putImageData(resImgData, 0, 0);
  return resultCanvas;
}

