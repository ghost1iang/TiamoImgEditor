/**
 * 图像稀疏插值与超分高清重构纯算法模块
 * 
 * 原理：
 * 1. 2x 循环放大倍数，保持原始像素位于网格采样点，其余置空白；
 * 2. 依次执行横向均值插值与纵向均值插值；
 * 3. 达到或超越目标尺寸后，双线性降采样收敛至目标尺寸 W' x H'。
 */

export function executeSparseHdReconstruction(
  img: HTMLImageElement,
  origW: number,
  origH: number,
  targetW: number,
  targetH: number
): string {
  let curCanvas = document.createElement('canvas');
  curCanvas.width = origW;
  curCanvas.height = origH;
  const curCtx = curCanvas.getContext('2d')!;
  curCtx.drawImage(img, 0, 0);

  let curW = origW;
  let curH = origH;

  // 循环执行稀疏化与双向插值
  while (true) {
    const nextW = curW * 2;
    const nextH = curH * 2;

    const srcCtx = curCanvas.getContext('2d')!;
    const srcData = srcCtx.getImageData(0, 0, curW, curH).data;

    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = nextW;
    nextCanvas.height = nextH;
    const nextCtx = nextCanvas.getContext('2d')!;
    const nextImageData = nextCtx.createImageData(nextW, nextH);
    const nextData = nextImageData.data;

    // 1. 放置原始像素，其余为空白像素
    for (let y = 0; y < curH; y++) {
      for (let x = 0; x < curW; x++) {
        const sIdx = (y * curW + x) * 4;
        const tIdx = ((y * 2) * nextW + (x * 2)) * 4;
        nextData[tIdx] = srcData[sIdx];
        nextData[tIdx + 1] = srcData[sIdx + 1];
        nextData[tIdx + 2] = srcData[sIdx + 2];
        nextData[tIdx + 3] = srcData[sIdx + 3];
      }
    }

    // 2. 横向填充，用两个原始像素的平均值填充中间的空白像素
    for (let y = 0; y < nextH; y += 2) {
      for (let x = 0; x < nextW - 2; x += 2) {
        const lIdx = (y * nextW + x) * 4;
        const rIdx = (y * nextW + x + 2) * 4;
        const mIdx = (y * nextW + x + 1) * 4;
        for (let c = 0; c < 4; c++) {
          nextData[mIdx + c] = Math.round((nextData[lIdx + c] + nextData[rIdx + c]) / 2);
        }
      }
      // 边缘最后一列处理 (复制倒数第二列)
      const lastPrev = (y * nextW + nextW - 2) * 4;
      const last = (y * nextW + nextW - 1) * 4;
      for (let c = 0; c < 4; c++) {
        nextData[last + c] = nextData[lastPrev + c];
      }
    }

    // 3. 纵向填充，用两个已有像素的平均值填充中间的空白像素
    for (let x = 0; x < nextW; x++) {
      for (let y = 0; y < nextH - 2; y += 2) {
        const tIdx = (y * nextW + x) * 4;
        const bIdx = ((y + 2) * nextW + x) * 4;
        const mIdx = ((y + 1) * nextW + x) * 4;
        for (let c = 0; c < 4; c++) {
          nextData[mIdx + c] = Math.round((nextData[tIdx + c] + nextData[bIdx + c]) / 2);
        }
      }
      // 边缘最后一行处理 (复制倒数第二行)
      const lastPrev = ((nextH - 2) * nextW + x) * 4;
      const last = ((nextH - 1) * nextW + x) * 4;
      for (let c = 0; c < 4; c++) {
        nextData[last + c] = nextData[lastPrev + c];
      }
    }

    nextCtx.putImageData(nextImageData, 0, 0);
    curCanvas = nextCanvas;
    curW = nextW;
    curH = nextH;

    // 是否 2W >= W' 且 2H >= H'
    if (curW >= targetW && curH >= targetH) {
      break;
    }
  }

  // 4. 把生成的高清化结果缩放到最终目标尺寸 W' x H'
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(curCanvas, 0, 0, targetW, targetH);

  return finalCanvas.toDataURL('image/png');
}

