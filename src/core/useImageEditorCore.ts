import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SDK_VERSION } from '../version';
import { Point, SelectionRegion, RectDragPoints } from '../types/canvas';
import {
  EightPointHandleId,
  EditorLayerState,
  GraphicBox,
  GraphicInputSource,
  GraphicLayerOrderAction,
  ImportGraphicOptions,
  ImportedGraphic,
  OnRequestImportGraphicHandler,
  SnapGuideLines,
} from './algorithms/graphicLayer';

import { createGraphicLayerController } from './controllers/graphicLayerController';
import { createSelectionController } from './controllers/selectionController';
import { createCanvasTransformController } from './controllers/canvasTransformController';
import { createCanvasPointerController } from './controllers/canvasPointerController';
import { createFileImportController } from './controllers/fileImportController';
import { createExportController } from './controllers/exportController';

export type GraphicLayer = ImportedGraphic;
export type BaseElementTransform = GraphicBox & { url: string };
export type ToolType = string | null;

export interface GraphicDragState {
  mode: 'move' | 'resize';
  graphicId: string;
  handleId?: EightPointHandleId;
  startClientX: number;
  startClientY: number;
  startBox: { x: number; y: number; w: number; h: number };
}

export interface HistoryRecord {
  id: number;
  url: string;
  originalUrl?: string;
  prompt: string;
  timestamp: string;
  width?: number;
  height?: number;
  displaySize?: { width: number; height: number };
  panOffset?: { x: number; y: number };
  layerState?: {
    graphics: ImportedGraphic[];
    baseLayerIndex: number;
    baseElement?: (GraphicBox & { url: string }) | null;
  };
}

export type { Point, SelectionRegion, RectDragPoints };
export type {
  EightPointHandleId,
  EditorLayerState,
  GraphicBox,
  GraphicInputSource,
  GraphicLayerOrderAction,
  ImportGraphicOptions,
  ImportedGraphic,
  OnRequestImportGraphicHandler,
  SnapGuideLines,
};

export interface CoreOptions {
  initialImage?: string | Blob | File | HTMLImageElement | HTMLCanvasElement | null;
  initialState?: EditorLayerState | string | null;
  apiKey?: string;
  onRequestImportGraphic?: OnRequestImportGraphicHandler;
  onSaveState?: (state: EditorLayerState) => void;
  onComplete?: (result: { blob: Blob; base64: string; canvas: HTMLCanvasElement; state: EditorLayerState }) => void;
  onCancel?: () => void;
}

export function useImageEditorCore(options: CoreOptions = {}) {
  const version = SDK_VERSION;
  const activeCoreProxyRef = useRef<Record<string, any>>({});
  const onSaveStateRef = useRef(options.onSaveState);
  onSaveStateRef.current = options.onSaveState;
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;
  const onCancelRef = useRef(options.onCancel);
  onCancelRef.current = options.onCancel;
  const onRequestImportGraphicRef = useRef(options.onRequestImportGraphic);
  onRequestImportGraphicRef.current = options.onRequestImportGraphic;

  const makeSyncedSetter = useCallback(<T,>(
    ref: React.MutableRefObject<T>,
    rawSetter: React.Dispatch<React.SetStateAction<T>>,
    proxyKey?: string,
    afterSync?: (resolved: T) => void
  ) => (next: React.SetStateAction<T>) => {
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(ref.current) : next;
    ref.current = resolved;
    if (proxyKey) {
      activeCoreProxyRef.current[proxyKey] = resolved;
    }
    if (afterSync) {
      afterSync(resolved);
    }
    rawSetter(resolved);
  }, []);

  // 基础状态
  const [currentImage, rawSetCurrentImage] = useState<string | null>(null);
  const currentImageRef = useRef<string | null>(null);
  const setCurrentImage = useCallback(
    makeSyncedSetter(currentImageRef, rawSetCurrentImage, 'currentImage'),
    [makeSyncedSetter]
  );

  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showAlphaMask, setShowAlphaMask] = useState<boolean>(false);

  // 视口状态
  const [zoom, setZoom] = useState<number>(1);
  const zoomRef = useRef<number>(1);
  zoomRef.current = zoom;
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  panOffsetRef.current = panOffset;
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [spacePressed, setSpacePressed] = useState<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 工具与选区状态
  const [activeTool, rawSetActiveTool] = useState<ToolType>(null);
  const activeToolRef = useRef<ToolType>(null);
  const setActiveTool = useCallback(
    makeSyncedSetter(activeToolRef, rawSetActiveTool, 'activeTool'),
    [makeSyncedSetter]
  );

  const [selectionMode, setSelectionMode] = useState<'global' | 'connected'>('global');
  const [selectionRegion, rawSetSelectionRegion] = useState<SelectionRegion | null>(null);
  const selectionRegionRef = useRef<SelectionRegion | null>(null);
  const setSelectionRegion = useCallback(
    makeSyncedSetter(selectionRegionRef, rawSetSelectionRegion, 'selectionRegion'),
    [makeSyncedSetter]
  );

  const [rectDragPoints, setRectDragPoints] = useState<RectDragPoints | null>(null);
  const [isRegionInverted, rawSetIsRegionInverted] = useState<boolean>(false);
  const isRegionInvertedRef = useRef<boolean>(false);
  const setIsRegionInverted = useCallback(
    makeSyncedSetter(isRegionInvertedRef, rawSetIsRegionInverted, 'isRegionInverted'),
    [makeSyncedSetter]
  );

  const [drawingPath, setDrawingPath] = useState<Point[]>([]);
  const [regionStart, setRegionStart] = useState<Point | null>(null);
  const [maskCanvas, rawSetMaskCanvas] = useState<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const setMaskCanvas = useCallback(
    makeSyncedSetter(maskCanvasRef, rawSetMaskCanvas, 'maskCanvas'),
    [makeSyncedSetter]
  );

  const [tolerance, setTolerance] = useState<number>(32);
  const toleranceRef = useRef<number>(32);
  toleranceRef.current = tolerance;

  const [lastClickPos, setLastClickPos] = useState<{ x: number; y: number; isAdding: boolean } | null>(null);
  const [fillColor, setFillColor] = useState<string>('#3b82f6');
  const fillColorRef = useRef<string>('#3b82f6');
  fillColorRef.current = fillColor;

  const [borderColor, setBorderColor] = useState<string>('#ffffff');
  const borderColorRef = useRef<string>('#ffffff');
  borderColorRef.current = borderColor;

  const [borderWidth, setBorderWidth] = useState<number>(4);
  const borderWidthRef = useRef<number>(4);
  borderWidthRef.current = borderWidth;

  const [spillRadius, setSpillRadius] = useState<number>(3);
  const spillRadiusRef = useRef<number>(3);
  spillRadiusRef.current = spillRadius;

  const [sampledColor, setSampledColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null);
  const sampledColorRef = useRef<{ r: number; g: number; b: number; a: number } | null>(null);
  sampledColorRef.current = sampledColor;

  // 变换、正交化与高清化状态
  const [rotationAngle, rawSetRotationAngle] = useState<number>(0);
  const rotationAngleRef = useRef<number>(0);
  const setRotationAngle = useCallback(
    makeSyncedSetter(rotationAngleRef, rawSetRotationAngle, 'rotationAngle'),
    [makeSyncedSetter]
  );

  const [quadPoints, rawSetQuadPoints] = useState<Point[] | null>(null);
  const quadPointsRef = useRef<Point[] | null>(null);
  const setQuadPoints = useCallback(
    makeSyncedSetter(quadPointsRef, rawSetQuadPoints, 'quadPoints'),
    [makeSyncedSetter]
  );

  const [isPolyClosed, rawSetIsPolyClosed] = useState<boolean>(false);
  const isPolyClosedRef = useRef<boolean>(false);
  const setIsPolyClosed = useCallback(
    makeSyncedSetter(isPolyClosedRef, rawSetIsPolyClosed, 'isPolyClosed'),
    [makeSyncedSetter]
  );

  const [polyHoverClose, setPolyHoverClose] = useState<boolean>(false);
  const [polyMousePos, setPolyMousePos] = useState<Point | null>(null);
  const [draggingPointIdx, setDraggingPointIdx] = useState<number>(-1);
  const dragStartData = useRef<any>(null);

  const [orthoPoints, setOrthoPoints] = useState<Point[] | null>(null);
  const [draggingOrthoIdx, setDraggingOrthoIdx] = useState<number>(-1);
  const [orthoMagnifier, setOrthoMagnifier] = useState<{
    visible: boolean;
    imgX: number;
    imgY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const [hdBox, rawSetHdBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const hdBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const setHdBox = useCallback(
    makeSyncedSetter(hdBoxRef, rawSetHdBox, 'hdBox'),
    [makeSyncedSetter]
  );

  const [hdDragHandle, setHdDragHandle] = useState<string | null>(null);
  const hdDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    box: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const [hdOriginalImage, setHdOriginalImage] = useState<string | null>(null);
  const [isComparingOriginal, rawSetIsComparingOriginal] = useState<boolean>(false);
  const isComparingOriginalRef = useRef<boolean>(false);
  const setIsComparingOriginal = useCallback(
    makeSyncedSetter(isComparingOriginalRef, rawSetIsComparingOriginal, 'isComparingOriginal'),
    [makeSyncedSetter]
  );
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const [isHdProcessing, setIsHdProcessing] = useState<boolean>(false);

  // 独立图形图层状态
  const [importedGraphics, rawSetImportedGraphics] = useState<ImportedGraphic[]>([]);
  const importedGraphicsRef = useRef<ImportedGraphic[]>([]);
  const setImportedGraphics = useCallback(
    makeSyncedSetter(importedGraphicsRef, rawSetImportedGraphics, 'importedGraphics'),
    [makeSyncedSetter]
  );

  const [baseLayerIndex, rawSetBaseLayerIndex] = useState<number>(0);
  const baseLayerIndexRef = useRef<number>(0);
  const setBaseLayerIndex = useCallback(
    makeSyncedSetter(baseLayerIndexRef, rawSetBaseLayerIndex, 'baseLayerIndex'),
    [makeSyncedSetter]
  );

  const [selectedGraphicId, rawSetSelectedGraphicId] = useState<string | null>(null);
  const selectedGraphicIdRef = useRef<string | null>(null);
  const setSelectedGraphicId = useCallback(
    makeSyncedSetter(selectedGraphicIdRef, rawSetSelectedGraphicId, 'selectedGraphicId'),
    [makeSyncedSetter]
  );

  const baseElementRef = useRef<(GraphicBox & { url: string }) | null>(null);
  const [graphicSnapLines, setGraphicSnapLines] = useState<SnapGuideLines>({ x: null, y: null });
  const [graphicDragState, rawSetGraphicDragState] = useState<GraphicDragState | null>(null);
  const graphicDragStateRef = useRef<GraphicDragState | null>(null);
  const setGraphicDragState = useCallback(
    makeSyncedSetter(graphicDragStateRef, rawSetGraphicDragState, 'graphicDragState'),
    [makeSyncedSetter]
  );
  const pendingGraphicDeselectRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownOutsideRef = useRef<{ x: number; y: number } | null>(null);

  // 基础 DOM 引用
  const imageRef = useRef<HTMLImageElement | null>(null);
  const displayMaskRef = useRef<HTMLCanvasElement | null>(null);

  const hasSelection = !!(maskCanvas || selectionRegion || (quadPoints && isPolyClosed));
  const effectiveApiKey =
    options.apiKey || (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null);

  // 解析当前底图源
  const resolveEffectiveSource = useCallback(async (): Promise<{
    source: HTMLImageElement;
    nw: number;
    nh: number;
  } | null> => {
    const latestSrc = currentImageRef.current;
    if (!latestSrc) return null;

    const img = imageRef.current;
    if (
      img &&
      !isComparingOriginalRef.current &&
      img.complete &&
      img.naturalWidth > 0 &&
      (img.getAttribute('src') === latestSrc || img.src === latestSrc)
    ) {
      return {
        source: img,
        nw: img.naturalWidth,
        nh: img.naturalHeight,
      };
    }

    const loadedImg = new Image();
    loadedImg.crossOrigin = 'anonymous';
    loadedImg.src = latestSrc;
    await new Promise((resolve, reject) => {
      loadedImg.onload = resolve;
      loadedImg.onerror = reject;
    });

    const nw = loadedImg.naturalWidth || loadedImg.width;
    const nh = loadedImg.naturalHeight || loadedImg.height;
    if (nw <= 0 || nh <= 0) return null;

    return {
      source: loadedImg,
      nw,
      nh,
    };
  }, []);

  // 提交底图编辑结果
  const commitBaseEditResult = useCallback((
    url: string,
    recordPrompt: string,
    extra?: Omit<HistoryRecord, 'id' | 'url' | 'prompt' | 'timestamp'>
  ): HistoryRecord => {
    baseElementRef.current = null;
    const hasLayers = importedGraphicsRef.current.length > 0;
    const rec: HistoryRecord = {
      id: Date.now(),
      url,
      prompt: recordPrompt,
      timestamp: new Date().toLocaleTimeString(),
      ...(hasLayers
        ? {
            layerState: {
              graphics: importedGraphicsRef.current.map((g) => ({ ...g })),
              baseLayerIndex: baseLayerIndexRef.current,
              baseElement: null,
            },
          }
        : {}),
      ...extra,
    };
    setHistory((prev) => [rec, ...prev]);
    setCurrentImage(url);
    setActiveRecord(rec);
    return rec;
  }, [setCurrentImage]);

  const clearSelection = useCallback(() => {
    setMaskCanvas(null);
    setSelectionRegion(null);
    setRectDragPoints(null);
    setIsRegionInverted(false);
    setDrawingPath([]);
    setRegionStart(null);
    setLastClickPos(null);
    setQuadPoints(null);
    setIsPolyClosed(false);
    setPolyHoverClose(false);
    setPolyMousePos(null);
    setDraggingPointIdx(-1);
    setSampledColor(null);
    setActiveTool(null);
  }, [setMaskCanvas, setSelectionRegion, setIsRegionInverted, setQuadPoints, setIsPolyClosed, setActiveTool]);

  const resetWand = useCallback(() => {
    setLastClickPos(null);
    setMaskCanvas(null);
    setSampledColor(null);
  }, [setMaskCanvas]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.1, prev + delta), 10));
  }, []);

  // 实例化图层控制器
  const graphicLayerCtrl = createGraphicLayerController({
    version,
    imageRef: imageRef as any,
    currentImageRef: currentImageRef as any,
    importedGraphicsRef: importedGraphicsRef as any,
    setImportedGraphics: setImportedGraphics as any,
    selectedGraphicIdRef,
    setSelectedGraphicId,
    baseLayerIndexRef,
    setBaseLayerIndex,
    baseElementRef,
    graphicDragStateRef,
    setGraphicDragState,
    pendingGraphicDeselectRef,
    setGraphicSnapLines,
    onRequestImportGraphicRef,
    setActiveTool,
    setSelectionRegion,
    setIsLoading,
    setErrorMessage,
    setHistory,
    setCurrentImage: setCurrentImage as any,
    setActiveRecord: setActiveRecord as any,
    panOffsetRef,
    setPanOffset,
    zoomRef,
    setDisplaySize,
    resolveEffectiveSource,
  });

  const {
    importGraphic,
    handleImportGraphicFile,
    handleTriggerImportGraphic,
    handleGraphicFlip,
    handleGraphicRotate90,
    handleGraphicLayerOrder,
    handleDeleteSelectedGraphic,
    handleLockSelectedGraphic,
    handleUnlockAllGraphics,
    handleExpandCanvas,
    commitImportedGraphics,
    getLayerState,
    loadLayerState,
    clearGraphicsLayer,
  } = graphicLayerCtrl;

  // 实例化选区控制器
  const selectionCtrl = createSelectionController({
    currentImageRef: currentImageRef as any,
    imageRef: imageRef as any,
    maskCanvasRef,
    setMaskCanvas,
    selectionRegionRef,
    setSelectionRegion,
    isRegionInvertedRef,
    quadPointsRef,
    isPolyClosedRef,
    sampledColorRef,
    setSampledColor,
    fillColorRef,
    toleranceRef,
    spillRadiusRef,
    setIsLoading,
    setActiveTool,
    resolveEffectiveSource,
    commitBaseEditResult: commitBaseEditResult as any,
    clearSelection,
    resetWand,
  });

  const {
    computeSelection,
    handleApplyQuadCrop,
    handleFillSelection,
    handleInvertSelection,
    commitFinalCrop,
    handleEraseSelection,
  } = selectionCtrl;

  // 实例化画布变换控制器
  const transformCtrl = createCanvasTransformController({
    currentImageRef,
    imageRef,
    rotationAngleRef,
    selectedGraphicIdRef,
    importedGraphicsRef,
    baseLayerIndexRef,
    baseElementRef,
    borderWidthRef,
    borderColorRef,
    hdBoxRef,
    panOffsetRef,
    zoomRef,
    orthoPoints,
    maskCanvasRef,
    selectionRegionRef,
    quadPointsRef,
    isPolyClosedRef,
    setIsLoading,
    setIsHdProcessing,
    setRotationAngle,
    setActiveTool,
    setErrorMessage,
    setOrthoPoints,
    setDraggingOrthoIdx,
    setOrthoMagnifier,
    setHdOriginalImage,
    setIsComparingOriginal,
    setDisplaySize,
    setPanOffset,
    setHdBox,
    setMaskCanvas,
    setLastClickPos,
    setQuadPoints,
    setIsPolyClosed,
    setPolyHoverClose,
    setPolyMousePos,
    setSelectionRegion,
    setImportedGraphics,
    setHistory,
    setActiveRecord,
    resolveEffectiveSource,
    commitBaseEditResult,
    clearSelection,
    commitFinalCrop,
    handleGraphicFlip,
    handleGraphicRotate90,
  });

  const {
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
  } = transformCtrl;

  // 实例化指针控制器
  const pointerCtrl = createCanvasPointerController({
    imageRef,
    currentImageRef,
    selectedGraphicIdRef,
    importedGraphicsRef,
    graphicDragStateRef,
    pendingGraphicDeselectRef,
    mouseDownOutsideRef,
    hdDragStartRef,
    hdBoxRef,
    dragStartData,
    lastMousePos,
    baseElementRef,
    activeTool,
    spacePressed,
    zoom,
    hdBox,
    hdDragHandle,
    orthoPoints,
    draggingOrthoIdx,
    isPolyClosed,
    quadPoints,
    selectionRegion,
    regionStart,
    drawingPath,
    tolerance,
    selectionMode,
    hasSelection,
    isPanning,
    draggingPointIdx,
    setSelectedGraphicId,
    setGraphicDragState,
    setGraphicSnapLines,
    setImportedGraphics,
    setIsPanning,
    setPanOffset,
    setHdDragHandle,
    setHdBox,
    setDraggingOrthoIdx,
    setOrthoPoints,
    setOrthoMagnifier,
    setDraggingPointIdx,
    setRectDragPoints,
    setQuadPoints,
    setIsPolyClosed,
    setPolyHoverClose,
    setPolyMousePos,
    setSelectionRegion,
    setFillColor,
    setActiveTool,
    setRegionStart,
    setDrawingPath,
    setLastClickPos,
    clearSelection,
    computeSelection,
    applySparseHD,
  });

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleMouseDown,
    handleDoubleClick,
    handleMouseMove,
    handleMouseUp,
  } = pointerCtrl;

  // 实例化文件导入控制器
  const fileImportCtrl = createFileImportController({
    setIsLoading,
    setErrorMessage,
    loadLayerState,
    setCurrentImage: setCurrentImage as any,
    setActiveRecord: setActiveRecord as any,
    setHistory,
    setPrompt,
    resetWand,
    resetView,
    clearGraphicsLayer,
    setHdOriginalImage,
    setIsComparingOriginal,
    setSelectionRegion,
    setIsRegionInverted,
    setRotationAngle,
  });

  const { processFile, loadImageSource } = fileImportCtrl;

  useEffect(() => {
    if (options.initialState && loadLayerState(options.initialState)) {
      return;
    }
    if (options.initialImage) {
      loadImageSource(options.initialImage);
    }
  }, [options.initialImage, options.initialState, loadImageSource, loadLayerState]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const toggleInvertSelection = () => {
    handleInvertSelection();
  };

  const applyWandCutout = handleEraseSelection;

  const handleSelectHistoryRecord = useCallback((item: HistoryRecord) => {
    if (!item) return;
    setCurrentImage(item.url);
    setActiveRecord(item);
    setDisplaySize(item.displaySize || null);
    if (item.panOffset) {
      setPanOffset(item.panOffset);
    }
    if (item.layerState) {
      setImportedGraphics(item.layerState.graphics.map((g) => ({ ...g })));
      setBaseLayerIndex(item.layerState.baseLayerIndex);
      baseElementRef.current = item.layerState.baseElement ? { ...item.layerState.baseElement } : null;
      setSelectedGraphicId(null);
      graphicDragStateRef.current = null;
      setGraphicDragState(null);
      setGraphicSnapLines({ x: null, y: null });
      pendingGraphicDeselectRef.current = null;
    } else {
      clearGraphicsLayer();
    }
  }, [clearGraphicsLayer, setCurrentImage, setImportedGraphics, setBaseLayerIndex, setSelectedGraphicId, setGraphicDragState]);

  // 实例化导出与 AI 编辑控制器
  const exportCtrl = createExportController({
    currentImageRef,
    importedGraphicsRef,
    baseLayerIndexRef,
    prompt,
    setPrompt,
    effectiveApiKey,
    history,
    activeRecord,
    setIsLoading,
    setErrorMessage,
    setShowConfirmModal,
    clearGraphicsLayer,
    getLayerState,
    resolveEffectiveSource,
    commitBaseEditResult: commitBaseEditResult as any,
    onSaveStateRef,
    onCompleteRef,
  });

  const {
    executeEdit,
    handleEditClick,
    exportResult,
    handleFinish,
  } = exportCtrl;

  const handleCancel = () => {
    if (onCancelRef.current) onCancelRef.current();
  };

  // 全局快捷键与事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setSpacePressed(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (history.length > 1) {
          const prevHistory = history.slice(1);
          setHistory(prevHistory);
          handleSelectHistoryRecord(prevHistory[0]);
        }
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedGraphicIdRef.current) {
        handleDeleteSelectedGraphic();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [history, handleSelectHistoryRecord, clearSelection, handleDeleteSelectedGraphic]);

  const coreApi = {
    version,
    currentImage,
    setCurrentImage,
    activeRecord,
    setActiveRecord,
    history,
    setHistory,
    prompt,
    setPrompt,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    errorMessage,
    showConfirmModal,
    setShowConfirmModal,
    isDragging,
    setIsDragging,
    showAlphaMask,
    setShowAlphaMask,
    zoom,
    setZoom,
    panOffset,
    setPanOffset,
    isPanning,
    spacePressed,
    activeTool,
    setActiveTool,
    selectionMode,
    setSelectionMode,
    selectionRegion,
    setSelectionRegion,
    isRegionInverted,
    setIsRegionInverted,
    drawingPath,
    maskCanvas,
    tolerance,
    setTolerance,
    spillRadius,
    setSpillRadius,
    sampledColor,
    setSampledColor,
    fillColor,
    setFillColor,
    borderColor,
    setBorderColor,
    borderWidth,
    setBorderWidth,
    handleApplyBorder,
    hdBox,
    setHdBox,
    hdDragHandle,
    applySparseHD,
    displaySize,
    setDisplaySize,
    hdOriginalImage,
    isComparingOriginal,
    setIsComparingOriginal,
    isHdProcessing,
    orthoPoints,
    setOrthoPoints,
    draggingOrthoIdx,
    orthoMagnifier,
    handleApplyOrtho,
    handleAutoDetectOrtho,
    handleApplyDeShadow,
    handleResetOrthoPoints,
    quadPoints,
    setQuadPoints,
    isPolyClosed,
    setIsPolyClosed,
    polyHoverClose,
    polyMousePos,
    draggingPointIdx,
    regionStart,
    rectDragPoints,
    rotationAngle,
    setRotationAngle,
    imageRef,
    displayMaskRef,
    hasSelection,
    resetWand,
    resetView,
    changeZoom,
    processFile,
    handleUpload,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleApplyRotation,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    handleApplyQuadCrop,
    handleCropSelection,
    handleFillSelection,
    handleCropTransparency,
    commitFinalCrop,
    handleInvertSelection,
    toggleInvertSelection,
    clearSelection,
    handleEraseSelection,
    applyWandCutout,
    executeEdit,
    handleEditClick,
    exportResult,
    handleFinish,
    handleCancel,
    loadImageSource,
    importedGraphics,
    setImportedGraphics,
    baseLayerIndex,
    setBaseLayerIndex,
    selectedGraphicId,
    setSelectedGraphicId,
    graphicSnapLines,
    graphicDragState,
    importGraphic,
    handleImportGraphicFile,
    handleTriggerImportGraphic,
    hasCustomImportGraphicHandler: !!options.onRequestImportGraphic,
    handleGraphicFlip,
    handleGraphicRotate90,
    handleGraphicLayerOrder,
    handleLockSelectedGraphic,
    handleUnlockAllGraphics,
    handleDeleteSelectedGraphic,
    commitImportedGraphics,
    handleExpandCanvas,
    handleSelectHistoryRecord,
    getLayerState,
    loadLayerState,
  };

  Object.assign(activeCoreProxyRef.current, coreApi);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const g = window as any;
    const proxy = activeCoreProxyRef.current;
    const prevCore = g.__TIAMO_ACTIVE_CORE__;
    g.__TIAMO_ACTIVE_CORE__ = proxy;

    return () => {
      if (g.__TIAMO_ACTIVE_CORE__ === proxy) {
        if (prevCore) {
          g.__TIAMO_ACTIVE_CORE__ = prevCore;
        } else {
          delete g.__TIAMO_ACTIVE_CORE__;
        }
      }
    };
  }, []);

  return coreApi;
}

export type ImageEditorCore = ReturnType<typeof useImageEditorCore>;
