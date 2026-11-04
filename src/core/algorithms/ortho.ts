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

/**
 * 2D 向量叉积 (用于凸包计算)
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * 安德鲁单调链算法 (Andrew's Monotone Chain Convex Hull)
 * 时间复杂度 O(N log N)，在纯 JS 中通常只要 1~3ms
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return [...points];
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * 鞋带公式计算多边形面积
 */
export function polygonArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * 计算四边形的 4 个内角 (度数)
 */
function computeQuadAngles(pts: Point[]): number[] | null {
  if (pts.length !== 4) return null;
  const angles: number[] = [];
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const curr = pts[i];
    const next = pts[(i + 1) % 4];
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return null;
    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    angles.push(Math.acos(cosTheta) * (180 / Math.PI));
  }
  return angles;
}

/**
 * 在凸包上求解面积最大的内接四边形 (Max Area Inscribed Quadrilateral)
 * 能够完美抗噪并剔除凸包边缘由于文字或微小毛刺引起的细碎顶点
 */
function findMaxAreaQuad(hull: Point[]): { quad: Point[]; area: number } | null {
  const n = hull.length;
  if (n < 4) return null;
  if (n === 4) return { quad: hull, area: polygonArea(hull) };

  // 若凸包顶点过多，均匀降采样至最多 24 个候选顶点以保证极速运算 (<1ms)
  let candidates = hull;
  if (n > 24) {
    candidates = [];
    const step = n / 24;
    for (let i = 0; i < 24; i++) {
      candidates.push(hull[Math.floor(i * step)]);
    }
  }

  const m = candidates.length;
  let maxArea = -1;
  let bestQuad: Point[] | null = null;

  for (let i = 0; i < m - 3; i++) {
    for (let j = i + 1; j < m - 2; j++) {
      for (let k = j + 1; k < m - 1; k++) {
        for (let l = k + 1; l < m; l++) {
          const quad = [candidates[i], candidates[j], candidates[k], candidates[l]];
          const a = polygonArea(quad);
          if (a > maxArea) {
            maxArea = a;
            bestQuad = quad;
          }
        }
      }
    }
  }

  return bestQuad ? { quad: bestQuad, area: maxArea } : null;
}

/**
 * 顺时针规范化 4 个角点顺序：[左上 TL, 右上 TR, 右下 BR, 左下 BL]
 */
export function sortQuadrilateralCorners(pts: Point[]): Point[] {
  if (pts.length !== 4) return pts;
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  // 根据极角升序排序
  const sorted = [...pts].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  // 寻找距左上角最近 (x+y 最小) 的点作为起点 0
  let minSum = Infinity;
  let tlIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIdx = i;
    }
  }

  return [
    sorted[tlIdx],
    sorted[(tlIdx + 1) % 4],
    sorted[(tlIdx + 2) % 4],
    sorted[(tlIdx + 3) % 4],
  ];
}

/**
 * 非 AI 经典计算机视觉：自动识别画面中矩形物体的 4 个推荐顶点
 * 
 * 流程：
 * 1. 降采样至适中尺度 (最长边约 480px，既抗高频噪点又大幅提升性能)；
 * 2. 多轨边缘与轮廓感知：
 *    - 透明通道 Alpha 掩码感知 (针对抠图、漫画分格或带透明背景的图元)；
 *    - 灰度化 + 5x5 高斯模糊去噪；
 *    - Otsu 自适应大津二值化双向提取 (亮色目标 vs 暗色目标)；
 *    - Sobel 梯度幅值边缘提取；
 * 3. 提取边缘/前景点阵并计算凸包 (Monotone Chain Convex Hull)；
 * 4. 在凸包上求解最大内接四边形 (Max Area Inscribed Quadrilateral)，准确定位 4 个真实拐角；
 * 5. 校验凸四边形合法性 (凸性、面积占比 10%~98%、内角范围 35°~145°)；
 * 6. 顺时针拓扑排序：规范输出 [左上 TL, 右上 TR, 右下 BR, 左下 BL]；
 * 7. 若未检测到显著四边形，自动优雅降级为推荐的 15% 边距安全框。
 */
export function detectOrthoQuadCorners(
  sourceImage: HTMLImageElement | HTMLCanvasElement
): { points: Point[]; isAutoDetected: boolean } {
  const srcW = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const srcH = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  // 默认兜底 15% 边距安全框
  const fallbackPoints: Point[] = [
    { x: Math.round(srcW * 0.15), y: Math.round(srcH * 0.15) },
    { x: Math.round(srcW * 0.85), y: Math.round(srcH * 0.15) },
    { x: Math.round(srcW * 0.85), y: Math.round(srcH * 0.85) },
    { x: Math.round(srcW * 0.15), y: Math.round(srcH * 0.85) },
  ];

  if (srcW < 32 || srcH < 32) {
    return { points: fallbackPoints, isAutoDetected: false };
  }

  // 1. 降采样
  const MAX_DIM = 480;
  const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const dw = Math.round(srcW * scale);
  const dh = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { points: fallbackPoints, isAutoDetected: false };
  }

  ctx.drawImage(sourceImage, 0, 0, dw, dh);
  const imgData = ctx.getImageData(0, 0, dw, dh);
  const data = imgData.data;
  const totalPixels = dw * dh;

  // 2. 检测是否存在透明通道
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 50) transparentCount++;
  }
  const hasTransparency = transparentCount > totalPixels * 0.03;

  const candidatePointSets: Point[][] = [];

  // 轨 A：透明通道边界点收集
  if (hasTransparency) {
    const alphaPts: Point[] = [];
    for (let y = 1; y < dh - 1; y += 2) {
      for (let x = 1; x < dw - 1; x += 2) {
        const idx = (y * dw + x) * 4;
        if (data[idx + 3] >= 50) {
          const isEdge =
            data[idx - 4 + 3] < 50 ||
            data[idx + 4 + 3] < 50 ||
            data[idx - dw * 4 + 3] < 50 ||
            data[idx + dw * 4 + 3] < 50;
          if (isEdge) {
            alphaPts.push({ x, y });
          }
        }
      }
    }
    if (alphaPts.length >= 8) {
      candidatePointSets.push(alphaPts);
    }
  }

  // 轨 B：灰度化 + 5x5 高斯模糊
  const gray = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 分离式 5x5 高斯模糊 (1, 4, 6, 4, 1) / 16
  const blurred = new Float32Array(totalPixels);
  const temp = new Float32Array(totalPixels);

  // 水平 pass
  for (let y = 0; y < dh; y++) {
    const rowOffset = y * dw;
    for (let x = 0; x < dw; x++) {
      const x0 = Math.max(0, x - 2);
      const x1 = Math.max(0, x - 1);
      const x2 = x;
      const x3 = Math.min(dw - 1, x + 1);
      const x4 = Math.min(dw - 1, x + 2);
      temp[rowOffset + x] =
        (gray[rowOffset + x0] +
          4 * gray[rowOffset + x1] +
          6 * gray[rowOffset + x2] +
          4 * gray[rowOffset + x3] +
          gray[rowOffset + x4]) /
        16;
    }
  }

  // 垂直 pass
  for (let y = 0; y < dh; y++) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.max(0, y - 1);
    const y2 = y;
    const y3 = Math.min(dh - 1, y + 1);
    const y4 = Math.min(dh - 1, y + 2);
    for (let x = 0; x < dw; x++) {
      blurred[y * dw + x] =
        (temp[y0 * dw + x] +
          4 * temp[y1 * dw + x] +
          6 * temp[y2 * dw + x] +
          4 * temp[y3 * dw + x] +
          temp[y4 * dw + x]) /
        16;
    }
  }

  // 轨 C：大津阈值 Otsu
  const hist = new Int32Array(256);
  for (let i = 0; i < totalPixels; i++) {
    const v = Math.min(255, Math.max(0, Math.round(blurred[i])));
    hist[v]++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = 0, otsuThreshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      otsuThreshold = t;
    }
  }

  // 收集 Otsu 正向 (亮物体) 与 反向 (暗物体) 边界
  const otsuBrightPts: Point[] = [];
  const otsuDarkPts: Point[] = [];

  for (let y = 1; y < dh - 1; y += 2) {
    for (let x = 1; x < dw - 1; x += 2) {
      const idx = y * dw + x;
      const v = blurred[idx];
      if (v >= otsuThreshold) {
        if (
          blurred[idx - 1] < otsuThreshold ||
          blurred[idx + 1] < otsuThreshold ||
          blurred[idx - dw] < otsuThreshold ||
          blurred[idx + dw] < otsuThreshold
        ) {
          otsuBrightPts.push({ x, y });
        }
      } else {
        if (
          blurred[idx - 1] >= otsuThreshold ||
          blurred[idx + 1] >= otsuThreshold ||
          blurred[idx - dw] >= otsuThreshold ||
          blurred[idx + dw] >= otsuThreshold
        ) {
          otsuDarkPts.push({ x, y });
        }
      }
    }
  }

  if (otsuBrightPts.length >= 8) candidatePointSets.push(otsuBrightPts);
  if (otsuDarkPts.length >= 8) candidatePointSets.push(otsuDarkPts);

  // 轨 D：Sobel 边缘梯度
  const edgePts: Point[] = [];
  const gradMag = new Float32Array(totalPixels);
  let maxGrad = 0;

  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const gx =
        (blurred[(y - 1) * dw + x + 1] + 2 * blurred[y * dw + x + 1] + blurred[(y + 1) * dw + x + 1]) -
        (blurred[(y - 1) * dw + x - 1] + 2 * blurred[y * dw + x - 1] + blurred[(y + 1) * dw + x - 1]);
      const gy =
        (blurred[(y + 1) * dw + x - 1] + 2 * blurred[(y + 1) * dw + x] + blurred[(y + 1) * dw + x + 1]) -
        (blurred[(y - 1) * dw + x - 1] + 2 * blurred[(y - 1) * dw + x] + blurred[(y - 1) * dw + x + 1]);
      const m = Math.hypot(gx, gy);
      gradMag[y * dw + x] = m;
      if (m > maxGrad) maxGrad = m;
    }
  }

  const gradThreshold = Math.max(25, maxGrad * 0.28);
  for (let y = 2; y < dh - 2; y += 2) {
    for (let x = 2; x < dw - 2; x += 2) {
      if (gradMag[y * dw + x] >= gradThreshold) {
        edgePts.push({ x, y });
      }
    }
  }
  if (edgePts.length >= 8) candidatePointSets.push(edgePts);

  // 3. 在所有候选点集上求解最佳四边形
  let bestQuad: Point[] | null = null;
  let bestScore = -1;
  const imageArea = dw * dh;

  for (const pts of candidatePointSets) {
    const hull = convexHull(pts);
    if (hull.length < 4) continue;

    const quadRes = findMaxAreaQuad(hull);
    if (!quadRes) continue;

    const { quad, area } = quadRes;
    const areaRatio = area / imageArea;

    // 面积必须在 10% ~ 98% 之间（避免过小杂点或直接贴满整个画布边框）
    if (areaRatio < 0.1 || areaRatio > 0.98) continue;

    const angles = computeQuadAngles(quad);
    if (!angles) continue;

    // 检查 4 个内角，每个角需在合理四边形范围 (35° ~ 145°)
    const validAngles = angles.every(a => a >= 35 && a <= 145);
    if (!validAngles) continue;

    // 评分：以面积占比为主，同时偏好接近直角 (90°) 的规整矩形
    const angleDev = angles.reduce((sum, a) => sum + Math.abs(a - 90), 0);
    const score = area * (1 - (angleDev / 360) * 0.3);

    if (score > bestScore) {
      bestScore = score;
      bestQuad = quad;
    }
  }

  // 4. 如果找到了满意的四边形
  if (bestQuad) {
    // 将降采样坐标映射回原图物理分辨率
    const mappedPts: Point[] = bestQuad.map(p => ({
      x: Math.round(p.x / scale),
      y: Math.round(p.y / scale),
    }));

    // 顺时针规范排序 [TL, TR, BR, BL]
    const sorted = sortQuadrilateralCorners(mappedPts);

    // 边界约束确保在 [0, srcW] 和 [0, srcH] 内
    const bounded: Point[] = sorted.map(p => ({
      x: Math.max(0, Math.min(srcW, p.x)),
      y: Math.max(0, Math.min(srcH, p.y)),
    }));

    return { points: bounded, isAutoDetected: true };
  }

  // 5. 优雅兜底降级
  return { points: fallbackPoints, isAutoDetected: false };
}


