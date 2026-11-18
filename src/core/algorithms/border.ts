/**
 * 沿着图像有效像素最外层添加边框 (Outer Border / Stroke) 核心算法
 * 
 * 核心数学模型：多边形法向外扩与尖角求交算法 (Polygon Normal Offset with Miter Joint)
 * 1. 扫描图像 Alpha 通道，识别非透明有效像素 (Alpha > 10)；
 * 2. 提取有效像素的闭合外轮廓环路，使用 RDP 算法精炼为有序多边形顶点序列；
 * 3. 针对每条线段沿其垂直外法向平移距离 N (borderWidth)，求取相邻两条平移平行线的外侧交点 (Miter Joint)；
 * 4. 该交点在钝角、直角和锐角下均能保持严格垂直等宽，并在锐角拐角处自然闭合为尖角三角形 (填补圆角缺口)；
 * 5. 计算包含全部外扩尖角顶点的真实包围盒，确保向外延展的边框在四边有充足画布容纳，不被边缘裁切；
 * 6. 使用 Canvas 渲染引擎，利用 destination-over 将外扩多边形绘制在原图底层，保证原图像素 100% 原始呈现。
 */

export interface OuterBorderOptions {
  borderWidth: number; // 边框宽度 (px, >= 1)
  borderColor: string; // 边框颜色十六进制 (例如 #ffffff, #3b82f6) 或 rgba
}

export interface OuterBorderResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
  padLeft: number;
  padTop: number;
  padRight: number;
  padBottom: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * 解析颜色字符串为 RGBA 四通道数值 (0~255)
 */
export function parseColorToRgba(colorStr: string): [number, number, number, number] {
  if (!colorStr) return [255, 255, 255, 255];
  const s = colorStr.trim().toLowerCase();

  // 1. 十六进制颜色 (#fff, #ffffff, #ffffffff)
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (isNaN(num)) return [255, 255, 255, 255];
    if (hex.length === 8) {
      return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ];
    }
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255,
      255,
    ];
  }

  // 2. rgb / rgba 格式
  const rgbaMatch = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10) || 0));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10) || 0));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10) || 0));
    const a = rgbaMatch[4] !== undefined
      ? Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[4]) * 255)))
      : 255;
    return [r, g, b, a];
  }

  // 兜底白色
  return [255, 255, 255, 255];
}

/**
 * 计算多边形有向面积（Shoelace 公式）：顺时针为正，逆时针为负
 */
export function computeSignedArea(pts: Point[]): number {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return a / 2;
}

/**
 * Ramer-Douglas-Peucker (RDP) 多边形轮廓化简算法
 */
export function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    let dist: number;
    if (lenSq === 0) {
      dist = Math.hypot(p.x - p1.x, p.y - p1.y);
    } else {
      const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq));
      dist = Math.hypot(p.x - (p1.x + t * dx), p.y - (p1.y + t * dy));
    }
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [p1, p2];
  }
}

/**
 * 从像素掩码中提取全部闭合多边形轮廓
 */
export function extractContours(mask: Uint8Array, W: number, H: number): Point[][] {
  const edges = new Map<string, Point[]>();
  function addEdge(x1: number, y1: number, x2: number, y2: number) {
    const k = `${x1},${y1}`;
    let list = edges.get(k);
    if (!list) {
      list = [];
      edges.set(k, list);
    }
    list.push({ x: x2, y: y2 });
  }

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      if (!mask[row + x]) continue;
      // 检查4邻域：上、右、下、左
      if (y === 0 || !mask[row - W + x]) addEdge(x, y, x + 1, y);
      if (x === W - 1 || !mask[row + x + 1]) addEdge(x + 1, y, x + 1, y + 1);
      if (y === H - 1 || !mask[row + W + x]) addEdge(x + 1, y + 1, x, y + 1);
      if (x === 0 || !mask[row + x - 1]) addEdge(x, y + 1, x, y);
    }
  }

  const contours: Point[][] = [];
  const visitedEdges = new Set<string>();

  for (const [startK, nextList] of edges.entries()) {
    for (const nextP of nextList) {
      const edgeKey = `${startK}->${nextP.x},${nextP.y}`;
      if (visitedEdges.has(edgeKey)) continue;

      const loop: Point[] = [];
      const [sx, sy] = startK.split(',').map(Number);
      let curr = { x: sx, y: sy };
      let next = nextP;

      while (true) {
        const k = `${curr.x},${curr.y}`;
        const eKey = `${k}->${next.x},${next.y}`;
        visitedEdges.add(eKey);
        loop.push(curr);

        curr = next;
        if (curr.x === sx && curr.y === sy) break;

        const candidates = edges.get(`${curr.x},${curr.y}`) || [];
        let chosen: Point | null = null;
        for (const c of candidates) {
          if (!visitedEdges.has(`${curr.x},${curr.y}->${c.x},${c.y}`)) {
            chosen = c;
            break;
          }
        }
        if (!chosen) break;
        next = chosen;
      }

      if (loop.length >= 3) {
        contours.push(loop);
      }
    }
  }
  return contours;
}

/**
 * 多边形外扩与两点平行线求交 (Miter Polygon Offset)
 * 连续三点 A-B-C：
 * - AB 向外平移 N 得直线 L1
 * - BC 向外平移 N 得直线 L2
 * - L1 与 L2 的交点即为外扩后的尖角顶点 B'
 */
export function offsetPolygonWithMiter(
  vertices: Point[],
  borderWidth: number,
  miterLimit = 5
): Point[] {
  const n = vertices.length;
  if (n < 3) return vertices;

  const isClockwise = computeSignedArea(vertices) > 0;
  const offsetPoints: Point[] = [];

  for (let i = 0; i < n; i++) {
    const pPrev = vertices[(i - 1 + n) % n];
    const pCurr = vertices[i];
    const pNext = vertices[(i + 1) % n];

    // 线段 1：pPrev -> pCurr
    const dx1 = pCurr.x - pPrev.x;
    const dy1 = pCurr.y - pPrev.y;
    const len1 = Math.hypot(dx1, dy1);

    // 线段 2：pCurr -> pNext
    const dx2 = pNext.x - pCurr.x;
    const dy2 = pNext.y - pCurr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 === 0 || len2 === 0) {
      offsetPoints.push({ x: pCurr.x, y: pCurr.y });
      continue;
    }

    // 外侧单位法向量 (顺时针外侧与逆时针外侧自适应)
    const nx1 = isClockwise ? dy1 / len1 : -dy1 / len1;
    const ny1 = isClockwise ? -dx1 / len1 : dx1 / len1;

    const nx2 = isClockwise ? dy2 / len2 : -dy2 / len2;
    const ny2 = isClockwise ? -dx2 / len2 : dx2 / len2;

    // 两条平移平行线的交点行列式求解
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-4) {
      // 两平行边共线情况
      offsetPoints.push({ x: pCurr.x + borderWidth * nx1, y: pCurr.y + borderWidth * ny1 });
      continue;
    }

    const p1x = pCurr.x + borderWidth * nx1;
    const p1y = pCurr.y + borderWidth * ny1;
    const p2x = pCurr.x + borderWidth * nx2;
    const p2y = pCurr.y + borderWidth * ny2;

    const t1 = ((p2x - p1x) * dy2 - (p2y - p1y) * dx2) / det;
    const miterX = p1x + t1 * dx1;
    const miterY = p1y + t1 * dy1;

    const distFromVertex = Math.hypot(miterX - pCurr.x, miterY - pCurr.y);
    const maxMiter = miterLimit * borderWidth;

    if (distFromVertex <= maxMiter) {
      offsetPoints.push({ x: miterX, y: miterY });
    } else {
      // 尖角超出限制时做斜切平头截断 (Bevel limit)
      const scale = maxMiter / distFromVertex;
      offsetPoints.push({
        x: pCurr.x + (miterX - pCurr.x) * scale,
        y: pCurr.y + (miterY - pCurr.y) * scale,
      });
    }
  }

  return offsetPoints;
}

/**
 * 沿着图像有效像素最外层计算并绘制外围边框
 */
export async function applyOuterBorderToImage(
  source: HTMLImageElement | HTMLCanvasElement,
  options: OuterBorderOptions
): Promise<OuterBorderResult> {
  const borderWidth = Math.max(1, Math.round(options.borderWidth || 4));
  const borderColor = options.borderColor || '#ffffff';

  const srcW = source instanceof HTMLImageElement ? (source.naturalWidth || source.width) : source.width;
  const srcH = source instanceof HTMLImageElement ? (source.naturalHeight || source.height) : source.height;

  if (srcW <= 0 || srcH <= 0) {
    throw new Error('源图像尺寸无效，无法添加边框');
  }

  // 1. 读取原图像素数据
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcW;
  tempCanvas.height = srcH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) throw new Error('无法创建离屏画布上下文');

  tempCtx.clearRect(0, 0, srcW, srcH);
  tempCtx.drawImage(source, 0, 0);
  const srcImgData = tempCtx.getImageData(0, 0, srcW, srcH);
  const srcPixels = srcImgData.data;

  // 2. 识别有效像素 (Alpha > 10) 并构建掩码
  let minX = srcW;
  let maxX = -1;
  let minY = srcH;
  let maxY = -1;
  let effectivePixelCount = 0;

  const mask = new Uint8Array(srcW * srcH);
  for (let y = 0; y < srcH; y++) {
    const rowOffset = y * srcW;
    for (let x = 0; x < srcW; x++) {
      const alpha = srcPixels[(rowOffset + x) * 4 + 3];
      if (alpha > 10) {
        effectivePixelCount++;
        mask[rowOffset + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 若无有效像素，返回原图副本
  if (effectivePixelCount === 0 || maxX < minX || maxY < minY) {
    return {
      canvas: tempCanvas,
      dataUrl: tempCanvas.toDataURL('image/png'),
      width: srcW,
      height: srcH,
      padLeft: 0,
      padTop: 0,
      padRight: 0,
      padBottom: 0,
    };
  }

  // 3. 提取闭合外轮廓并精简为多边形
  const rawContours = extractContours(mask, srcW, srcH);
  // 过滤顺时针外轮廓（面积 > 10 排除细小孤立杂点）
  const outerContours = rawContours.filter((c) => computeSignedArea(c) > 10);

  // 针对每个外轮廓进行 RDP 精炼与 Miter 外扩
  const polygonGroups: { origin: Point[]; offset: Point[] }[] = [];
  let boundMinX = minX - borderWidth;
  let boundMaxX = maxX + borderWidth;
  let boundMinY = minY - borderWidth;
  let boundMaxY = maxY + borderWidth;

  for (const rawLoop of outerContours) {
    // 采用 1.2px epsilon 化简，直线精确合并为线段，拐角完美提取为顶点
    const simplified = rdp(rawLoop, 1.2);
    if (simplified.length >= 3) {
      const offset = offsetPolygonWithMiter(simplified, borderWidth, 5);
      polygonGroups.push({ origin: simplified, offset });

      // 将尖角交点纳入真实包围盒计算，彻底杜绝角点被截断
      for (const pt of offset) {
        if (pt.x < boundMinX) boundMinX = pt.x;
        if (pt.x > boundMaxX) boundMaxX = pt.x;
        if (pt.y < boundMinY) boundMinY = pt.y;
        if (pt.y > boundMaxY) boundMaxY = pt.y;
      }
    }
  }

  // 4. 计算为完整容纳 Miter 尖角所需的画布扩展边距 (padding)
  const padLeft = Math.max(0, Math.ceil(-boundMinX));
  const padRight = Math.max(0, Math.ceil(boundMaxX - (srcW - 1)));
  const padTop = Math.max(0, Math.ceil(-boundMinY));
  const padBottom = Math.max(0, Math.ceil(boundMaxY - (srcH - 1)));

  const newW = srcW + padLeft + padRight;
  const newH = srcH + padTop + padBottom;

  // 5. 渲染合成输出画布
  const outCanvas = document.createElement('canvas');
  outCanvas.width = newW;
  outCanvas.height = newH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('无法创建输出画布上下文');

  // 先在平移位置绘制原图
  outCtx.drawImage(tempCanvas, padLeft, padTop);

  // 利用 destination-over 将外扩边框无损绘制在原图后方
  // 不破坏原图内容，严格填充外扩平行线与尖角交点区域
  outCtx.save();
  outCtx.globalCompositeOperation = 'destination-over';
  outCtx.fillStyle = borderColor;
  outCtx.strokeStyle = borderColor;
  outCtx.lineWidth = borderWidth * 2;
  outCtx.lineJoin = 'miter';
  outCtx.miterLimit = 5;

  if (polygonGroups.length > 0) {
    for (const group of polygonGroups) {
      // A. 填充由外扩顶点组成的全新外多边形闭合路径 (包含尖角三角形)
      outCtx.beginPath();
      const first = group.offset[0];
      outCtx.moveTo(first.x + padLeft, first.y + padTop);
      for (let i = 1; i < group.offset.length; i++) {
        outCtx.lineTo(group.offset[i].x + padLeft, group.offset[i].y + padTop);
      }
      outCtx.closePath();
      outCtx.fill();

      // B. 沿原轮廓执行一次 Miter 描边，赋予外边缘完美的硬件亚像素抗锯齿
      outCtx.beginPath();
      const originFirst = group.origin[0];
      outCtx.moveTo(originFirst.x + padLeft, originFirst.y + padTop);
      for (let i = 1; i < group.origin.length; i++) {
        outCtx.lineTo(group.origin[i].x + padLeft, group.origin[i].y + padTop);
      }
      outCtx.closePath();
      outCtx.stroke();
    }
  } else {
    // 兜底矩形路径绘制
    outCtx.strokeRect(
      minX + padLeft,
      minY + padTop,
      maxX - minX + 1,
      maxY - minY + 1
    );
  }

  outCtx.restore();

  return {
    canvas: outCanvas,
    dataUrl: outCanvas.toDataURL('image/png'),
    width: newW,
    height: newH,
    padLeft,
    padTop,
    padRight,
    padBottom,
  };
}
