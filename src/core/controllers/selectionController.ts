import React from 'react';
import { Point, SelectionRegion } from '../../types/canvas';
import { isInsideLockedRegion, processLocalDeSpill } from '../algorithms/wand';
import { findNonTransparentBounds } from '../algorithms/crop';

export interface SelectionControllerContext {
  currentImageRef: React.MutableRefObject<string>;
  imageRef: React.RefObject<HTMLImageElement>;
  maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  setMaskCanvas: (canvas: HTMLCanvasElement | null) => void;
  selectionRegionRef: React.MutableRefObject<SelectionRegion | null>;
  setSelectionRegion: (region: SelectionRegion | null) => void;
  isRegionInvertedRef: React.MutableRefObject<boolean>;
  quadPointsRef: React.MutableRefObject<Point[] | null>;
  isPolyClosedRef: React.MutableRefObject<boolean>;
  sampledColorRef: React.MutableRefObject<{ r: number; g: number; b: number; a: number } | null>;
  setSampledColor: (color: { r: number; g: number; b: number; a: number } | null) => void;
  fillColorRef: React.MutableRefObject<string>;
  toleranceRef: React.MutableRefObject<number>;
  spillRadiusRef: React.MutableRefObject<number>;
  setIsLoading: (loading: boolean) => void;
  setActiveTool: (tool: any) => void;
  resolveEffectiveSource: () => Promise<{ source: HTMLImageElement; nw: number; nh: number } | null>;
  commitBaseEditResult: (url: string, prompt?: string, opts?: any) => void;
  clearSelection: () => void;
  resetWand: () => void;
}

export function createSelectionController(ctx: SelectionControllerContext) {
  const isInsideLockedRegionScoped = (x: number, y: number, region: SelectionRegion | null): boolean => {
    return isInsideLockedRegion(x, y, region, ctx.isRegionInvertedRef.current);
  };

  const computeSelection = (
    startX: number,
    startY: number,
    currentTolerance: number,
    mode: 'global' | 'connected',
    region: SelectionRegion | null,
    isAdding: boolean = false
  ) => {
    if (!ctx.imageRef.current) return;
    const img = ctx.imageRef.current;

    const runWandOnCanvas = (canvas: HTMLCanvasElement) => {
      const cCtx = canvas.getContext('2d');
      if (!cCtx) return;
      const imageData = cCtx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const { width, height } = canvas;
      const targetIdx = (startY * width + startX) * 4;
      const [targetR, targetG, targetB, targetA] = [
        data[targetIdx],
        data[targetIdx + 1],
        data[targetIdx + 2],
        data[targetIdx + 3],
      ];
      const nextSampled = { r: targetR, g: targetG, b: targetB, a: targetA };
      ctx.sampledColorRef.current = nextSampled;
      ctx.setSampledColor(nextSampled);
      const mCanvas = document.createElement('canvas');
      mCanvas.width = width;
      mCanvas.height = height;
      const mCtx = mCanvas.getContext('2d');
      if (!mCtx) return;
      if (isAdding && ctx.maskCanvasRef.current) mCtx.drawImage(ctx.maskCanvasRef.current, 0, 0);
      const mImageData = mCtx.getImageData(0, 0, width, height);
      const mData = mImageData.data;
      const tolSq = currentTolerance * currentTolerance;
      let hasSelected = false;
      const isSimilar = (idx: number) => {
        const dr = data[idx] - targetR,
          dg = data[idx + 1] - targetG,
          db = data[idx + 2] - targetB,
          da = data[idx + 3] - targetA;
        return dr * dr + dg * dg + db * db + da * da < tolSq;
      };
      if (mode === 'global') {
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % width,
            y = Math.floor(i / 4 / width);
          if (isSimilar(i) && isInsideLockedRegionScoped(x, y, region)) {
            mData[i] = 255;
            mData[i + 1] = 255;
            mData[i + 2] = 0;
            mData[i + 3] = 180;
            hasSelected = true;
          }
        }
      } else {
        if (!isInsideLockedRegionScoped(startX, startY, region)) return;
        const visited = new Uint8Array(width * height);
        const stack: [number, number][] = [[startX, startY]];
        visited[startY * width + startX] = 1;
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          const pIdx = (cy * width + cx) * 4;
          mData[pIdx] = 255;
          mData[pIdx + 1] = 255;
          mData[pIdx + 2] = 0;
          mData[pIdx + 3] = 180;
          hasSelected = true;
          const neighbors: [number, number][] = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx] && isSimilar(nIdx * 4) && isInsideLockedRegionScoped(nx, ny, region)) {
                visited[nIdx] = 1;
                stack.push([nx, ny]);
              }
            }
          }
        }
      }
      if (hasSelected || isAdding) {
        mCtx.putImageData(mImageData, 0, 0);
        ctx.setMaskCanvas(mCanvas);
      } else {
        ctx.setMaskCanvas(null);
      }
    };

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const cCtx = canvas.getContext('2d');
    if (!cCtx) return;
    cCtx.drawImage(img, 0, 0);
    runWandOnCanvas(canvas);
  };

  const handleApplyQuadCrop = async () => {
    const activeQuad = ctx.quadPointsRef.current;
    if (!activeQuad || !ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      const nw = resolved.nw,
        nh = resolved.nh;
      canvas.width = nw;
      canvas.height = nh;
      const cCtx = canvas.getContext('2d');
      if (!cCtx) return;
      cCtx.clearRect(0, 0, nw, nh);
      cCtx.beginPath();
      cCtx.moveTo(activeQuad[0].x, activeQuad[0].y);
      activeQuad.forEach((p, i) => i > 0 && cCtx.lineTo(p.x, p.y));
      cCtx.closePath();
      cCtx.clip();
      cCtx.drawImage(resolved.source, 0, 0);
      const pixels = cCtx.getImageData(0, 0, nw, nh);
      const bound = findNonTransparentBounds(pixels.data, nw, nh);
      if (bound) {
        const copy = document.createElement('canvas');
        copy.width = bound.width;
        copy.height = bound.height;
        const copyCtx = copy.getContext('2d');
        if (copyCtx) {
          copyCtx.putImageData(cCtx.getImageData(bound.left, bound.top, bound.width, bound.height), 0, 0);
          const res = copy.toDataURL('image/png');
          ctx.commitBaseEditResult(res, '顶点不规则剪裁');
        }
      }
      ctx.setActiveTool(null);
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleFillSelection = async () => {
    const activeMask = ctx.maskCanvasRef.current;
    const activeRegion = ctx.selectionRegionRef.current;
    if ((!activeMask && !activeRegion) || !ctx.currentImageRef.current) return;
    const resolved = await ctx.resolveEffectiveSource();
    if (!resolved) return;
    const canvas = document.createElement('canvas');
    const nw = resolved.nw,
      nh = resolved.nh;
    canvas.width = nw;
    canvas.height = nh;
    const cCtx = canvas.getContext('2d');
    if (!cCtx) return;
    cCtx.clearRect(0, 0, nw, nh);
    cCtx.drawImage(resolved.source, 0, 0);
    const imgDataObj = cCtx.getImageData(0, 0, nw, nh);
    const imgData = imgDataObj.data;
    const colorHex = ctx.fillColorRef.current;
    const r = parseInt(colorHex.slice(1, 3), 16),
      g = parseInt(colorHex.slice(3, 5), 16),
      b = parseInt(colorHex.slice(5, 7), 16);
    if (activeMask) {
      const maskData = activeMask.getContext('2d')?.getImageData(0, 0, nw, nh).data;
      if (maskData) {
        for (let i = 0; i < maskData.length; i += 4) {
          if (maskData[i + 3] > 0) {
            imgData[i] = r;
            imgData[i + 1] = g;
            imgData[i + 2] = b;
            imgData[i + 3] = 255;
          }
        }
      }
    } else if (activeRegion) {
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          if (isInsideLockedRegionScoped(x, y, activeRegion)) {
            const i = (y * nw + x) * 4;
            imgData[i] = r;
            imgData[i + 1] = g;
            imgData[i + 2] = b;
            imgData[i + 3] = 255;
          }
        }
      }
    }
    cCtx.putImageData(imgDataObj, 0, 0);
    const res = canvas.toDataURL('image/png');
    ctx.commitBaseEditResult(res, `选区着色 (${colorHex})`);
    ctx.clearSelection();
  };

  const handleInvertSelection = () => {
    const activeMask = ctx.maskCanvasRef.current;
    if (!activeMask) return;
    const cCtx = activeMask.getContext('2d');
    if (!cCtx) return;
    const imageData = cCtx.getImageData(0, 0, activeMask.width, activeMask.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) data[i + 3] = 0;
      else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 0;
        data[i + 3] = 180;
      }
    }
    const newCanvas = document.createElement('canvas');
    newCanvas.width = activeMask.width;
    newCanvas.height = activeMask.height;
    newCanvas.getContext('2d')?.putImageData(imageData, 0, 0);
    ctx.setMaskCanvas(newCanvas);
  };

  const commitFinalCrop = async () => {
    const activeRegion = ctx.selectionRegionRef.current;
    if (!activeRegion || activeRegion.type !== 'rect' || !ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const r = activeRegion.data;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, r.w);
      canvas.height = Math.max(1, r.h);
      const cCtx = canvas.getContext('2d');
      if (!cCtx) return;
      cCtx.clearRect(0, 0, canvas.width, canvas.height);
      cCtx.drawImage(resolved.source, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const res = canvas.toDataURL('image/png');
      ctx.commitBaseEditResult(res, '精细选区裁剪');
      ctx.setSelectionRegion(null);
      ctx.setActiveTool(null);
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleEraseSelection = async () => {
    const activeMask = ctx.maskCanvasRef.current;
    const activeRegion = ctx.selectionRegionRef.current;
    const activeQuad = ctx.quadPointsRef.current;
    const activePolyClosed = ctx.isPolyClosedRef.current;
    const hasActiveSelection = !!(activeMask || activeRegion || (activeQuad && activePolyClosed));
    if (!ctx.currentImageRef.current || !hasActiveSelection) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const nw = resolved.nw;
      const nh = resolved.nh;
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const cCtx = canvas.getContext('2d');
      if (!cCtx) return;

      cCtx.clearRect(0, 0, nw, nh);
      cCtx.drawImage(resolved.source, 0, 0);
      let modified = false;

      if (activeMask) {
        const maskCtx = activeMask.getContext('2d');
        if (maskCtx) {
          let maskData: Uint8ClampedArray;
          if (activeMask.width === nw && activeMask.height === nh) {
            maskData = maskCtx.getImageData(0, 0, nw, nh).data;
          } else {
            const scaledMask = document.createElement('canvas');
            scaledMask.width = nw;
            scaledMask.height = nh;
            const scaledCtx = scaledMask.getContext('2d');
            if (!scaledCtx) return;
            scaledCtx.drawImage(activeMask, 0, 0, nw, nh);
            maskData = scaledCtx.getImageData(0, 0, nw, nh).data;
          }
          const imgDataObj = cCtx.getImageData(0, 0, nw, nh);
          const data = imgDataObj.data;

          for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i + 3] > 0) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 0;
              modified = true;
            }
          }

          if (ctx.spillRadiusRef.current > 0) {
            processLocalDeSpill(
              data,
              nw,
              nh,
              maskData,
              ctx.sampledColorRef.current,
              ctx.toleranceRef.current,
              ctx.spillRadiusRef.current
            );
          }
          cCtx.putImageData(imgDataObj, 0, 0);
        }
      }

      const inverted = ctx.isRegionInvertedRef.current;
      if (activeRegion?.type === 'rect') {
        const r = activeRegion.data;
        if (!inverted) {
          cCtx.clearRect(r.x, r.y, r.w, r.h);
          modified = true;
        } else {
          cCtx.clearRect(0, 0, nw, r.y);
          cCtx.clearRect(0, r.y + r.h, nw, nh - (r.y + r.h));
          cCtx.clearRect(0, r.y, r.x, r.h);
          cCtx.clearRect(r.x + r.w, r.y, nw - (r.x + r.w), r.h);
          modified = true;
        }
      }

      const pts =
        activeQuad && activePolyClosed
          ? activeQuad
          : activeRegion?.type === 'path'
          ? (activeRegion.data as Point[])
          : null;

      if (pts && pts.length >= 3) {
        cCtx.save();
        cCtx.globalCompositeOperation = 'destination-out';
        cCtx.beginPath();

        if (!inverted) {
          cCtx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((p, idx) => {
            if (idx > 0) cCtx.lineTo(p.x, p.y);
          });
          cCtx.closePath();
          cCtx.fillStyle = '#000000';
          cCtx.fill();
        } else {
          cCtx.rect(0, 0, nw, nh);
          cCtx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((p, idx) => {
            if (idx > 0) cCtx.lineTo(p.x, p.y);
          });
          cCtx.closePath();
          cCtx.fillStyle = '#000000';
          cCtx.fill('evenodd');
        }
        cCtx.restore();
        modified = true;
      }

      if (modified) {
        const res = canvas.toDataURL('image/png');
        ctx.commitBaseEditResult(res, '选区擦除透明');
      }

      ctx.clearSelection();
      ctx.resetWand();
    } finally {
      ctx.setIsLoading(false);
    }
  };

  return {
    computeSelection,
    handleApplyQuadCrop,
    handleFillSelection,
    handleInvertSelection,
    commitFinalCrop,
    handleEraseSelection,
  };
}
