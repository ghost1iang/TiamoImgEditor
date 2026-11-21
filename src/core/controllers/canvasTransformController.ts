import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Point, SelectionRegion } from '../../types/canvas';
import type { GraphicLayer, BaseElementTransform, HistoryRecord } from '../useImageEditorCore';
import { executeSparseHdReconstruction } from '../algorithms/sparseHd';
import { performPerspectiveOrthogonalization, detectOrthoQuadCorners } from '../algorithms/ortho';
import { performDocumentShadowRemoval } from '../algorithms/deShadow';
import { applyOuterBorderToImage } from '../algorithms/border';
import { findNonTransparentBounds } from '../algorithms/crop';

export interface CanvasTransformControllerContext {
  currentImageRef: MutableRefObject<string | null>;
  imageRef: MutableRefObject<HTMLImageElement | null>;
  rotationAngleRef: MutableRefObject<number>;
  selectedGraphicIdRef: MutableRefObject<string | null>;
  importedGraphicsRef: MutableRefObject<GraphicLayer[]>;
  baseLayerIndexRef: MutableRefObject<number>;
  baseElementRef: MutableRefObject<BaseElementTransform | null>;
  borderWidthRef: MutableRefObject<number>;
  borderColorRef: MutableRefObject<string>;
  hdBoxRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  panOffsetRef: MutableRefObject<{ x: number; y: number }>;
  zoomRef: MutableRefObject<number>;
  orthoPoints: Point[] | null;
  maskCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  selectionRegionRef: MutableRefObject<SelectionRegion | null>;
  quadPointsRef: MutableRefObject<Point[] | null>;
  isPolyClosedRef: MutableRefObject<boolean>;

  setIsLoading: (val: boolean) => void;
  setIsHdProcessing: (val: boolean) => void;
  setRotationAngle: (val: number) => void;
  setActiveTool: (tool: any) => void;
  setErrorMessage: (msg: string | null) => void;
  setOrthoPoints: Dispatch<SetStateAction<Point[] | null>>;
  setDraggingOrthoIdx: (idx: number) => void;
  setOrthoMagnifier: (val: any) => void;
  setHdOriginalImage: (val: string | null) => void;
  setIsComparingOriginal: (val: boolean) => void;
  setDisplaySize: (size: { width: number; height: number } | null) => void;
  setPanOffset: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setHdBox: Dispatch<SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
  setMaskCanvas: (canvas: HTMLCanvasElement | null) => void;
  setLastClickPos: (pos: (Point & { isAdding: boolean }) | null) => void;
  setQuadPoints: (pts: Point[] | null) => void;
  setIsPolyClosed: (val: boolean) => void;
  setPolyHoverClose: (val: boolean) => void;
  setPolyMousePos: (pos: Point | null) => void;
  setSelectionRegion: Dispatch<SetStateAction<SelectionRegion | null>>;
  setImportedGraphics: Dispatch<SetStateAction<GraphicLayer[]>>;
  setHistory: Dispatch<SetStateAction<HistoryRecord[]>>;
  setActiveRecord: (rec: HistoryRecord | null) => void;

  resolveEffectiveSource: () => Promise<{ source: HTMLImageElement; nw: number; nh: number } | null>;
  commitBaseEditResult: (url: string, prompt: string, meta?: Record<string, any>) => void;
  clearSelection: () => void;
  commitFinalCrop: () => Promise<void>;
  handleGraphicFlip: (dir: 'flipH' | 'flipV') => Promise<void>;
  handleGraphicRotate90: (dir: 'cw' | 'ccw') => Promise<void>;
}

export function createCanvasTransformController(ctx: CanvasTransformControllerContext) {
  const handleApplyRotation = async () => {
    const angle = ctx.rotationAngleRef.current;
    if (!ctx.currentImageRef.current || angle === 0) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const angleRad = (angle * Math.PI) / 180;
      const srcW = resolved.nw;
      const srcH = resolved.nh;

      const nw = Math.abs(srcW * Math.cos(angleRad)) + Math.abs(srcH * Math.sin(angleRad));
      const nh = Math.abs(srcW * Math.sin(angleRad)) + Math.abs(srcH * Math.cos(angleRad));

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.clearRect(0, 0, nw, nh);
      canvasCtx.translate(nw / 2, nh / 2);
      canvasCtx.rotate(angleRad);
      canvasCtx.drawImage(resolved.source, -srcW / 2, -srcH / 2);

      const res = canvas.toDataURL('image/png');
      ctx.commitBaseEditResult(res, `旋转图像 (${angle}°)`);
      ctx.setRotationAngle(0);
      ctx.setActiveTool(null);
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleFlipHorizontal = async () => {
    if (ctx.selectedGraphicIdRef.current) {
      await ctx.handleGraphicFlip('flipH');
      return;
    }
    if (!ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nw;
      canvas.height = resolved.nh;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.translate(canvas.width, 0);
      canvasCtx.scale(-1, 1);
      canvasCtx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      ctx.commitBaseEditResult(res, '水平镜像');
      ctx.clearSelection();
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleFlipVertical = async () => {
    if (ctx.selectedGraphicIdRef.current) {
      await ctx.handleGraphicFlip('flipV');
      return;
    }
    if (!ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nw;
      canvas.height = resolved.nh;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.translate(0, canvas.height);
      canvasCtx.scale(1, -1);
      canvasCtx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      ctx.commitBaseEditResult(res, '垂直镜像');
      ctx.clearSelection();
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleRotate90 = async (direction: 'cw' | 'ccw' = 'cw') => {
    if (ctx.selectedGraphicIdRef.current) {
      await ctx.handleGraphicRotate90(direction);
      return;
    }
    if (!ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nh;
      canvas.height = resolved.nw;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      if (direction === 'cw') {
        canvasCtx.translate(canvas.width, 0);
        canvasCtx.rotate(Math.PI / 2);
      } else {
        canvasCtx.translate(0, canvas.height);
        canvasCtx.rotate(-Math.PI / 2);
      }
      canvasCtx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      ctx.commitBaseEditResult(res, direction === 'cw' ? '顺时针旋转 90°' : '逆时针旋转 90°');
      ctx.clearSelection();
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const applySparseHD = (targetW: number, targetH: number) => {
    const originalImgUrl = ctx.currentImageRef.current;
    if (!originalImgUrl || !ctx.imageRef.current) return;
    const img = ctx.imageRef.current;
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const origClientW = img.clientWidth;
    const origClientH = img.clientHeight;

    if (targetW <= origW && targetH <= origH) {
      return;
    }

    const box = ctx.hdBoxRef.current ? { ...ctx.hdBoxRef.current } : { x: 0, y: 0, w: targetW, h: targetH };
    const currentPan = { ...ctx.panOffsetRef.current };
    const currentZoom = ctx.zoomRef.current;

    ctx.setIsHdProcessing(true);

    setTimeout(async () => {
      try {
        const resolved = await ctx.resolveEffectiveSource();
        const hdSource = resolved ? resolved.source : img;
        const newBase64 = executeSparseHdReconstruction(hdSource, origW, origH, targetW, targetH);

        const ratioW = targetW / origW;
        const ratioH = targetH / origH;
        const targetDisplayW = Math.round(origClientW * ratioW);
        const targetDisplayH = Math.round(origClientH * ratioH);

        const offsetX = origClientW * (box.x / origW);
        const offsetY = origClientH * (box.y / origH);

        const centerShiftX = offsetX + (targetDisplayW - origClientW) / 2;
        const centerShiftY = offsetY + (targetDisplayH - origClientH) / 2;

        const newPanX = Math.round(currentPan.x + centerShiftX * currentZoom);
        const newPanY = Math.round(currentPan.y + centerShiftY * currentZoom);

        ctx.setHdOriginalImage(originalImgUrl);
        ctx.setIsComparingOriginal(false);
        ctx.setDisplaySize({ width: targetDisplayW, height: targetDisplayH });
        ctx.setPanOffset({ x: newPanX, y: newPanY });
        ctx.commitBaseEditResult(
          newBase64,
          `稀疏高清重构: ${targetW} × ${targetH} (${Math.round(ratioW * 100)}%×${Math.round(ratioH * 100)}%)`,
          {
            originalUrl: originalImgUrl,
            width: targetW,
            height: targetH,
            displaySize: { width: targetDisplayW, height: targetDisplayH },
            panOffset: { x: newPanX, y: newPanY },
          }
        );
        ctx.setMaskCanvas(null);
        ctx.setLastClickPos(null);
        ctx.setQuadPoints(null);
        ctx.setIsPolyClosed(false);
        ctx.setPolyHoverClose(false);
        ctx.setPolyMousePos(null);
        ctx.setSelectionRegion(null);
        ctx.setActiveTool('hd');
        ctx.setHdBox({ x: 0, y: 0, w: targetW, h: targetH });
      } catch (err: any) {
        console.error('[SparseHD Error]', err);
        ctx.setErrorMessage(`高清化重构异常: ${err?.message || err}`);
      } finally {
        ctx.setIsHdProcessing(false);
      }
    }, 40);
  };

  const handleResetOrthoPoints = () => {
    if (!ctx.imageRef.current) return;
    const nw = ctx.imageRef.current.naturalWidth;
    const nh = ctx.imageRef.current.naturalHeight;
    const marginX = Math.round(nw * 0.15);
    const marginY = Math.round(nh * 0.15);
    ctx.setOrthoPoints([
      { x: marginX, y: marginY },
      { x: nw - marginX, y: marginY },
      { x: nw - marginX, y: nh - marginY },
      { x: marginX, y: nh - marginY },
    ]);
  };

  const handleApplyOrtho = () => {
    if (!ctx.orthoPoints || ctx.orthoPoints.length !== 4 || !ctx.currentImageRef.current) return;
    const targetPoints = ctx.orthoPoints.map((p) => ({ ...p }));
    ctx.setIsLoading(true);
    setTimeout(async () => {
      try {
        const resolved = await ctx.resolveEffectiveSource();
        if (!resolved) return;
        const resCanvas = performPerspectiveOrthogonalization(resolved.source, targetPoints);
        const resUrl = resCanvas.toDataURL('image/png');
        ctx.commitBaseEditResult(resUrl, '矩形正交化校正', {
          width: resCanvas.width,
          height: resCanvas.height,
        });
        ctx.setOrthoPoints(null);
        ctx.setActiveTool(null);
      } catch (err: any) {
        console.error('[Ortho Error]', err);
        ctx.setErrorMessage(`正交化校正失败: ${err?.message || err}`);
      } finally {
        ctx.setIsLoading(false);
        ctx.setDraggingOrthoIdx(-1);
        ctx.setOrthoMagnifier(null);
      }
    }, 50);
  };

  const handleApplyDeShadow = () => {
    if (!ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    setTimeout(async () => {
      try {
        const resolved = await ctx.resolveEffectiveSource();
        if (!resolved) return;
        const resCanvas = performDocumentShadowRemoval(resolved.source);
        const resUrl = resCanvas.toDataURL('image/png');
        ctx.commitBaseEditResult(resUrl, '纸张白化去影', {
          width: resCanvas.width,
          height: resCanvas.height,
        });
      } catch (err: any) {
        console.error('[DeShadow Error]', err);
        ctx.setErrorMessage(`去阴影失败: ${err?.message || err}`);
      } finally {
        ctx.setIsLoading(false);
      }
    }, 50);
  };

  const handleAutoDetectOrtho = async () => {
    if (!ctx.currentImageRef.current) return;
    try {
      const resolved = await ctx.resolveEffectiveSource();
      const targetSource = resolved ? resolved.source : ctx.imageRef.current;
      if (!targetSource) return;
      const { points } = detectOrthoQuadCorners(targetSource);
      ctx.setOrthoPoints(points);
      ctx.setActiveTool('ortho');
    } catch (err: any) {
      console.error('[AutoDetectOrtho Error]', err);
      handleResetOrthoPoints();
      ctx.setActiveTool('ortho');
    }
  };

  const handleApplyBorder = async () => {
    const selId = ctx.selectedGraphicIdRef.current;
    if (selId) {
      const g = ctx.importedGraphicsRef.current.find((item) => item.id === selId);
      if (g) {
        ctx.setIsLoading(true);
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = g.url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const res = await applyOuterBorderToImage(img, {
            borderWidth: ctx.borderWidthRef.current,
            borderColor: ctx.borderColorRef.current,
          });
          const scaleX = g.w / (g.naturalWidth || g.w) || 1;
          const scaleY = g.h / (g.naturalHeight || g.h) || 1;
          const nextGraphics = ctx.importedGraphicsRef.current.map((item) => {
            if (item.id !== selId) return item;
            return {
              ...item,
              url: res.dataUrl,
              w: Math.round(item.w + (res.padLeft + res.padRight) * scaleX),
              h: Math.round(item.h + (res.padTop + res.padBottom) * scaleY),
              x: Math.round(item.x - res.padLeft * scaleX),
              y: Math.round(item.y - res.padTop * scaleY),
              naturalWidth: res.width,
              naturalHeight: res.height,
            };
          });
          ctx.importedGraphicsRef.current = nextGraphics;
          ctx.setImportedGraphics(nextGraphics);

          const rec: HistoryRecord = {
            id: Date.now(),
            prompt: `为图形添加边框 (${ctx.borderWidthRef.current}px)`,
            url: ctx.currentImageRef.current || '',
            timestamp: new Date().toLocaleTimeString(),
            layerState: {
              graphics: nextGraphics.map((item) => ({ ...item })),
              baseLayerIndex: ctx.baseLayerIndexRef.current,
              baseElement: ctx.baseElementRef.current ? { ...ctx.baseElementRef.current } : null,
            },
          };
          ctx.setHistory((prev) => [rec, ...prev]);
          ctx.setActiveRecord(rec);
        } catch (err: any) {
          console.error('[handleApplyBorder graphic]', err);
          ctx.setErrorMessage(String(err?.message || err));
        } finally {
          ctx.setIsLoading(false);
        }
        return;
      }
    }

    if (!ctx.currentImageRef.current) return;
    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return;

      const res = await applyOuterBorderToImage(resolved.source, {
        borderWidth: ctx.borderWidthRef.current,
        borderColor: ctx.borderColorRef.current,
      });

      if (res.padLeft > 0 || res.padTop > 0) {
        if (ctx.baseElementRef.current) {
          ctx.baseElementRef.current = {
            ...ctx.baseElementRef.current,
            x: ctx.baseElementRef.current.x + res.padLeft,
            y: ctx.baseElementRef.current.y + res.padTop,
          };
        }
        if (ctx.importedGraphicsRef.current.length > 0) {
          const shiftedGraphics = ctx.importedGraphicsRef.current.map((g) => ({
            ...g,
            x: g.x + res.padLeft,
            y: g.y + res.padTop,
          }));
          ctx.importedGraphicsRef.current = shiftedGraphics;
          ctx.setImportedGraphics(shiftedGraphics);
        }
      }

      ctx.setDisplaySize(null);
      ctx.commitBaseEditResult(res.dataUrl, `添加有效像素边框 (${ctx.borderWidthRef.current}px)`);
    } catch (err: any) {
      console.error('[handleApplyBorder base]', err);
      ctx.setErrorMessage(String(err?.message || err));
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleCropTransparency = async () => {
    if (!ctx.currentImageRef.current) return;
    const resolved = await ctx.resolveEffectiveSource();
    if (!resolved) return;
    const canvas = document.createElement('canvas');
    canvas.width = resolved.nw;
    canvas.height = resolved.nh;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    canvasCtx.drawImage(resolved.source, 0, 0);
    const pixels = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    const bound = findNonTransparentBounds(pixels.data, canvas.width, canvas.height);
    if (bound) {
      ctx.setSelectionRegion({ type: 'rect', data: { x: bound.left, y: bound.top, w: bound.width, h: bound.height } });
      ctx.setActiveTool('rect');
    }
  };

  const handleCropSelection = async () => {
    const activeMask = ctx.maskCanvasRef.current;
    const activeRegion = ctx.selectionRegionRef.current;
    const activeQuad = ctx.quadPointsRef.current;
    const activePolyClosed = ctx.isPolyClosedRef.current;
    if (!ctx.currentImageRef.current || !(activeMask || activeRegion || (activeQuad && activePolyClosed))) return;

    if (activeRegion?.type === 'rect') {
      await ctx.commitFinalCrop();
      return;
    }

    const pts =
      activeQuad && activePolyClosed
        ? activeQuad
        : activeRegion?.type === 'path'
          ? (activeRegion.data as Point[])
          : null;
    if (pts && pts.length >= 3) {
      ctx.setIsLoading(true);
      try {
        const resolved = await ctx.resolveEffectiveSource();
        if (!resolved) return;
        const nw = resolved.nw,
          nh = resolved.nh;
        const canvas = document.createElement('canvas');
        canvas.width = nw;
        canvas.height = nh;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;
        canvasCtx.clearRect(0, 0, nw, nh);
        canvasCtx.beginPath();
        canvasCtx.moveTo(pts[0].x, pts[0].y);
        pts.forEach((p, i) => i > 0 && canvasCtx.lineTo(p.x, p.y));
        canvasCtx.closePath();
        canvasCtx.clip();
        canvasCtx.drawImage(resolved.source, 0, 0);

        const pixels = canvasCtx.getImageData(0, 0, nw, nh);
        const bound = findNonTransparentBounds(pixels.data, nw, nh);
        if (bound) {
          const copy = document.createElement('canvas');
          copy.width = bound.width;
          copy.height = bound.height;
          const copyCtx = copy.getContext('2d');
          if (copyCtx) {
            copyCtx.putImageData(canvasCtx.getImageData(bound.left, bound.top, bound.width, bound.height), 0, 0);
            const res = copy.toDataURL('image/png');
            ctx.commitBaseEditResult(res, '按选区剪裁');
          }
        }
        ctx.clearSelection();
      } finally {
        ctx.setIsLoading(false);
      }
      return;
    }

    if (activeMask) {
      ctx.setIsLoading(true);
      try {
        const resolved = await ctx.resolveEffectiveSource();
        if (!resolved) return;
        const nw = resolved.nw,
          nh = resolved.nh;
        const maskCtx = activeMask.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, nw, nh).data;
          let bound = {
            top: null as number | null,
            left: null as number | null,
            right: null as number | null,
            bottom: null as number | null,
          };
          for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i + 3] > 0) {
              const x = (i / 4) % nw,
                y = Math.floor(i / 4 / nw);
              if (bound.top === null || y < bound.top) bound.top = y;
              if (bound.left === null || x < bound.left) bound.left = x;
              if (bound.right === null || x > bound.right) bound.right = x;
              if (bound.bottom === null || y > bound.bottom) bound.bottom = y;
            }
          }
          if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
            const canvas = document.createElement('canvas');
            const tw = bound.right - bound.left + 1,
              th = bound.bottom - bound.top + 1;
            canvas.width = tw;
            canvas.height = th;
            const canvasCtx = canvas.getContext('2d');
            if (canvasCtx) {
              canvasCtx.clearRect(0, 0, tw, th);
              canvasCtx.drawImage(resolved.source, bound.left, bound.top, tw, th, 0, 0, tw, th);
              const res = canvas.toDataURL('image/png');
              ctx.commitBaseEditResult(res, '魔棒选区剪裁');
            }
          }
        }
        ctx.clearSelection();
      } finally {
        ctx.setIsLoading(false);
      }
    }
  };

  return {
    handleApplyRotation,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    applySparseHD,
    handleResetOrthoPoints,
    handleApplyOrtho,
    handleApplyDeShadow,
    handleAutoDetectOrtho,
    handleApplyBorder,
    handleCropTransparency,
    handleCropSelection,
  };
}
