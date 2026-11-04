/**
 * 纸张照片光照估计与阴影消除算法 (Background Illumination Estimation & Division)
 * 
 * 核心原理 (照度-反射率模型 Retinex)：
 * 1. 拍摄图像 I(x, y) = L(x, y) * R(x, y)，其中 L 为低频光照阴影，R 为文字与反射率；
 * 2. 降采样至适度尺度，运行大核形态学膨胀 (Dilation / Max Filter)，彻底抹去细窄的文字笔画，仅提取纸面底层光照；
 * 3. 低通模糊平滑光照分布，并由 GPU 高保真插值上采样还原为全分辨率光照图；
 * 4. 逐像素执行通道独立的光照除法归一化 R = I / L * 255，并结合白点动态拉伸 (White Point Stretch)；
 * 5. 消除拍摄阴影、折痕暗角与发黄底色，使纸面变平整纯白，同时 100% 完整保留黑色文字、彩色印章与手写批注。
 */

export interface DeShadowOptions {
  /**
   * 白点截断阈值 (0~255)，高于此亮度的纸面直接收敛为 255 纯白
   * 默认 228
   */
  whitePoint?: number;
  /**
   * 光照估计降采样尺度 (最长边像素)，默认 320
   */
  sampleSize?: number;
  /**
   * 形态学膨胀核半宽 (在降采样尺度下)，默认 6
   */
  dilationRadius?: number;
}

/**
 * 执行纸张阴影消除与平底白化
 */
export function performDocumentShadowRemoval(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  options: DeShadowOptions = {}
): HTMLCanvasElement {
  const srcW = 'naturalWidth' in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
  const srcH = 'naturalHeight' in sourceImage ? sourceImage.naturalHeight : sourceImage.height;

  if (srcW <= 0 || srcH <= 0) {
    throw new Error('无效的源图像尺寸');
  }

  const whitePoint = options.whitePoint ?? 228;
  const sampleSize = options.sampleSize ?? 320;
  const dilationRadius = options.dilationRadius ?? 6;

  // 1. 获取原图全分辨率 ImageData
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) {
    throw new Error('无法初始化源图像上下文');
  }
  srcCtx.drawImage(sourceImage, 0, 0, srcW, srcH);
  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcData = srcImgData.data;

  // 2. 降采样抽取用于光照估计的小尺寸图像
  const scale = Math.min(1, sampleSize / Math.max(srcW, srcH));
  const dw = Math.max(16, Math.round(srcW * scale));
  const dh = Math.max(16, Math.round(srcH * scale));

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = dw;
  sampleCanvas.height = dh;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) {
    throw new Error('无法初始化光照估计采样上下文');
  }
  sampleCtx.drawImage(srcCanvas, 0, 0, dw, dh);
  const sampleData = sampleCtx.getImageData(0, 0, dw, dh).data;

  // 提取通道数据
  const downR = new Float32Array(dw * dh);
  const downG = new Float32Array(dw * dh);
  const downB = new Float32Array(dw * dh);

  for (let i = 0, p = 0; i < sampleData.length; i += 4, p++) {
    downR[p] = sampleData[i];
    downG[p] = sampleData[i + 1];
    downB[p] = sampleData[i + 2];
  }

  // 3. 可分离形态学膨胀 (Separable Max Filter)，抹杀笔画细节
  const rad = Math.max(2, dilationRadius);
  const tempR = new Float32Array(dw * dh);
  const tempG = new Float32Array(dw * dh);
  const tempB = new Float32Array(dw * dh);

  const dilR = new Float32Array(dw * dh);
  const dilG = new Float32Array(dw * dh);
  const dilB = new Float32Array(dw * dh);

  // 水平膨胀
  for (let y = 0; y < dh; y++) {
    const rowOffset = y * dw;
    for (let x = 0; x < dw; x++) {
      let mxR = 0, mxG = 0, mxB = 0;
      const xMin = Math.max(0, x - rad);
      const xMax = Math.min(dw - 1, x + rad);
      for (let kx = xMin; kx <= xMax; kx++) {
        const idx = rowOffset + kx;
        if (downR[idx] > mxR) mxR = downR[idx];
        if (downG[idx] > mxG) mxG = downG[idx];
        if (downB[idx] > mxB) mxB = downB[idx];
      }
      tempR[rowOffset + x] = mxR;
      tempG[rowOffset + x] = mxG;
      tempB[rowOffset + x] = mxB;
    }
  }

  // 垂直膨胀
  for (let y = 0; y < dh; y++) {
    const yMin = Math.max(0, y - rad);
    const yMax = Math.min(dh - 1, y + rad);
    for (let x = 0; x < dw; x++) {
      let mxR = 0, mxG = 0, mxB = 0;
      for (let ky = yMin; ky <= yMax; ky++) {
        const idx = ky * dw + x;
        if (tempR[idx] > mxR) mxR = tempR[idx];
        if (tempG[idx] > mxG) mxG = tempG[idx];
        if (tempB[idx] > mxB) mxB = tempB[idx];
      }
      dilR[y * dw + x] = mxR;
      dilG[y * dw + x] = mxG;
      dilB[y * dw + x] = mxB;
    }
  }

  // 4. 平滑模糊 (Box Blur)，形成平缓自然的光照渐变场
  const bRad = Math.max(3, Math.round(rad * 1.2));
  const blurR = new Float32Array(dw * dh);
  const blurG = new Float32Array(dw * dh);
  const blurB = new Float32Array(dw * dh);

  // 水平盒式模糊
  for (let y = 0; y < dh; y++) {
    const rowOffset = y * dw;
    for (let x = 0; x < dw; x++) {
      let sR = 0, sG = 0, sB = 0, cnt = 0;
      const xMin = Math.max(0, x - bRad);
      const xMax = Math.min(dw - 1, x + bRad);
      for (let kx = xMin; kx <= xMax; kx++) {
        const idx = rowOffset + kx;
        sR += dilR[idx];
        sG += dilG[idx];
        sB += dilB[idx];
        cnt++;
      }
      tempR[rowOffset + x] = sR / cnt;
      tempG[rowOffset + x] = sG / cnt;
      tempB[rowOffset + x] = sB / cnt;
    }
  }

  // 垂直盒式模糊
  for (let y = 0; y < dh; y++) {
    const yMin = Math.max(0, y - bRad);
    const yMax = Math.min(dh - 1, y + bRad);
    for (let x = 0; x < dw; x++) {
      let sR = 0, sG = 0, sB = 0, cnt = 0;
      for (let ky = yMin; ky <= yMax; ky++) {
        const idx = ky * dw + x;
        sR += tempR[idx];
        sG += tempG[idx];
        sB += tempB[idx];
        cnt++;
      }
      blurR[y * dw + x] = sR / cnt;
      blurG[y * dw + x] = sG / cnt;
      blurB[y * dw + x] = sB / cnt;
    }
  }

  // 5. 将平滑低频光照场绘制回小 Canvas，利用浏览器 GPU 高保真插值上采样至全分辨率
  const lightSmallCanvas = document.createElement('canvas');
  lightSmallCanvas.width = dw;
  lightSmallCanvas.height = dh;
  const lightSmallCtx = lightSmallCanvas.getContext('2d');
  if (!lightSmallCtx) {
    throw new Error('无法初始化低频光照 Canvas');
  }

  const lightSmallImgData = lightSmallCtx.createImageData(dw, dh);
  const lightSmallData = lightSmallImgData.data;
  for (let i = 0, p = 0; i < lightSmallData.length; i += 4, p++) {
    lightSmallData[i] = Math.min(255, Math.max(1, Math.round(blurR[p])));
    lightSmallData[i + 1] = Math.min(255, Math.max(1, Math.round(blurG[p])));
    lightSmallData[i + 2] = Math.min(255, Math.max(1, Math.round(blurB[p])));
    lightSmallData[i + 3] = 255;
  }
  lightSmallCtx.putImageData(lightSmallImgData, 0, 0);

  const fullLightCanvas = document.createElement('canvas');
  fullLightCanvas.width = srcW;
  fullLightCanvas.height = srcH;
  const fullLightCtx = fullLightCanvas.getContext('2d', { willReadFrequently: true });
  if (!fullLightCtx) {
    throw new Error('无法初始化全分辨率光照采样上下文');
  }
  fullLightCtx.imageSmoothingEnabled = true;
  fullLightCtx.imageSmoothingQuality = 'high';
  fullLightCtx.drawImage(lightSmallCanvas, 0, 0, srcW, srcH);
  const fullLightData = fullLightCtx.getImageData(0, 0, srcW, srcH).data;

  // 6. 逐像素通道除法归一化与白场对比度拉伸
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = srcW;
  resultCanvas.height = srcH;
  const resCtx = resultCanvas.getContext('2d');
  if (!resCtx) {
    throw new Error('无法初始化输出图像上下文');
  }

  const resImgData = resCtx.createImageData(srcW, srcH);
  const dstData = resImgData.data;
  const wp = Math.max(150, Math.min(255, whitePoint));

  for (let i = 0; i < srcData.length; i += 4) {
    const bgR = Math.max(1, fullLightData[i]);
    const bgG = Math.max(1, fullLightData[i + 1]);
    const bgB = Math.max(1, fullLightData[i + 2]);

    // 光照除法归一化 (0~255)
    const rNorm = (srcData[i] / bgR) * 255;
    const gNorm = (srcData[i + 1] / bgG) * 255;
    const bNorm = (srcData[i + 2] / bgB) * 255;

    // 白点平底拉伸：高于 wp 的直接归入 255 纯白，下方平滑拉伸
    dstData[i]     = Math.min(255, Math.max(0, Math.round((rNorm / wp) * 255)));
    dstData[i + 1] = Math.min(255, Math.max(0, Math.round((gNorm / wp) * 255)));
    dstData[i + 2] = Math.min(255, Math.max(0, Math.round((bNorm / wp) * 255)));

    // 保持源图像的透明度 Alpha 通道
    dstData[i + 3] = srcData[i + 3];
  }

  resCtx.putImageData(resImgData, 0, 0);
  return resultCanvas;
}

