import React from 'react';
import {
  GraphicInputSource,
  ImportGraphicOptions,
  ImportedGraphic,
  GraphicLayerOrderAction,
  OnRequestImportGraphicHandler,
  EightPointHandleId,
  resolveGraphicSourceToDataUrl,
  transformGraphicImage,
  reorderGraphicLayer,
  compositeSingleGraphicToCanvas,
  calculateExpandedCanvasBounds,
  renderExpandedBaseCanvas,
  GraphicBox,
  EditorLayerState,
  parseEditorLayerState,
} from '../algorithms/graphicLayer';
import { HistoryRecord } from '../useImageEditorCore';

export interface GraphicLayerControllerContext {
  version: string;
  imageRef: React.RefObject<HTMLImageElement>;
  currentImageRef: React.MutableRefObject<string>;
  importedGraphicsRef: React.MutableRefObject<ImportedGraphic[]>;
  setImportedGraphics: (list: ImportedGraphic[]) => void;
  selectedGraphicIdRef: React.MutableRefObject<string | null>;
  setSelectedGraphicId: (id: string | null) => void;
  baseLayerIndexRef: React.MutableRefObject<number>;
  setBaseLayerIndex: (idx: number) => void;
  baseElementRef: React.MutableRefObject<(GraphicBox & { url: string }) | null>;
  graphicDragStateRef: React.MutableRefObject<any>;
  setGraphicDragState: (s: any) => void;
  pendingGraphicDeselectRef: React.MutableRefObject<any>;
  setGraphicSnapLines: (lines: { x: number | null; y: number | null }) => void;
  onRequestImportGraphicRef: React.MutableRefObject<OnRequestImportGraphicHandler | undefined>;
  setActiveTool: (tool: any) => void;
  setSelectionRegion: (region: any) => void;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setHistory: React.Dispatch<React.SetStateAction<HistoryRecord[]>>;
  setCurrentImage: (url: string) => void;
  setActiveRecord: (rec: HistoryRecord) => void;
  panOffsetRef: React.MutableRefObject<{ x: number; y: number }>;
  setPanOffset: (pos: { x: number; y: number }) => void;
  zoomRef: React.MutableRefObject<number>;
  setDisplaySize: (size: { width: number; height: number } | null) => void;
  resolveEffectiveSource: () => Promise<{ source: HTMLImageElement; nw: number; nh: number } | null>;
}

export function createGraphicLayerController(ctx: GraphicLayerControllerContext) {
  const importGraphic = async (
    source: GraphicInputSource,
    importOpts?: ImportGraphicOptions
  ): Promise<ImportedGraphic | null> => {
    try {
      const { dataUrl, naturalWidth: gW, naturalHeight: gH, defaultName } = await resolveGraphicSourceToDataUrl(source);
      const nw = ctx.imageRef.current?.naturalWidth || gW || 400;
      const nh = ctx.imageRef.current?.naturalHeight || gH || 400;

      const aspect = gW / Math.max(1, gH);
      let w = gW || 120;
      let h = gH || 120;

      if (typeof importOpts?.w === 'number' && importOpts.w > 0 && typeof importOpts?.h === 'number' && importOpts.h > 0) {
        w = importOpts.w;
        h = importOpts.h;
      } else if (typeof importOpts?.w === 'number' && importOpts.w > 0) {
        w = importOpts.w;
        h = Math.max(1, Math.round(w / aspect));
      } else if (typeof importOpts?.h === 'number' && importOpts.h > 0) {
        h = importOpts.h;
        w = Math.max(1, Math.round(h * aspect));
      } else {
        const maxRatio = importOpts?.maxScaleRatio === undefined ? 0.6 : importOpts.maxScaleRatio;
        if (maxRatio > 0 && Number.isFinite(maxRatio) && (w > nw * maxRatio || h > nh * maxRatio)) {
          const ratio = Math.min((nw * maxRatio) / w, (nh * maxRatio) / h);
          w = Math.max(16, Math.round(w * ratio));
          h = Math.max(16, Math.round(h * ratio));
        }
      }

      const x = typeof importOpts?.x === 'number' && Number.isFinite(importOpts.x) ? importOpts.x : (nw - w) / 2;
      const y = typeof importOpts?.y === 'number' && Number.isFinite(importOpts.y) ? importOpts.y : (nh - h) / 2;
      const autoSelect = importOpts?.autoSelect !== false;

      const newGraphic: ImportedGraphic = {
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: importOpts?.name || defaultName || '导入图形',
        url: dataUrl,
        naturalWidth: gW || w,
        naturalHeight: gH || h,
        x,
        y,
        w,
        h,
      };

      ctx.setActiveTool(null);
      ctx.setSelectionRegion(null);
      const nextList = [...ctx.importedGraphicsRef.current, newGraphic];
      ctx.importedGraphicsRef.current = nextList;
      ctx.setImportedGraphics(nextList);

      if (autoSelect) {
        ctx.selectedGraphicIdRef.current = newGraphic.id;
        ctx.setSelectedGraphicId(newGraphic.id);
      }

      return newGraphic;
    } catch (err: any) {
      console.error('[ImportGraphic Error]', err);
      ctx.setErrorMessage(err?.message || "导入图形失败");
      return null;
    }
  };

  const handleImportGraphicFile = (file: File) => {
    if (!file) return;
    void importGraphic(file, { name: file.name });
  };

  const handleTriggerImportGraphic = async (): Promise<boolean> => {
    const handler = ctx.onRequestImportGraphicRef.current;
    if (!handler) return false;
    try {
      const res = await handler(importGraphic);
      if (res) {
        const items = Array.isArray(res) ? res : [res];
        for (const item of items) {
          if (item) {
            if (typeof item === 'object' && ('url' in item || 'source' in item)) {
              const src = (item as any).url || (item as any).source;
              await importGraphic(src, item as ImportGraphicOptions);
            } else {
              await importGraphic(item as GraphicInputSource);
            }
          }
        }
      }
      return true;
    } catch (err: any) {
      console.error('[onRequestImportGraphic Error]', err);
      ctx.setErrorMessage(`宿主素材库导入失败: ${err?.message || err}`);
      return false;
    }
  };

  const handleGraphicFlip = async (dir: 'flipH' | 'flipV') => {
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!targetId) return;
    const target = ctx.importedGraphicsRef.current.find(g => g.id === targetId);
    if (!target) return;
    try {
      const updatedGraphic = await transformGraphicImage(target, dir);
      const nextList = ctx.importedGraphicsRef.current.map(g => (g.id === targetId ? updatedGraphic : g));
      ctx.importedGraphicsRef.current = nextList;
      ctx.setImportedGraphics(nextList);
    } catch (err: any) {
      console.error('[GraphicFlip Error]', err);
      ctx.setErrorMessage(`图形镜像失败: ${err?.message || err}`);
    }
  };

  const handleGraphicRotate90 = async (dir: 'cw' | 'ccw') => {
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!targetId) return;
    const target = ctx.importedGraphicsRef.current.find(g => g.id === targetId);
    if (!target) return;
    try {
      const action = dir === 'cw' ? 'rotateCw' : 'rotateCcw';
      const updatedGraphic = await transformGraphicImage(target, action);
      const nextList = ctx.importedGraphicsRef.current.map(g => (g.id === targetId ? updatedGraphic : g));
      ctx.importedGraphicsRef.current = nextList;
      ctx.setImportedGraphics(nextList);
    } catch (err: any) {
      console.error('[GraphicRotate Error]', err);
      ctx.setErrorMessage(`图形旋转失败: ${err?.message || err}`);
    }
  };

  const handleGraphicLayerOrder = (action: GraphicLayerOrderAction) => {
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!targetId) return;
    const { graphics: nextGraphics, baseLayerIndex: nextBaseIdx } = reorderGraphicLayer(
      ctx.importedGraphicsRef.current,
      ctx.baseLayerIndexRef.current,
      targetId,
      action
    );
    ctx.importedGraphicsRef.current = nextGraphics;
    ctx.setImportedGraphics(nextGraphics);
    ctx.baseLayerIndexRef.current = nextBaseIdx;
    ctx.setBaseLayerIndex(nextBaseIdx);
  };

  const handleDeleteSelectedGraphic = () => {
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!targetId) return;
    const targetIdx = ctx.importedGraphicsRef.current.findIndex(g => g.id === targetId);
    const nextList = ctx.importedGraphicsRef.current.filter(g => g.id !== targetId);
    ctx.importedGraphicsRef.current = nextList;
    ctx.setImportedGraphics(nextList);
    if (targetIdx !== -1 && targetIdx < ctx.baseLayerIndexRef.current) {
      const nextBaseIdx = Math.max(0, Math.min(nextList.length, ctx.baseLayerIndexRef.current - 1));
      ctx.baseLayerIndexRef.current = nextBaseIdx;
      ctx.setBaseLayerIndex(nextBaseIdx);
    } else if (ctx.baseLayerIndexRef.current > nextList.length) {
      ctx.baseLayerIndexRef.current = nextList.length;
      ctx.setBaseLayerIndex(nextList.length);
    }
    ctx.selectedGraphicIdRef.current = null;
    ctx.setSelectedGraphicId(null);
    ctx.graphicDragStateRef.current = null;
    ctx.setGraphicDragState(null);
    ctx.pendingGraphicDeselectRef.current = null;
    ctx.setGraphicSnapLines({ x: null, y: null });
  };

  const handleLockSelectedGraphic = () => {
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!targetId) return;
    const nextList = ctx.importedGraphicsRef.current.map(g => (g.id === targetId ? { ...g, locked: true } : g));
    ctx.importedGraphicsRef.current = nextList;
    ctx.setImportedGraphics(nextList);
    ctx.selectedGraphicIdRef.current = null;
    ctx.setSelectedGraphicId(null);
    ctx.graphicDragStateRef.current = null;
    ctx.setGraphicDragState(null);
    ctx.pendingGraphicDeselectRef.current = null;
    ctx.setGraphicSnapLines({ x: null, y: null });
  };

  const handleUnlockAllGraphics = () => {
    const nextList = ctx.importedGraphicsRef.current.map(g => (g.locked ? { ...g, locked: false } : g));
    ctx.importedGraphicsRef.current = nextList;
    ctx.setImportedGraphics(nextList);
  };

  const commitImportedGraphics = async (): Promise<string | null> => {
    const latestImage = ctx.currentImageRef.current;
    const targetId = ctx.selectedGraphicIdRef.current;
    if (!latestImage || !targetId) return latestImage || null;

    const targetIdx = ctx.importedGraphicsRef.current.findIndex(g => g.id === targetId);
    if (targetIdx === -1) return latestImage;
    const targetGraphic = ctx.importedGraphicsRef.current[targetIdx];
    const isBelowBase = targetIdx < ctx.baseLayerIndexRef.current;

    ctx.setIsLoading(true);
    try {
      const resolved = await ctx.resolveEffectiveSource();
      if (!resolved) return latestImage;
      const compCanvas = await compositeSingleGraphicToCanvas(resolved.source, targetGraphic, isBelowBase);
      const resUrl = compCanvas.toDataURL('image/png');
      const remainingGraphics = ctx.importedGraphicsRef.current.filter(g => g.id !== targetId);

      ctx.setImportedGraphics(remainingGraphics);
      ctx.setBaseLayerIndex(0);
      const fusedBaseElement = {
        url: resUrl,
        x: 0,
        y: 0,
        w: compCanvas.width,
        h: compCanvas.height,
      };
      ctx.baseElementRef.current = fusedBaseElement;
      ctx.setSelectedGraphicId(null);
      ctx.graphicDragStateRef.current = null;
      ctx.setGraphicDragState(null);
      ctx.pendingGraphicDeselectRef.current = null;
      ctx.setGraphicSnapLines({ x: null, y: null });

      const rec: HistoryRecord = {
        id: Date.now(),
        url: resUrl,
        prompt: `融合图层: ${targetGraphic.name}`,
        timestamp: new Date().toLocaleTimeString(),
        width: compCanvas.width,
        height: compCanvas.height,
        layerState: {
          graphics: remainingGraphics.map(g => ({ ...g })),
          baseLayerIndex: 0,
          baseElement: { ...fusedBaseElement },
        },
      };
      ctx.setHistory(prev => [rec, ...prev]);
      ctx.setCurrentImage(resUrl);
      ctx.setActiveRecord(rec);
      return resUrl;
    } catch (err: any) {
      console.error('[CommitGraphics Error]', err);
      ctx.setErrorMessage(`图形融合失败: ${err?.message || err}`);
      return null;
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleExpandCanvas = async () => {
    const latestImage = ctx.currentImageRef.current;
    if (!latestImage || !ctx.imageRef.current || ctx.importedGraphicsRef.current.length === 0) return;

    const img = ctx.imageRef.current;
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const origClientW = img.clientWidth;
    const origClientH = img.clientHeight;
    if (!origW || !origH) return;

    const baseInfo = ctx.baseElementRef.current || {
      url: latestImage,
      x: 0,
      y: 0,
      w: origW,
      h: origH,
    };

    const bounds = calculateExpandedCanvasBounds(baseInfo, ctx.importedGraphicsRef.current);
    if (
      bounds.minX === 0 &&
      bounds.minY === 0 &&
      bounds.width === origW &&
      bounds.height === origH
    ) {
      return;
    }

    ctx.setIsLoading(true);
    try {
      const expandedBaseUrl = await renderExpandedBaseCanvas(
        baseInfo.url,
        baseInfo,
        bounds.width,
        bounds.height,
        bounds.shiftX,
        bounds.shiftY
      );

      const nextBaseElement = {
        url: baseInfo.url,
        x: baseInfo.x + bounds.shiftX,
        y: baseInfo.y + bounds.shiftY,
        w: baseInfo.w,
        h: baseInfo.h,
      };
      ctx.baseElementRef.current = nextBaseElement;

      const shiftedGraphics = ctx.importedGraphicsRef.current.map((g) => ({
        ...g,
        x: g.x + bounds.shiftX,
        y: g.y + bounds.shiftY,
      }));
      ctx.setImportedGraphics(shiftedGraphics);

      const pxPerImgX = origClientW / Math.max(1, origW);
      const pxPerImgY = origClientH / Math.max(1, origH);
      const targetDisplayW = Math.round(bounds.width * pxPerImgX);
      const targetDisplayH = Math.round(bounds.height * pxPerImgY);

      const deltaCenterImgX = bounds.width / 2 - bounds.shiftX - origW / 2;
      const deltaCenterImgY = bounds.height / 2 - bounds.shiftY - origH / 2;
      const curPan = ctx.panOffsetRef.current;
      const curZoom = ctx.zoomRef.current;
      const newPanX = Math.round(curPan.x + deltaCenterImgX * pxPerImgX * curZoom);
      const newPanY = Math.round(curPan.y + deltaCenterImgY * pxPerImgY * curZoom);

      const rec: HistoryRecord = {
        id: Date.now(),
        url: expandedBaseUrl,
        prompt: `扩展画布: ${bounds.width} × ${bounds.height}`,
        timestamp: new Date().toLocaleTimeString(),
        width: bounds.width,
        height: bounds.height,
        displaySize: { width: targetDisplayW, height: targetDisplayH },
        panOffset: { x: newPanX, y: newPanY },
        layerState: {
          graphics: shiftedGraphics.map((g) => ({ ...g })),
          baseLayerIndex: ctx.baseLayerIndexRef.current,
          baseElement: { ...nextBaseElement },
        },
      };

      ctx.setDisplaySize({ width: targetDisplayW, height: targetDisplayH });
      ctx.setPanOffset({ x: newPanX, y: newPanY });
      ctx.setCurrentImage(expandedBaseUrl);
      ctx.setActiveRecord(rec);
      ctx.setHistory((prev) => [rec, ...prev]);
    } catch (err: any) {
      console.error('[ExpandCanvas Error]', err);
      ctx.setErrorMessage(`扩展画布失败: ${err?.message || err}`);
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const clearGraphicsLayer = () => {
    ctx.setImportedGraphics([]);
    ctx.setBaseLayerIndex(0);
    ctx.setSelectedGraphicId(null);
    ctx.graphicDragStateRef.current = null;
    ctx.setGraphicDragState(null);
    ctx.setGraphicSnapLines({ x: null, y: null });
    ctx.pendingGraphicDeselectRef.current = null;
    ctx.baseElementRef.current = null;
  };

  const getLayerState = (): EditorLayerState => {
    return {
      version: ctx.version,
      type: 'tiamo-image-editor-state',
      timestamp: new Date().toISOString(),
      baseImage: ctx.currentImageRef.current || '',
      baseLayerIndex: ctx.baseLayerIndexRef.current,
      graphics: ctx.importedGraphicsRef.current.map((g) => ({ ...g })),
      baseElement: ctx.baseElementRef.current ? { ...ctx.baseElementRef.current } : null,
    };
  };

  const loadLayerState = (rawState: unknown): boolean => {
    const parsed = parseEditorLayerState(rawState);
    if (!parsed) return false;
    const newRecord: HistoryRecord = {
      id: Date.now(),
      url: parsed.baseImage,
      prompt: parsed.graphics.length > 0 ? `恢复分层状态 (${parsed.graphics.length}层)` : `加载图片`,
      timestamp: new Date().toLocaleTimeString(),
      layerState: {
        graphics: parsed.graphics.map((g) => ({ ...g })),
        baseLayerIndex: parsed.baseLayerIndex,
        baseElement: parsed.baseElement ? { ...parsed.baseElement } : null,
      },
    };
    ctx.setCurrentImage(parsed.baseImage);
    ctx.setActiveRecord(newRecord);
    ctx.setHistory([newRecord]);
    ctx.setImportedGraphics(parsed.graphics.map((g) => ({ ...g })));
    ctx.setBaseLayerIndex(parsed.baseLayerIndex);
    ctx.baseElementRef.current = parsed.baseElement ? { ...parsed.baseElement } : null;
    ctx.setSelectedGraphicId(null);
    ctx.graphicDragStateRef.current = null;
    ctx.setGraphicDragState(null);
    ctx.setGraphicSnapLines({ x: null, y: null });
    ctx.pendingGraphicDeselectRef.current = null;
    return true;
  };

  return {
    importGraphic,
    handleImportGraphicFile,
    handleTriggerImportGraphic,
    handleGraphicFlip,
    handleGraphicRotate90,
    handleGraphicLayerOrder,
    handleDeleteSelectedGraphic,
    handleLockSelectedGraphic,
    handleUnlockAllGraphics,
    commitImportedGraphics,
    handleExpandCanvas,
    clearGraphicsLayer,
    getLayerState,
    loadLayerState,
  };
}
