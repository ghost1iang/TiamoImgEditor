import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SDK_VERSION } from '../version';
import { executeSparseHdReconstruction } from './algorithms/sparseHd';
import { performPerspectiveOrthogonalization, detectOrthoQuadCorners } from './algorithms/ortho';
import { performDocumentShadowRemoval } from './algorithms/deShadow';
import { applyOuterBorderToImage } from './algorithms/border';
import { isInsideLockedRegion, processUniversalDeSpill, processLocalDeSpill } from './algorithms/wand';
import { findNonTransparentBounds } from './algorithms/crop';
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
  computeGraphicMoveWithSnap,
  computeGraphicResizeWithSnap,
  transformGraphicImage,
  reorderGraphicLayer,
  compositeGraphicsToCanvas,
  compositeSingleGraphicToCanvas,
  calculateExpandedCanvasBounds,
  renderExpandedBaseCanvas,
  resolveGraphicSourceToDataUrl,
  parseEditorLayerState,
  saveLayerStateToCache,
  findCachedLayerState,
} from './algorithms/graphicLayer';

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

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRegion {
  type: 'rect' | 'path';
  data: any;
}

export interface RectDragPoints {
  current: Point;
  opposite: Point;
}

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
  const activeCoreProxyRef = useRef<Record<string, any>>({});
  const onSaveStateRef = useRef(options.onSaveState);
  onSaveStateRef.current = options.onSaveState;
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;
  const onCancelRef = useRef(options.onCancel);
  onCancelRef.current = options.onCancel;

  // 创建状态与 Ref/Proxy 同步写入包装器，彻底消除异步状态更新导致的闭包滞后
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

  const [currentImage, rawSetCurrentImage] = useState<string | null>(null);
  const currentImageRef = useRef<string | null>(null);
  const setCurrentImage = useCallback(
    makeSyncedSetter(currentImageRef, rawSetCurrentImage, 'currentImage'),
    [makeSyncedSetter]
  );

  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null); 
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [prompt, setPrompt] = useState<string>("");
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

  // 工具状态与选区同步 Ref
  const [activeTool, setActiveTool] = useState<string | null>(null); // 'wand' | 'rect' | 'lasso' | 'pipette' | 'quad' | 'rotate'
  const [selectionMode, setSelectionMode] = useState<'global' | 'connected'>('global'); 
  const [selectionRegion, rawSetSelectionRegion] = useState<SelectionRegion | null>(null);
  const selectionRegionRef = useRef<SelectionRegion | null>(null);
  const [rectDragPoints, setRectDragPoints] = useState<RectDragPoints | null>(null); 
  const [isRegionInverted, rawSetIsRegionInverted] = useState<boolean>(false);
  const isRegionInvertedRef = useRef<boolean>(false);
  const [drawingPath, setDrawingPath] = useState<Point[]>([]); 
  const [regionStart, setRegionStart] = useState<Point | null>(null); 
  const [maskCanvas, rawSetMaskCanvas] = useState<HTMLCanvasElement | null>(null); 
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tolerance, setTolerance] = useState<number>(32);
  const toleranceRef = useRef<number>(32);
  toleranceRef.current = tolerance;
  const [lastClickPos, setLastClickPos] = useState<{ x: number; y: number; isAdding: boolean } | null>(null); 
  const [fillColor, setFillColor] = useState<string>("#3b82f6");
  const fillColorRef = useRef<string>("#3b82f6");
  fillColorRef.current = fillColor;
  const [borderColor, setBorderColor] = useState<string>("#ffffff");
  const borderColorRef = useRef<string>("#ffffff");
  borderColorRef.current = borderColor;
  const [borderWidth, setBorderWidth] = useState<number>(4);
  const borderWidthRef = useRef<number>(4);
  borderWidthRef.current = borderWidth;
  const [deSpillGreen, setDeSpillGreen] = useState<boolean>(true); // 智能去色边开关
  const [spillRadius, setSpillRadius] = useState<number>(3); // 智能去色边影响范围 (默认 3 像素边缘邻域)
  const spillRadiusRef = useRef<number>(3);
  spillRadiusRef.current = spillRadius;
  const [sampledColor, setSampledColor] = useState<{ r: number; g: number; b: number; a: number } | null>(null); // 魔棒当前吸附的背景色
  const sampledColorRef = useRef<{ r: number; g: number; b: number; a: number } | null>(null);
  sampledColorRef.current = sampledColor;

  // 变换与多边形状态
  const [quadPoints, rawSetQuadPoints] = useState<Point[] | null>(null);
  const quadPointsRef = useRef<Point[] | null>(null);
  const [isPolyClosed, rawSetIsPolyClosed] = useState<boolean>(false);
  const isPolyClosedRef = useRef<boolean>(false);

  const syncHasSelectionProxy = useCallback(() => {
    activeCoreProxyRef.current.hasSelection = !!(
      maskCanvasRef.current ||
      selectionRegionRef.current ||
      (quadPointsRef.current && isPolyClosedRef.current)
    );
  }, []);

  const setMaskCanvas = useCallback(
    makeSyncedSetter(maskCanvasRef, rawSetMaskCanvas, 'maskCanvas', syncHasSelectionProxy),
    [makeSyncedSetter, syncHasSelectionProxy]
  );
  const setSelectionRegion = useCallback(
    makeSyncedSetter(selectionRegionRef, rawSetSelectionRegion, 'selectionRegion', syncHasSelectionProxy),
    [makeSyncedSetter, syncHasSelectionProxy]
  );
  const setIsRegionInverted = useCallback(
    makeSyncedSetter(isRegionInvertedRef, rawSetIsRegionInverted, 'isRegionInverted'),
    [makeSyncedSetter]
  );
  const setQuadPoints = useCallback(
    makeSyncedSetter(quadPointsRef, rawSetQuadPoints, 'quadPoints', syncHasSelectionProxy),
    [makeSyncedSetter, syncHasSelectionProxy]
  );
  const setIsPolyClosed = useCallback(
    makeSyncedSetter(isPolyClosedRef, rawSetIsPolyClosed, 'isPolyClosed', syncHasSelectionProxy),
    [makeSyncedSetter, syncHasSelectionProxy]
  );

  const [polyHoverClose, setPolyHoverClose] = useState<boolean>(false);
  const [polyMousePos, setPolyMousePos] = useState<Point | null>(null);
  const [draggingPointIdx, setDraggingPointIdx] = useState<number>(-1); 
  const [rotationAngle, setRotationAngle] = useState<number>(0); // 预览角度
  const rotationAngleRef = useRef<number>(0);
  rotationAngleRef.current = rotationAngle;
  const dragStartData = useRef<any>(null); 
  const mouseDownOutsideRef = useRef<{ x: number; y: number } | null>(null);

  // 稀疏高清重构工具状态
  const [hdBox, setHdBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const hdBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    hdBoxRef.current = hdBox;
  }, [hdBox]);
  const [hdDragHandle, setHdDragHandle] = useState<string | null>(null);
  const hdDragStartRef = useRef<{ clientX: number; clientY: number; box: { x: number; y: number; w: number; h: number } } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const [hdOriginalImage, setHdOriginalImage] = useState<string | null>(null);
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const isComparingOriginalRef = useRef<boolean>(false);
  isComparingOriginalRef.current = isComparingOriginal;
  const [isHdProcessing, setIsHdProcessing] = useState(false);

  // 矩形正交化校正工具状态
  const [orthoPoints, setOrthoPoints] = useState<Point[] | null>(null);
  const [draggingOrthoIdx, setDraggingOrthoIdx] = useState<number>(-1);
  const [orthoMagnifier, setOrthoMagnifier] = useState<{
    visible: boolean;
    imgX: number;
    imgY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // 导入图形图层状态 (支持多图形叠加、8点触控吸附缩放/移动、镜像、正负90°旋转)
  const [importedGraphics, rawSetImportedGraphics] = useState<ImportedGraphic[]>([]);
  const importedGraphicsRef = useRef<ImportedGraphic[]>([]);
  const setImportedGraphics = useCallback(
    makeSyncedSetter(importedGraphicsRef, rawSetImportedGraphics, 'importedGraphics'),
    [makeSyncedSetter]
  );

  const [selectedGraphicId, rawSetSelectedGraphicId] = useState<string | null>(null);
  const selectedGraphicIdRef = useRef<string | null>(null);
  const setSelectedGraphicId = useCallback(
    makeSyncedSetter(selectedGraphicIdRef, rawSetSelectedGraphicId, 'selectedGraphicId'),
    [makeSyncedSetter]
  );

  // 底图在统一图层栈中的下标 (0..importedGraphics.length，之前的图形在底图之下，之后的图形在底图之上)
  const [baseLayerIndex, rawSetBaseLayerIndex] = useState<number>(0);
  const baseLayerIndexRef = useRef<number>(0);
  const setBaseLayerIndex = useCallback(
    makeSyncedSetter(baseLayerIndexRef, rawSetBaseLayerIndex, 'baseLayerIndex'),
    [makeSyncedSetter]
  );

  const [graphicDragState, setGraphicDragState] = useState<{
    mode: 'move' | 'resize';
    graphicId: string;
    handleId?: EightPointHandleId;
    startClientX: number;
    startClientY: number;
    startBox: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const graphicDragStateRef = useRef<{
    mode: 'move' | 'resize';
    graphicId: string;
    handleId?: EightPointHandleId;
    startClientX: number;
    startClientY: number;
    startBox: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const [graphicSnapLines, setGraphicSnapLines] = useState<SnapGuideLines>({ x: null, y: null });
  const pendingGraphicDeselectRef = useRef<{ x: number; y: number } | null>(null);
  const baseElementRef = useRef<(GraphicBox & { url: string }) | null>(null);
  
  const imageRef = useRef<HTMLImageElement | null>(null);
  const displayMaskRef = useRef<HTMLCanvasElement | null>(null);

  // 当前版本号：统一读取 src/version.ts，禁止在此硬编码
  const version = SDK_VERSION;
  const effectiveApiKey = options.apiKey || (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) || "";

  // 动态加载 PDF.js 库
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.async = true;
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // 重置魔棒与辅助
  const resetWand = () => { 
    setActiveTool(null); 
    setMaskCanvas(null); 
    setLastClickPos(null); 
    setQuadPoints(null);
    setIsPolyClosed(false);
    setPolyMousePos(null);
    setPolyHoverClose(false);
    setOrthoPoints(null);
    setDraggingOrthoIdx(-1);
    setOrthoMagnifier(null);
  };
  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); setDisplaySize(null); };
  const changeZoom = (delta: number) => setZoom(prev => Math.max(0.5, Math.min(5, Math.round((prev + delta) * 100) / 100)));
  const hasSelection = !!(maskCanvas || selectionRegion || (quadPoints && isPolyClosed));

  const toggleInvertSelection = () => {
    if (maskCanvasRef.current) {
      handleInvertSelection();
    }
    if (selectionRegionRef.current || (quadPointsRef.current && isPolyClosedRef.current)) {
      setIsRegionInverted(prev => !prev);
    }
  };

  const clearSelection = () => {
    setSelectionRegion(null);
    setRectDragPoints(null);
    setIsRegionInverted(false);
    setMaskCanvas(null);
    setQuadPoints(null);
    setIsPolyClosed(false);
    setDrawingPath([]);
    setPolyMousePos(null);
    setPolyHoverClose(false);
    setActiveTool(null);
  };

  const clearGraphicsLayer = useCallback(() => {
    setImportedGraphics([]);
    setBaseLayerIndex(0);
    setSelectedGraphicId(null);
    graphicDragStateRef.current = null;
    setGraphicDragState(null);
    setGraphicSnapLines({ x: null, y: null });
    pendingGraphicDeselectRef.current = null;
    baseElementRef.current = null;
  }, [setImportedGraphics, setBaseLayerIndex, setSelectedGraphicId]);

  useEffect(() => {
    if (!currentImage) {
      clearGraphicsLayer();
    }
  }, [currentImage, clearGraphicsLayer]);

  useEffect(() => {
    if (activeTool) {
      setSelectedGraphicId(null);
      graphicDragStateRef.current = null;
      setGraphicDragState(null);
      setGraphicSnapLines({ x: null, y: null });
    }
  }, [activeTool, setSelectedGraphicId]);

  /**
   * 导出当前底图与独立图形图层状态快照（供图片之外单独存储并在下次编辑时继承还原）
   */
  const getLayerState = useCallback((): EditorLayerState => {
    return {
      version: version,
      type: 'tiamo-image-editor-state',
      timestamp: new Date().toISOString(),
      baseImage: currentImageRef.current || '',
      baseLayerIndex: baseLayerIndexRef.current,
      graphics: importedGraphicsRef.current.map((g) => ({ ...g })),
      baseElement: baseElementRef.current ? { ...baseElementRef.current } : null,
    };
  }, [version]);

  /**
   * 从已保存的分层状态恢复底图、图形图层顺序与锁定状态
   */
  const loadLayerState = useCallback((rawState: unknown): boolean => {
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
    setCurrentImage(parsed.baseImage);
    setActiveRecord(newRecord);
    setHistory([newRecord]);
    setPrompt("");
    resetWand();
    resetView();
    clearGraphicsLayer();
    setImportedGraphics(parsed.graphics.map((g) => ({ ...g })));
    setBaseLayerIndex(parsed.baseLayerIndex);
    baseElementRef.current = parsed.baseElement ? { ...parsed.baseElement } : null;
    setHdOriginalImage(null);
    setIsComparingOriginal(false);
    setSelectionRegion(null);
    setIsRegionInverted(false);
    setRotationAngle(0);
    return true;
  }, [clearGraphicsLayer, setCurrentImage, setImportedGraphics, setBaseLayerIndex, setSelectionRegion, setIsRegionInverted]);

  // 初始化图片加载
  const loadImageSource = useCallback((source: string | Blob | File | HTMLImageElement | HTMLCanvasElement) => {
    if (!source) return;
    if (typeof source === 'string') {
      const cached = findCachedLayerState(source);
      if (cached && cached.graphics.length > 0) {
        loadLayerState(cached);
        return;
      }
      const newRecord: HistoryRecord = { 
        id: Date.now(), 
        url: source, 
        prompt: `加载图片`, 
        timestamp: new Date().toLocaleTimeString(),
        layerState: {
          graphics: [],
          baseLayerIndex: 0,
          baseElement: null,
        },
      };
      setCurrentImage(source);
      setActiveRecord(newRecord);
      setHistory([newRecord]);
      setPrompt("");
      resetWand();
      resetView();
      clearGraphicsLayer();
      setHdOriginalImage(null);
      setIsComparingOriginal(false);
      setSelectionRegion(null);
      setIsRegionInverted(false);
      setRotationAngle(0);
    } else if (source instanceof HTMLImageElement) {
      const attrState = source.dataset?.tiamoLayerState;
      if (attrState && loadLayerState(attrState)) {
        return;
      }
      loadImageSource(source.src);
    } else if (source instanceof HTMLCanvasElement) {
      loadImageSource(source.toDataURL('image/png'));
    } else if (source instanceof Blob) {
      processFile(source as File);
    }
  }, [clearGraphicsLayer, loadLayerState]);

  useEffect(() => {
    if (options.initialState && loadLayerState(options.initialState)) {
      return;
    }
    if (options.initialImage) {
      loadImageSource(options.initialImage);
    }
  }, [options.initialImage, options.initialState, loadImageSource, loadLayerState]);

  // 处理文件上传（支持图片、PDF 与图层状态 JSON）
  const processFile = (file: File) => {
    if (!file) return;
    
    const isJsonState = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (isJsonState) {
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string' && loadLayerState(text)) {
          setIsLoading(false);
          return;
        }
        setErrorMessage("错误: 无效的图层状态文件（请确认是 TiamoImageEditor 导出的 .layers.json）");
        setIsLoading(false);
      };
      reader.onerror = () => {
        setErrorMessage("错误: 读取图层状态文件失败");
        setIsLoading(false);
      };
      reader.readAsText(file);
      return;
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      if (!(window as any).pdfjsLib) {
        setErrorMessage("错误: PDF 解析引擎仍在加载中，请稍后再试");
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          if (pdf.numPages === 0) {
            throw new Error("该PDF文件不包含任何有效页面");
          }
          
          // 默认读取并渲染第一页
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 }); // 使用 2x 缩放保证渲染清晰度
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("无法创建画布上下文");
          
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          const base64 = canvas.toDataURL('image/png');
          
          const newRecord: HistoryRecord = { 
            id: Date.now(), 
            url: base64, 
            prompt: `导入PDF第1页: ${file.name}`, 
            timestamp: new Date().toLocaleTimeString(),
            layerState: {
              graphics: [],
              baseLayerIndex: 0,
              baseElement: null,
            },
          };
          
          setCurrentImage(base64); 
          setActiveRecord(newRecord); 
          setHistory([newRecord]);
          setPrompt(""); 
          resetWand(); 
          resetView(); 
          clearGraphicsLayer();
          setSelectionRegion(null); 
          setIsRegionInverted(false); 
          setRotationAngle(0);
        } catch (err: any) {
          setErrorMessage("PDF 导入失败: " + err.message);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
      
    } else if (file.type.startsWith('image/')) {
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const cached = findCachedLayerState(base64);
        if (cached && cached.graphics.length > 0 && loadLayerState(cached)) {
          setIsLoading(false);
          return;
        }
        const newRecord: HistoryRecord = { 
          id: Date.now(), 
          url: base64, 
          prompt: `导入图片: ${file.name}`, 
          timestamp: new Date().toLocaleTimeString(),
          layerState: {
            graphics: [],
            baseLayerIndex: 0,
            baseElement: null,
          },
        };
        setCurrentImage(base64); 
        setActiveRecord(newRecord); 
        setHistory([newRecord]);
        setPrompt(""); 
        resetWand(); 
        resetView(); 
        clearGraphicsLayer();
        setSelectionRegion(null); 
        setIsRegionInverted(false); 
        setRotationAngle(0);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("错误: 不支持的文件格式（请上传图片、PDF 或 .layers.json 状态文件）");
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onRequestImportGraphicRef = useRef(options.onRequestImportGraphic);
  onRequestImportGraphicRef.current = options.onRequestImportGraphic;

  /**
   * 编程式导入图形接口：供宿主直接从自有素材库传入 URL / Base64 / Blob / File / HTMLImageElement / HTMLCanvasElement，
   * 自动叠加至画布并激活 8 点触控选中态
   */
  const importGraphic = useCallback(async (
    source: GraphicInputSource,
    importOpts?: ImportGraphicOptions
  ): Promise<ImportedGraphic | null> => {
    if (!currentImageRef.current) {
      setErrorMessage("错误: 请先载入底图后再导入图形");
      return null;
    }

    setErrorMessage(null);
    try {
      const { dataUrl, naturalWidth: gW, naturalHeight: gH, defaultName } = await resolveGraphicSourceToDataUrl(source);
      const nw = imageRef.current?.naturalWidth || gW || 400;
      const nh = imageRef.current?.naturalHeight || gH || 400;

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

      setActiveTool(null);
      setSelectionRegion(null);
      const nextList = [...importedGraphicsRef.current, newGraphic];
      importedGraphicsRef.current = nextList;
      setImportedGraphics(nextList);

      if (autoSelect) {
        selectedGraphicIdRef.current = newGraphic.id;
        setSelectedGraphicId(newGraphic.id);
      }

      return newGraphic;
    } catch (err: any) {
      console.error('[ImportGraphic Error]', err);
      setErrorMessage(err?.message || "导入图形失败");
      return null;
    }
  }, []);

  /**
   * 本地文件导入图形入口（兼容默认点击上传按钮场景）
   */
  const handleImportGraphicFile = useCallback((file: File) => {
    if (!file) return;
    void importGraphic(file, { name: file.name });
  }, [importGraphic]);

  /**
   * 触发宿主自定义图形素材库钩子（若配置了 onRequestImportGraphic，则拦截默认本地文件选择器）
   */
  const handleTriggerImportGraphic = useCallback(async (): Promise<boolean> => {
    const handler = onRequestImportGraphicRef.current;
    if (!handler) return false;
    try {
      const res = await handler(importGraphic);
      if (res) {
        const items = Array.isArray(res) ? res : [res];
        for (const item of items) {
          if (!item) continue;
          if (
            typeof item === 'object' &&
            'source' in item &&
            !(typeof Blob !== 'undefined' && item instanceof Blob) &&
            !(typeof HTMLImageElement !== 'undefined' && item instanceof HTMLImageElement) &&
            !(typeof HTMLCanvasElement !== 'undefined' && item instanceof HTMLCanvasElement)
          ) {
            await importGraphic(item.source, item.options);
          } else {
            await importGraphic(item as GraphicInputSource);
          }
        }
      }
    } catch (err: any) {
      console.error('[OnRequestImportGraphic Error]', err);
      setErrorMessage(`导入图形失败: ${err?.message || err}`);
    }
    return true;
  }, [importGraphic]);

  useEffect(() => {
    if (activeTool !== 'quad') {
      if (!isPolyClosed) {
        setQuadPoints(null);
        setPolyHoverClose(false);
        setPolyMousePos(null);
      }
    }
  }, [activeTool, isPolyClosed]);

  useEffect(() => {
    if (activeTool === 'hd') {
      if (imageRef.current) {
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        if (nw > 0 && nh > 0) {
          setHdBox(prev => prev || { x: 0, y: 0, w: nw, h: nh });
        }
      }
      setSelectionRegion(null);
    } else {
      setHdBox(null);
      setHdDragHandle(null);
    }
  }, [activeTool, currentImage]);

  useEffect(() => {
    if (activeTool === 'ortho') {
      if (imageRef.current) {
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        if (nw > 0 && nh > 0) {
          setOrthoPoints(prev => {
            if (prev && prev.length === 4) return prev;
            if (selectionRegion && selectionRegion.type === 'rect') {
              const r = selectionRegion.data;
              return [
                { x: Math.max(0, r.x), y: Math.max(0, r.y) },
                { x: Math.min(nw, r.x + r.w), y: Math.max(0, r.y) },
                { x: Math.min(nw, r.x + r.w), y: Math.min(nh, r.y + r.h) },
                { x: Math.max(0, r.x), y: Math.min(nh, r.y + r.h) },
              ];
            }
            const marginX = Math.round(nw * 0.15);
            const marginY = Math.round(nh * 0.15);
            return [
              { x: marginX, y: marginY },
              { x: nw - marginX, y: marginY },
              { x: nw - marginX, y: nh - marginY },
              { x: marginX, y: nh - marginY },
            ];
          });
        }
      }
      setSelectionRegion(null);
    } else {
      setDraggingOrthoIdx(-1);
      setOrthoMagnifier(null);
    }
  }, [activeTool, currentImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isLoading) setSpacePressed(true);
      if (e.code === 'Escape' && selectedGraphicIdRef.current) {
        selectedGraphicIdRef.current = null;
        setSelectedGraphicId(null);
        graphicDragStateRef.current = null;
        setGraphicDragState(null);
        setGraphicSnapLines({ x: null, y: null });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLoading]);

  useEffect(() => {
    maskCanvasRef.current = maskCanvas; 
    if (maskCanvas && displayMaskRef.current) {
      const canvas = displayMaskRef.current;
      canvas.width = maskCanvas.width;
      canvas.height = maskCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(maskCanvas, 0, 0);
      }
    } else if (!maskCanvas && displayMaskRef.current) {
      const ctx = displayMaskRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, displayMaskRef.current.width, displayMaskRef.current.height);
      }
    }
  }, [maskCanvas]);

  const isInsideLockedRegionScoped = (x: number, y: number, region: SelectionRegion | null) => {
    return isInsideLockedRegion(x, y, region, isRegionInvertedRef.current);
  };

  const computeSelection = useCallback((startX: number, startY: number, currentTolerance: number, mode: 'global' | 'connected', region: SelectionRegion | null, isAdding: boolean) => {
    if (!currentImageRef.current || !imageRef.current) return;
    const img = imageRef.current;
    if (!img.complete || img.naturalWidth === 0) return;

    const runWandOnCanvas = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data; const { width, height } = canvas;
      const targetIdx = (startY * width + startX) * 4;
      const [targetR, targetG, targetB, targetA] = [data[targetIdx], data[targetIdx+1], data[targetIdx+2], data[targetIdx+3]];
      const nextSampled = { r: targetR, g: targetG, b: targetB, a: targetA };
      sampledColorRef.current = nextSampled;
      setSampledColor(nextSampled);
      const mCanvas = document.createElement('canvas'); mCanvas.width = width; mCanvas.height = height;
      const mCtx = mCanvas.getContext('2d');
      if (!mCtx) return;
      if (isAdding && maskCanvasRef.current) mCtx.drawImage(maskCanvasRef.current, 0, 0);
      const mImageData = mCtx.getImageData(0, 0, width, height);
      const mData = mImageData.data; const tolSq = currentTolerance * currentTolerance;
      let hasSelected = false;
      const isSimilar = (idx: number) => {
        const dr = data[idx] - targetR, dg = data[idx+1] - targetG, db = data[idx+2] - targetB, da = data[idx+3] - targetA;
        return (dr*dr + dg*dg + db*db + da*da) < tolSq;
      };
      if (mode === 'global') {
        for (let i = 0; i < data.length; i += 4) {
          const x = (i / 4) % width, y = Math.floor((i / 4) / width);
          if (isSimilar(i) && isInsideLockedRegionScoped(x, y, region)) {
            mData[i] = 255; mData[i+1] = 255; mData[i+2] = 0; mData[i+3] = 180; hasSelected = true;
          }
        }
      } else {
        if (!isInsideLockedRegionScoped(startX, startY, region)) return;
        const visited = new Uint8Array(width * height); const stack: [number, number][] = [[startX, startY]];
        visited[startY * width + startX] = 1;
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!; const pIdx = (cy * width + cx) * 4;
          mData[pIdx] = 255; mData[pIdx+1] = 255; mData[pIdx+2] = 0; mData[pIdx+3] = 180; hasSelected = true;
          const neighbors: [number, number][] = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (!visited[nIdx] && isSimilar(nIdx * 4) && isInsideLockedRegionScoped(nx, ny, region)) {
                visited[nIdx] = 1; stack.push([nx, ny]);
              }
            }
          }
        }
      }
      if (hasSelected || isAdding) { mCtx.putImageData(mImageData, 0, 0); setMaskCanvas(mCanvas); } 
      else setMaskCanvas(null);
    };

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    runWandOnCanvas(canvas);
  }, [currentImage, isRegionInverted, setMaskCanvas]); 

  useEffect(() => {
    if (activeTool === 'wand' && lastClickPos) {
      computeSelection(lastClickPos.x, lastClickPos.y, tolerance, selectionMode, selectionRegion, lastClickPos.isAdding);
    }
  }, [tolerance, activeTool, lastClickPos, selectionMode, selectionRegion, isRegionInverted, computeSelection]); 

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isAdding = e.metaKey || e.ctrlKey;

    const nw = imageRef.current!.naturalWidth, nh = imageRef.current!.naturalHeight;
    const rawFloatX = ((e.clientX - rect.left) / rect.width) * nw;
    const rawFloatY = ((e.clientY - rect.top) / rect.height) * nh;
    const rawX = Math.floor(rawFloatX);
    const rawY = Math.floor(rawFloatY);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    const isOutsideImage = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;

    // 导入图形图层命中与 8 点触控把手拖拽拦截 (无绘制工具激活且左键点击，已锁定图形跳过命中检测)
    if (e.button === 0 && !spacePressed && !activeTool) {
      const targetEl = e.target as HTMLElement | null;
      const graphicHandleEl = targetEl?.closest('[data-graphic-handle]') as HTMLElement | null;
      if (graphicHandleEl && selectedGraphicIdRef.current) {
        const handleId = graphicHandleEl.dataset.graphicHandle as EightPointHandleId | undefined;
        const targetGraphic = importedGraphicsRef.current.find(g => g.id === selectedGraphicIdRef.current);
        if (handleId && targetGraphic && !targetGraphic.locked) {
          e.preventDefault();
          e.stopPropagation();
          const dragInit = {
            mode: 'resize' as const,
            graphicId: targetGraphic.id,
            handleId,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startBox: { x: targetGraphic.x, y: targetGraphic.y, w: targetGraphic.w, h: targetGraphic.h },
          };
          graphicDragStateRef.current = dragInit;
          setGraphicDragState(dragInit);
          pendingGraphicDeselectRef.current = null;
          return;
        }
      }

      const graphicBodyEl = targetEl?.closest('[data-graphic-id]') as HTMLElement | null;
      let hitGraphicId = graphicBodyEl?.dataset.graphicId || null;
      if (hitGraphicId) {
        const directTarget = importedGraphicsRef.current.find(g => g.id === hitGraphicId);
        if (!directTarget || directTarget.locked) {
          hitGraphicId = null;
        }
      }
      if (!hitGraphicId && importedGraphicsRef.current.length > 0) {
        for (let i = importedGraphicsRef.current.length - 1; i >= 0; i--) {
          const g = importedGraphicsRef.current[i];
          if (g.locked) continue;
          if (rawFloatX >= g.x && rawFloatX <= g.x + g.w && rawFloatY >= g.y && rawFloatY <= g.y + g.h) {
            hitGraphicId = g.id;
            break;
          }
        }
      }

      if (hitGraphicId) {
        const targetGraphic = importedGraphicsRef.current.find(g => g.id === hitGraphicId);
        if (targetGraphic && !targetGraphic.locked) {
          e.preventDefault();
          e.stopPropagation();
          selectedGraphicIdRef.current = targetGraphic.id;
          setSelectedGraphicId(targetGraphic.id);
          const dragInit = {
            mode: 'move' as const,
            graphicId: targetGraphic.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startBox: { x: targetGraphic.x, y: targetGraphic.y, w: targetGraphic.w, h: targetGraphic.h },
          };
          graphicDragStateRef.current = dragInit;
          setGraphicDragState(dragInit);
          pendingGraphicDeselectRef.current = null;
          return;
        }
      }

      if (selectedGraphicIdRef.current) {
        pendingGraphicDeselectRef.current = { x: e.clientX, y: e.clientY };
      }
    }

    // 快捷键空格、非鼠标主键或未选择任何绘制工具时，进入画布平移拖拽模式
    if (e.button !== 0 || spacePressed || !activeTool) {
      e.preventDefault();
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (isOutsideImage) {
        mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    // 高清化 8 点控制拖拽拦截
    if (activeTool === 'hd') {
      const hdTarget = (e.target as HTMLElement).closest('[data-hd-handle]') as HTMLElement | null;
      const targetHandle = hdTarget ? hdTarget.dataset.hdHandle : null;
      if (targetHandle) {
        e.preventDefault();
        e.stopPropagation();
        setHdDragHandle(targetHandle);
        hdDragStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          box: { ...(hdBox || { x: 0, y: 0, w: nw, h: nh }) },
        };
        return;
      }
    }

    // 正交化工具 4 角拖拽手柄命中
    if (activeTool === 'ortho' && orthoPoints && orthoPoints.length === 4) {
      const thr = 28 / zoom;
      const idx = orthoPoints.findIndex(p => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
      if (idx !== -1) {
        setDraggingOrthoIdx(idx);
        setOrthoMagnifier({
          visible: true,
          imgX: orthoPoints[idx].x,
          imgY: orthoPoints[idx].y,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        return;
      }
    }

    // 非框选/套索/高清/正交化类工具（如魔棒、吸管、多边形打点），在画布外点击时作为画布平移处理
    if (isOutsideImage && activeTool !== 'rect' && activeTool !== 'lasso' && activeTool !== 'hd' && activeTool !== 'ortho') {
      if (e.button === 0) {
        setIsPanning(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (activeTool === 'quad') {
      if (isPolyClosed && quadPoints) {
        const thr = 20 / zoom;
        const idx = quadPoints.findIndex(p => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
        if (idx !== -1) { setDraggingPointIdx(idx); dragStartData.current = { x: quadPoints[idx].x, y: quadPoints[idx].y }; return; }
      } else {
        // 多边范围打点：点一次拉一根直线，首尾相连则结束选定
        if (!quadPoints || quadPoints.length === 0) {
          setQuadPoints([{ x: imgX, y: imgY }]);
          setIsPolyClosed(false);
          return;
        }
        const p0 = quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        if (quadPoints.length >= 3 && dist < (20 / zoom)) {
          // 首尾相连闭合！
          setIsPolyClosed(true);
          setSelectionRegion({ type: 'path', data: quadPoints });
          setPolyHoverClose(false);
          setPolyMousePos(null);
          return;
        }
        setQuadPoints(prev => prev ? [...prev, { x: imgX, y: imgY }] : [{ x: imgX, y: imgY }]);
        return;
      }
    }
    if (activeTool === 'rect' && selectionRegion?.type === 'rect') {
      const r = selectionRegion.data; const thr = 20 / zoom; let hitIdx = -1;
      if (Math.abs(r.x - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 0;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 1;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 2;
      else if (Math.abs(r.x - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 3;
      if (hitIdx !== -1) { 
        setDraggingPointIdx(hitIdx); 
        dragStartData.current = { ...r }; 
        const curPt = hitIdx === 0 ? { x: r.x, y: r.y } :
                      hitIdx === 1 ? { x: r.x + r.w, y: r.y } :
                      hitIdx === 2 ? { x: r.x + r.w, y: r.y + r.h } :
                      { x: r.x, y: r.y + r.h };
        const oppPt = hitIdx === 0 ? { x: r.x + r.w, y: r.y + r.h } :
                      hitIdx === 1 ? { x: r.x, y: r.y + r.h } :
                      hitIdx === 2 ? { x: r.x, y: r.y } :
                      { x: r.x + r.w, y: r.y };
        setRectDragPoints({ current: curPt, opposite: oppPt });
        return; 
      }
    }
    if (activeTool === 'pipette') {
      const sampleFromCanvas = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pixel = ctx.getImageData(Math.min(nw - 1, imgX), Math.min(nh - 1, imgY), 1, 1).data;
        setFillColor("#" + Array.from(pixel.slice(0, 3)).map(x => x.toString(16).padStart(2, '0')).join(''));
        setActiveTool(null);
      };

      const canvas = document.createElement('canvas'); canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d'); 
      if (ctx && imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0);
        sampleFromCanvas(canvas);
      } else {
        setActiveTool(null);
      }
      return;
    }
    if (activeTool === 'rect') {
      // 支持画布外负数/超界坐标拖动：自动将起点智能吸附至画布边缘 (0~nw, 0~nh)
      setRegionStart({ x: imgX, y: imgY });
      setSelectionRegion({ type: 'rect', data: { x: imgX, y: imgY, w: 0, h: 0 } });
      setRectDragPoints({ current: { x: imgX, y: imgY }, opposite: { x: imgX, y: imgY } });
    } else if (activeTool === 'lasso') {
      setDrawingPath([{ x: imgX, y: imgY }]);
    } else if (activeTool === 'wand') {
      setLastClickPos({ x: imgX, y: imgY, isAdding });
      computeSelection(imgX, imgY, tolerance, selectionMode, selectionRegion, isAdding);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'quad' && !isPolyClosed && quadPoints && quadPoints.length >= 3) {
      setIsPolyClosed(true);
      setSelectionRegion({ type: 'path', data: quadPoints });
      setPolyHoverClose(false);
      setPolyMousePos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const gDrag = graphicDragStateRef.current;
    if (gDrag && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const nw = imageRef.current.naturalWidth;
      const nh = imageRef.current.naturalHeight;
      if (!nw || !nh || !rect.width || !rect.height) return;

      const snapThreshold = Math.max(3, (8 * nw) / rect.width);
      const otherGraphics = importedGraphicsRef.current.filter(g => g.id !== gDrag.graphicId);
      const extraSnapBoxes = baseElementRef.current
        ? [{ x: baseElementRef.current.x, y: baseElementRef.current.y, w: baseElementRef.current.w, h: baseElementRef.current.h }]
        : [];

      if (gDrag.mode === 'move') {
        const dxImg = ((e.clientX - gDrag.startClientX) / rect.width) * nw;
        const dyImg = ((e.clientY - gDrag.startClientY) / rect.height) * nh;
        const { x, y, snapLines } = computeGraphicMoveWithSnap(
          gDrag.startBox.x + dxImg,
          gDrag.startBox.y + dyImg,
          gDrag.startBox.w,
          gDrag.startBox.h,
          nw,
          nh,
          otherGraphics,
          snapThreshold,
          extraSnapBoxes
        );
        setGraphicSnapLines(snapLines);
        const updated = importedGraphicsRef.current.map(g =>
          g.id === gDrag.graphicId ? { ...g, x, y } : g
        );
        importedGraphicsRef.current = updated;
        setImportedGraphics(updated);
      } else if (gDrag.mode === 'resize' && gDrag.handleId) {
        const rawFloatX = ((e.clientX - rect.left) / rect.width) * nw;
        const rawFloatY = ((e.clientY - rect.top) / rect.height) * nh;
        const { box, snapLines } = computeGraphicResizeWithSnap(
          gDrag.handleId,
          rawFloatX,
          rawFloatY,
          gDrag.startBox,
          nw,
          nh,
          otherGraphics,
          snapThreshold,
          extraSnapBoxes
        );
        setGraphicSnapLines(snapLines);
        const updated = importedGraphicsRef.current.map(g =>
          g.id === gDrag.graphicId ? { ...g, ...box } : g
        );
        importedGraphicsRef.current = updated;
        setImportedGraphics(updated);
      }
      return;
    }

    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x, dy = e.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY }; return;
    }
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const nw = imageRef.current.naturalWidth, nh = imageRef.current.naturalHeight;
    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * nw);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * nh);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    if (activeTool === 'hd' && hdDragHandle) {
      const aspect = nw / nh;
      let w = nw;
      let h = nh;
      let x = 0;
      let y = 0;

      switch (hdDragHandle) {
        case 'se': {
          const scale = Math.max(1, Math.max(rawX / nw, rawY / nh));
          w = Math.max(nw, Math.round(nw * scale));
          h = Math.round(w / aspect);
          x = 0;
          y = 0;
          break;
        }
        case 'e': {
          w = Math.max(nw, Math.round(rawX));
          h = nh;
          x = 0;
          y = 0;
          break;
        }
        case 's': {
          w = nw;
          h = Math.max(nh, Math.round(rawY));
          x = 0;
          y = 0;
          break;
        }
        case 'ne': {
          const scale = Math.max(1, Math.max(rawX / nw, (nh - rawY) / nh));
          w = Math.max(nw, Math.round(nw * scale));
          h = Math.round(w / aspect);
          x = 0;
          y = nh - h;
          break;
        }
        case 'n': {
          w = nw;
          h = Math.max(nh, Math.round(nh - rawY));
          x = 0;
          y = nh - h;
          break;
        }
        case 'nw': {
          const scale = Math.max(1, Math.max((nw - rawX) / nw, (nh - rawY) / nh));
          w = Math.max(nw, Math.round(nw * scale));
          h = Math.round(w / aspect);
          x = nw - w;
          y = nh - h;
          break;
        }
        case 'w': {
          w = Math.max(nw, Math.round(nw - rawX));
          h = nh;
          x = nw - w;
          y = 0;
          break;
        }
        case 'sw': {
          const scale = Math.max(1, Math.max((nw - rawX) / nw, rawY / nh));
          w = Math.max(nw, Math.round(nw * scale));
          h = Math.round(w / aspect);
          x = nw - w;
          y = 0;
          break;
        }
      }

      setHdBox({ x, y, w, h });
      return;
    }

    if (activeTool === 'ortho' && draggingOrthoIdx !== -1 && orthoPoints) {
      const newPts = [...orthoPoints];
      newPts[draggingOrthoIdx] = { x: imgX, y: imgY };
      setOrthoPoints(newPts);
      setOrthoMagnifier({
        visible: true,
        imgX,
        imgY,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      return;
    }

    if (activeTool === 'quad') {
      if (isPolyClosed && draggingPointIdx !== -1 && quadPoints) {
        let fx = imgX, fy = imgY;
        if ((e.metaKey || e.ctrlKey) && dragStartData.current) {
          if (Math.abs(imgX - dragStartData.current.x) > Math.abs(imgY - dragStartData.current.y)) fy = dragStartData.current.y; else fx = dragStartData.current.x;
        }
        setQuadPoints(prev => { 
          if (!prev) return null;
          const n = [...prev]; n[draggingPointIdx] = { x: fx, y: fy }; return n; 
        }); 
        setSelectionRegion({ type: 'path', data: quadPoints });
        return;
      }
      if (!isPolyClosed && quadPoints && quadPoints.length > 0) {
        setPolyMousePos({ x: imgX, y: imgY });
        const p0 = quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        setPolyHoverClose(quadPoints.length >= 3 && dist < (20 / zoom));
        return;
      }
    }
    if (activeTool === 'rect' && draggingPointIdx !== -1 && selectionRegion?.type === 'rect') {
      const r = { ...selectionRegion.data }; const start = dragStartData.current; let fx = imgX, fy = imgY;
      if (e.metaKey || e.ctrlKey) {
        const bx = (draggingPointIdx === 0 || draggingPointIdx === 3) ? start.x : start.x + start.w;
        const by = (draggingPointIdx === 0 || draggingPointIdx === 1) ? start.y : start.y + start.h;
        if (Math.abs(imgX - bx) > Math.abs(imgY - by)) fy = by; else fx = bx;
      }
      if (draggingPointIdx === 0) { r.w += r.x - fx; r.h += r.y - fy; r.x = fx; r.y = fy; }
      else if (draggingPointIdx === 1) { r.w = fx - r.x; r.h += r.y - fy; r.y = fy; }
      else if (draggingPointIdx === 2) { r.w = fx - r.x; r.h = fy - r.y; }
      else if (draggingPointIdx === 3) { r.w += r.x - fx; r.x = fx; r.h = fy - r.y; }
      setSelectionRegion({ type: 'rect', data: r });
      
      const curPt = draggingPointIdx === 0 ? { x: r.x, y: r.y } :
                    draggingPointIdx === 1 ? { x: r.x + r.w, y: r.y } :
                    draggingPointIdx === 2 ? { x: r.x + r.w, y: r.y + r.h } :
                    { x: r.x, y: r.y + r.h };
      const oppPt = draggingPointIdx === 0 ? { x: r.x + r.w, y: r.y + r.h } :
                    draggingPointIdx === 1 ? { x: r.x, y: r.y + r.h } :
                    draggingPointIdx === 2 ? { x: r.x, y: r.y } :
                    { x: r.x + r.w, y: r.y };
      setRectDragPoints({ current: curPt, opposite: oppPt });
      return;
    }
    if (!regionStart && drawingPath.length === 0) return;

    if (activeTool === 'rect' && regionStart) {
      const x = Math.min(regionStart.x, imgX), y = Math.min(regionStart.y, imgY);
      const w = Math.abs(regionStart.x - imgX), h = Math.abs(regionStart.y - imgY);
      setSelectionRegion({ type: 'rect', data: { x, y, w, h } });
      setRectDragPoints({
        current: { x: imgX, y: imgY },
        opposite: { x: regionStart.x, y: regionStart.y },
      });
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      setDrawingPath(prev => [...prev, { x: imgX, y: imgY }]);
    }
  };

  const handleMouseUp = (e?: React.MouseEvent) => {
    setIsPanning(false); 
    setDraggingPointIdx(-1); 
    setDraggingOrthoIdx(-1);
    setOrthoMagnifier(null);
    dragStartData.current = null;
    setRectDragPoints(null);

    if (graphicDragStateRef.current) {
      graphicDragStateRef.current = null;
      setGraphicDragState(null);
      setGraphicSnapLines({ x: null, y: null });
    }

    if (pendingGraphicDeselectRef.current) {
      const startPos = pendingGraphicDeselectRef.current;
      pendingGraphicDeselectRef.current = null;
      const clientX = e ? e.clientX : startPos.x;
      const clientY = e ? e.clientY : startPos.y;
      const dist = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (dist < 5) {
        selectedGraphicIdRef.current = null;
        setSelectedGraphicId(null);
      }
    }

    // 若在画布外部点击且没有实质移动（纯点击取消），统一在 mouse up 释放时清除选区
    if (mouseDownOutsideRef.current) {
      const startPos = mouseDownOutsideRef.current;
      mouseDownOutsideRef.current = null;
      const clientX = e ? e.clientX : startPos.x;
      const clientY = e ? e.clientY : startPos.y;
      const dist = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (dist < 5 && hasSelection) {
        clearSelection();
      }
    }

    if (activeTool === 'hd' && hdDragHandle) {
      const box = hdBoxRef.current;
      setHdDragHandle(null);
      hdDragStartRef.current = null;
      if (box && imageRef.current) {
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        if (box.w > nw || box.h > nh) {
          applySparseHD(Math.round(box.w), Math.round(box.h));
        } else {
          setHdBox({ x: 0, y: 0, w: nw, h: nh });
        }
      }
      return;
    }

    if (activeTool === 'rect' && regionStart) {
      setRegionStart(null); 
      // 拖拽宽度或高度过小（单次点击或原地微移），判定为取消/退出框选状态
      if (selectionRegion && (selectionRegion.data.w < 2 || selectionRegion.data.h < 2)) { 
        clearSelection();
      }
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      if (drawingPath.length > 3) setSelectionRegion({ type: 'path', data: drawingPath }); 
      else setSelectionRegion(null);
      setDrawingPath([]); 
      setActiveTool(null);
    }
  };

  // 保持事件引用最新，便于 window 全局监听调用
  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  const isDraggingAny = !!(regionStart || isPanning || draggingPointIdx !== -1 || drawingPath.length > 0 || rectDragPoints || hdDragHandle || graphicDragState);

  // 处于拖拽框选、视口平移或定点拉伸状态时，全局接管 mousemove 和 mouseup，彻底杜绝鼠标移出工作区或经过外部 UI 时发生卡顿或丢失拖拽
  useEffect(() => {
    if (!isDraggingAny) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMoveRef.current(e as any);
    };

    const onGlobalMouseUp = (e: MouseEvent) => {
      handleMouseUpRef.current(e as any);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isDraggingAny]);

  /**
   * 获取底图编辑操作源（保持未融合的独立图形图层不被常规底图工具强制拍平清空）
   */
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

  /**
   * 对当前选中的导入图形执行左右镜像 / 上下镜像
   */
  const handleGraphicFlip = useCallback(async (dir: 'flipH' | 'flipV') => {
    const targetId = selectedGraphicIdRef.current;
    if (!targetId) return;
    const target = importedGraphicsRef.current.find(g => g.id === targetId);
    if (!target) return;
    try {
      const updatedGraphic = await transformGraphicImage(target, dir);
      const nextList = importedGraphicsRef.current.map(g => (g.id === targetId ? updatedGraphic : g));
      importedGraphicsRef.current = nextList;
      setImportedGraphics(nextList);
    } catch (err: any) {
      console.error('[GraphicFlip Error]', err);
      setErrorMessage(`图形镜像失败: ${err?.message || err}`);
    }
  }, []);

  /**
   * 对当前选中的导入图形执行顺时针 / 逆时针 90° 旋转
   */
  const handleGraphicRotate90 = useCallback(async (dir: 'cw' | 'ccw') => {
    const targetId = selectedGraphicIdRef.current;
    if (!targetId) return;
    const target = importedGraphicsRef.current.find(g => g.id === targetId);
    if (!target) return;
    try {
      const action = dir === 'cw' ? 'rotateCw' : 'rotateCcw';
      const updatedGraphic = await transformGraphicImage(target, action);
      const nextList = importedGraphicsRef.current.map(g => (g.id === targetId ? updatedGraphic : g));
      importedGraphicsRef.current = nextList;
      setImportedGraphics(nextList);
    } catch (err: any) {
      console.error('[GraphicRotate Error]', err);
      setErrorMessage(`图形旋转失败: ${err?.message || err}`);
    }
  }, []);

  /**
   * 调整当前选中导入图形与底图的层级顺序（最顶 / 上一层 / 下一层 / 最底）
   */
  const handleGraphicLayerOrder = useCallback((action: GraphicLayerOrderAction) => {
    const targetId = selectedGraphicIdRef.current;
    if (!targetId) return;
    const { graphics: nextGraphics, baseLayerIndex: nextBaseIdx } = reorderGraphicLayer(
      importedGraphicsRef.current,
      baseLayerIndexRef.current,
      targetId,
      action
    );
    importedGraphicsRef.current = nextGraphics;
    setImportedGraphics(nextGraphics);
    baseLayerIndexRef.current = nextBaseIdx;
    setBaseLayerIndex(nextBaseIdx);
  }, []);

  /**
   * 移除当前选中的导入图形
   */
  const handleDeleteSelectedGraphic = useCallback(() => {
    const targetId = selectedGraphicIdRef.current;
    if (!targetId) return;
    const targetIdx = importedGraphicsRef.current.findIndex(g => g.id === targetId);
    const nextList = importedGraphicsRef.current.filter(g => g.id !== targetId);
    importedGraphicsRef.current = nextList;
    setImportedGraphics(nextList);
    if (targetIdx !== -1 && targetIdx < baseLayerIndexRef.current) {
      const nextBaseIdx = Math.max(0, Math.min(nextList.length, baseLayerIndexRef.current - 1));
      baseLayerIndexRef.current = nextBaseIdx;
      setBaseLayerIndex(nextBaseIdx);
    } else if (baseLayerIndexRef.current > nextList.length) {
      baseLayerIndexRef.current = nextList.length;
      setBaseLayerIndex(nextList.length);
    }
    selectedGraphicIdRef.current = null;
    setSelectedGraphicId(null);
    graphicDragStateRef.current = null;
    setGraphicDragState(null);
    setGraphicSnapLines({ x: null, y: null });
  }, []);

  /**
   * 锁定当前选中的导入图形：锁定后不能移动与缩放，且不再响应任何鼠标消息，避免遮挡下方图层编辑
   */
  const handleLockSelectedGraphic = useCallback(() => {
    const targetId = selectedGraphicIdRef.current;
    if (!targetId) return;
    const nextList = importedGraphicsRef.current.map(g =>
      g.id === targetId ? { ...g, locked: true } : g
    );
    importedGraphicsRef.current = nextList;
    setImportedGraphics(nextList);
    selectedGraphicIdRef.current = null;
    setSelectedGraphicId(null);
    graphicDragStateRef.current = null;
    setGraphicDragState(null);
    pendingGraphicDeselectRef.current = null;
    setGraphicSnapLines({ x: null, y: null });
  }, []);

  /**
   * 解锁画布中全部已锁定的导入图形，使其重新响应选中、移动与缩放
   */
  const handleUnlockAllGraphics = useCallback(() => {
    const hasLocked = importedGraphicsRef.current.some(g => g.locked);
    if (!hasLocked) return;
    const nextList = importedGraphicsRef.current.map(g =>
      g.locked ? { ...g, locked: false } : g
    );
    importedGraphicsRef.current = nextList;
    setImportedGraphics(nextList);
  }, []);

  /**
   * 仅将当前选中的导入图形这一层融合至底图：
   * 注意：该图形与底图合并后将丢失原独立层次信息，并与底图一起成为“最底”一层（baseLayerIndex 置 0），其余未融合图形保留在其上方
   */
  const commitImportedGraphics = useCallback(async () => {
    const targetId = selectedGraphicIdRef.current;
    const latestImage = currentImageRef.current;
    if (!latestImage || !targetId) return latestImage;
    const targetIdx = importedGraphicsRef.current.findIndex(g => g.id === targetId);
    if (targetIdx === -1) return latestImage;
    const targetGraphic = importedGraphicsRef.current[targetIdx];
    const isBelowBase = targetIdx < baseLayerIndexRef.current;

    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return latestImage;
      const compCanvas = await compositeSingleGraphicToCanvas(resolved.source, targetGraphic, isBelowBase);
      const resUrl = compCanvas.toDataURL('image/png');
      const remainingGraphics = importedGraphicsRef.current.filter(g => g.id !== targetId);

      setImportedGraphics(remainingGraphics);
      setBaseLayerIndex(0);
      const fusedBaseElement = {
        url: resUrl,
        x: 0,
        y: 0,
        w: compCanvas.width,
        h: compCanvas.height,
      };
      baseElementRef.current = fusedBaseElement;
      setSelectedGraphicId(null);
      graphicDragStateRef.current = null;
      setGraphicDragState(null);
      pendingGraphicDeselectRef.current = null;
      setGraphicSnapLines({ x: null, y: null });

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
      setHistory(prev => [rec, ...prev]);
      setCurrentImage(resUrl);
      setActiveRecord(rec);
      return resUrl;
    } catch (err: any) {
      console.error('[CommitGraphics Error]', err);
      setErrorMessage(`图形融合失败: ${err?.message || err}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [resolveEffectiveSource, setImportedGraphics, setBaseLayerIndex, setSelectedGraphicId, setCurrentImage]);

  /**
   * 扩展画布：取底图元素与所有导入图形外边框的最大并集，生成新画布并保持元素屏幕视觉位置不变
   */
  const handleExpandCanvas = useCallback(async () => {
    const latestImage = currentImageRef.current;
    if (!latestImage || !imageRef.current || importedGraphicsRef.current.length === 0) return;

    const img = imageRef.current;
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const origClientW = img.clientWidth;
    const origClientH = img.clientHeight;
    if (!origW || !origH) return;

    const baseInfo = baseElementRef.current || {
      url: latestImage,
      x: 0,
      y: 0,
      w: origW,
      h: origH,
    };

    const bounds = calculateExpandedCanvasBounds(baseInfo, importedGraphicsRef.current);
    if (
      bounds.minX === 0 &&
      bounds.minY === 0 &&
      bounds.width === origW &&
      bounds.height === origH
    ) {
      return;
    }

    setIsLoading(true);
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
      baseElementRef.current = nextBaseElement;

      const shiftedGraphics = importedGraphicsRef.current.map((g) => ({
        ...g,
        x: g.x + bounds.shiftX,
        y: g.y + bounds.shiftY,
      }));
      setImportedGraphics(shiftedGraphics);

      const pxPerImgX = origClientW / Math.max(1, origW);
      const pxPerImgY = origClientH / Math.max(1, origH);
      const targetDisplayW = Math.round(bounds.width * pxPerImgX);
      const targetDisplayH = Math.round(bounds.height * pxPerImgY);

      const deltaCenterImgX = bounds.width / 2 - bounds.shiftX - origW / 2;
      const deltaCenterImgY = bounds.height / 2 - bounds.shiftY - origH / 2;
      const curPan = panOffsetRef.current;
      const curZoom = zoomRef.current;
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
          baseLayerIndex: baseLayerIndexRef.current,
          baseElement: { ...nextBaseElement },
        },
      };

      setDisplaySize({ width: targetDisplayW, height: targetDisplayH });
      setPanOffset({ x: newPanX, y: newPanY });
      setCurrentImage(expandedBaseUrl);
      setActiveRecord(rec);
      setHistory((prev) => [rec, ...prev]);
    } catch (err: any) {
      console.error('[ExpandCanvas Error]', err);
      setErrorMessage(`扩展画布失败: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  }, [setImportedGraphics, setCurrentImage]);

  /** 切换历史记录时同步恢复或清空独立图形图层与扩展底图锚点状态 */
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
  }, [clearGraphicsLayer, setCurrentImage, setImportedGraphics, setBaseLayerIndex, setSelectedGraphicId]);

  /** 提交底图直接像素编辑结果并同步清理过期的扩展底图锚点引用 */
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
    setHistory(prev => [rec, ...prev]);
    setCurrentImage(url);
    setActiveRecord(rec);
    return rec;
  }, [setCurrentImage]);

  // 旋转应用逻辑
  const handleApplyRotation = async () => {
    const angle = rotationAngleRef.current;
    if (!currentImageRef.current || angle === 0) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const angleRad = (angle * Math.PI) / 180;
      const srcW = resolved.nw;
      const srcH = resolved.nh;

      // 计算旋转后的新画布尺寸
      const nw = Math.abs(srcW * Math.cos(angleRad)) + Math.abs(srcH * Math.sin(angleRad));
      const nh = Math.abs(srcW * Math.sin(angleRad)) + Math.abs(srcH * Math.cos(angleRad));

      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, nw, nh);
      ctx.translate(nw / 2, nh / 2);
      ctx.rotate(angleRad);
      ctx.drawImage(resolved.source, -srcW / 2, -srcH / 2);

      const res = canvas.toDataURL('image/png');
      commitBaseEditResult(res, `旋转图像 (${angle}°)`);
      setRotationAngle(0); setActiveTool(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlipHorizontal = async () => {
    if (selectedGraphicIdRef.current) {
      await handleGraphicFlip('flipH');
      return;
    }
    if (!currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nw;
      canvas.height = resolved.nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      commitBaseEditResult(res, "水平镜像");
      clearSelection();
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlipVertical = async () => {
    if (selectedGraphicIdRef.current) {
      await handleGraphicFlip('flipV');
      return;
    }
    if (!currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nw;
      canvas.height = resolved.nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      commitBaseEditResult(res, "垂直镜像");
      clearSelection();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotate90 = async (direction: 'cw' | 'ccw' = 'cw') => {
    if (selectedGraphicIdRef.current) {
      await handleGraphicRotate90(direction);
      return;
    }
    if (!currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nh;
      canvas.height = resolved.nw;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (direction === 'cw') {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
      } else {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(resolved.source, 0, 0);
      const res = canvas.toDataURL('image/png');
      commitBaseEditResult(res, direction === 'cw' ? "顺时针旋转 90°" : "逆时针旋转 90°");
      clearSelection();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 稀疏插值超分高清化算法 (按步骤 3.1 ~ 3.7 执行)
   * 3.1、新的高宽叫 W' 和 H'
   * 3.2、原图宽度x2，原始像素+空白像素+原始像素+空白像素重复
   * 3.3、原图高度x2，原始像素+空白像素+原始像素+空白像素重复
   * 3.4、横向填充，用两个原始像素的平均值填充中间的空白像素
   * 3.5、纵向填充，用两个已有像素的平均值填充中间的空白像素
   * 3.6、是否 2W > W' 且 2H > H'，否责回到 3.2 再来一次，是就进入 3.7
   * 3.7、把生成的高清化结果缩小到 W' x H'
   */
  const applySparseHD = useCallback((targetW: number, targetH: number) => {
    const originalImgUrl = currentImageRef.current;
    if (!originalImgUrl || !imageRef.current) return;
    const img = imageRef.current;
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;
    const origClientW = img.clientWidth;
    const origClientH = img.clientHeight;

    if (targetW <= origW && targetH <= origH) {
      return;
    }

    const box = hdBoxRef.current ? { ...hdBoxRef.current } : { x: 0, y: 0, w: targetW, h: targetH };
    const currentPan = { ...panOffsetRef.current };
    const currentZoom = zoomRef.current;

    // 纯静默重构：绝不触发全局 isLoading，坚决避免画布发生任何模糊、渐变、闪烁或遮罩加载动画
    setIsHdProcessing(true);

    setTimeout(async () => {
      try {
        const resolved = await resolveEffectiveSource();
        const hdSource = resolved ? resolved.source : img;
        const newBase64 = executeSparseHdReconstruction(hdSource, origW, origH, targetW, targetH);

        // 计算物理显示尺寸与画布中心补正，支持单向增宽/增高与等比放大，确保画面不发生跳动
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

        setHdOriginalImage(originalImgUrl);
        setIsComparingOriginal(false);
        setDisplaySize({ width: targetDisplayW, height: targetDisplayH });
        setPanOffset({ x: newPanX, y: newPanY });
        commitBaseEditResult(
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
        setMaskCanvas(null);
        setLastClickPos(null);
        setQuadPoints(null);
        setIsPolyClosed(false);
        setPolyHoverClose(false);
        setPolyMousePos(null);
        setSelectionRegion(null);
        setActiveTool('hd'); // 确保高清工具全程保持激活，绝不退出
        setHdBox({ x: 0, y: 0, w: targetW, h: targetH }); // 全程保持 8 点触控框，并自动贴合放大后的新尺寸，支持后续继续拉大
      } catch (err: any) {
        console.error('[SparseHD Error]', err);
        setErrorMessage(`高清化重构异常: ${err?.message || err}`);
      } finally {
        setIsHdProcessing(false);
      }
    }, 40);
  }, [resolveEffectiveSource, clearGraphicsLayer, commitBaseEditResult, setMaskCanvas, setQuadPoints, setIsPolyClosed, setSelectionRegion]);

  const handleResetOrthoPoints = () => {
    if (!imageRef.current) return;
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;
    const marginX = Math.round(nw * 0.15);
    const marginY = Math.round(nh * 0.15);
    setOrthoPoints([
      { x: marginX, y: marginY },
      { x: nw - marginX, y: marginY },
      { x: nw - marginX, y: nh - marginY },
      { x: marginX, y: nh - marginY },
    ]);
  };

  const handleApplyOrtho = () => {
    if (!orthoPoints || orthoPoints.length !== 4 || !currentImageRef.current) return;
    const targetPoints = orthoPoints.map(p => ({ ...p }));
    setIsLoading(true);
    setTimeout(async () => {
      try {
        const resolved = await resolveEffectiveSource();
        if (!resolved) return;
        const resCanvas = performPerspectiveOrthogonalization(resolved.source, targetPoints);
        const resUrl = resCanvas.toDataURL('image/png');
        commitBaseEditResult(resUrl, "矩形正交化校正", {
          width: resCanvas.width,
          height: resCanvas.height,
        });
        setOrthoPoints(null);
        setActiveTool(null);
      } catch (err: any) {
        console.error('[Ortho Error]', err);
        setErrorMessage(`正交化校正失败: ${err?.message || err}`);
      } finally {
        setIsLoading(false);
        setDraggingOrthoIdx(-1);
        setOrthoMagnifier(null);
      }
    }, 50);
  };

  /**
   * 白化去影净化：基于光照估计除法消除拍摄纸张的不均匀阴影与暗角
   */
  const handleApplyDeShadow = () => {
    if (!currentImageRef.current) return;
    setIsLoading(true);
    setTimeout(async () => {
      try {
        const resolved = await resolveEffectiveSource();
        if (!resolved) return;
        const resCanvas = performDocumentShadowRemoval(resolved.source);
        const resUrl = resCanvas.toDataURL('image/png');
        commitBaseEditResult(resUrl, "纸张白化去影", {
          width: resCanvas.width,
          height: resCanvas.height,
        });
      } catch (err: any) {
        console.error('[DeShadow Error]', err);
        setErrorMessage(`去阴影失败: ${err?.message || err}`);
      } finally {
        setIsLoading(false);
      }
    }, 50);
  };

  const handleApplyQuadCrop = async () => {
    const activeQuad = quadPointsRef.current;
    if (!activeQuad || !currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      const nw = resolved.nw, nh = resolved.nh; canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d'); 
      if (!ctx) return;
      ctx.clearRect(0, 0, nw, nh);
      ctx.beginPath(); ctx.moveTo(activeQuad[0].x, activeQuad[0].y);
      activeQuad.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.clip(); ctx.drawImage(resolved.source, 0, 0);
      const pixels = ctx.getImageData(0, 0, nw, nh);
      const bound = findNonTransparentBounds(pixels.data, nw, nh);
      if (bound) {
        const copy = document.createElement('canvas');
        copy.width = bound.width; copy.height = bound.height; 
        const copyCtx = copy.getContext('2d');
        if (copyCtx) {
          copyCtx.putImageData(ctx.getImageData(bound.left, bound.top, bound.width, bound.height), 0, 0);
          const res = copy.toDataURL('image/png');
          commitBaseEditResult(res, "顶点不规则剪裁");
        }
      }
      setActiveTool(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillSelection = async () => {
    const activeMask = maskCanvasRef.current;
    const activeRegion = selectionRegionRef.current;
    if ((!activeMask && !activeRegion) || !currentImageRef.current) return;
    const resolved = await resolveEffectiveSource();
    if (!resolved) return;
    const canvas = document.createElement('canvas');
    const nw = resolved.nw, nh = resolved.nh; canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.clearRect(0, 0, nw, nh);
    ctx.drawImage(resolved.source, 0, 0);
    const imgDataObj = ctx.getImageData(0, 0, nw, nh); const imgData = imgDataObj.data;
    const colorHex = fillColorRef.current;
    const r = parseInt(colorHex.slice(1, 3), 16), g = parseInt(colorHex.slice(3, 5), 16), b = parseInt(colorHex.slice(5, 7), 16);
    if (activeMask) { 
      const maskData = activeMask.getContext('2d')?.getImageData(0, 0, nw, nh).data; 
      if (maskData) {
        for (let i = 0; i < maskData.length; i += 4) { 
          if (maskData[i + 3] > 0) { imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; } 
        }
      }
    } else if (activeRegion) { 
      for (let y = 0; y < nh; y++) { 
        for (let x = 0; x < nw; x++) { 
          if (isInsideLockedRegion(x, y, activeRegion, isRegionInvertedRef.current)) { 
            const i = (y * nw + x) * 4; imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; 
          } 
        } 
      } 
    }
    ctx.putImageData(imgDataObj, 0, 0);
    const res = canvas.toDataURL('image/png');
    commitBaseEditResult(res, `选区着色 (${colorHex})`);
    clearSelection();
  };

  /**
   * 沿着图像有效像素最外层添加指定宽度与颜色的边框
   * 支持底图模式与独立选中图形模式
   */
  const handleApplyBorder = async () => {
    // 1. 若当前选中了独立图形图层，优先为该图形添加边框
    const selId = selectedGraphicIdRef.current;
    if (selId) {
      const g = importedGraphicsRef.current.find((item) => item.id === selId);
      if (g) {
        setIsLoading(true);
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = g.url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const res = await applyOuterBorderToImage(img, {
            borderWidth: borderWidthRef.current,
            borderColor: borderColorRef.current,
          });
          // 补偿扩展 padding，保持图形在画布上的绝对视觉位置与中心点完全不动
          const scaleX = (g.w / (g.naturalWidth || g.w)) || 1;
          const scaleY = (g.h / (g.naturalHeight || g.h)) || 1;
          const nextGraphics = importedGraphicsRef.current.map((item) => {
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
          importedGraphicsRef.current = nextGraphics;
          setImportedGraphics(nextGraphics);

          const rec: HistoryRecord = {
            id: Date.now(),
            prompt: `为图形添加边框 (${borderWidthRef.current}px)`,
            url: currentImageRef.current || '',
            timestamp: new Date().toLocaleTimeString(),
            layerState: {
              graphics: nextGraphics.map((item) => ({ ...item })),
              baseLayerIndex: baseLayerIndexRef.current,
              baseElement: baseElementRef.current ? { ...baseElementRef.current } : null,
            },
          };
          setHistory((prev) => [rec, ...prev]);
          setActiveRecord(rec);
        } catch (err: any) {
          console.error('[handleApplyBorder graphic]', err);
          setErrorMessage(String(err?.message || err));
        } finally {
          setIsLoading(false);
        }
        return;
      }
    }

    // 2. 否则对底图的有效像素最外层添加边框
    if (!currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;

      const res = await applyOuterBorderToImage(resolved.source, {
        borderWidth: borderWidthRef.current,
        borderColor: borderColorRef.current,
      });

      // 若为完整容纳向外延展的边框而扩展了底图尺寸，同步平移已有独立图形层与 baseElement
      if (res.padLeft > 0 || res.padTop > 0) {
        if (baseElementRef.current) {
          baseElementRef.current = {
            ...baseElementRef.current,
            x: baseElementRef.current.x + res.padLeft,
            y: baseElementRef.current.y + res.padTop,
          };
        }
        if (importedGraphicsRef.current.length > 0) {
          const shiftedGraphics = importedGraphicsRef.current.map((g) => ({
            ...g,
            x: g.x + res.padLeft,
            y: g.y + res.padTop,
          }));
          importedGraphicsRef.current = shiftedGraphics;
          setImportedGraphics(shiftedGraphics);
        }
      }

      commitBaseEditResult(res.dataUrl, `添加有效像素边框 (${borderWidthRef.current}px)`);
    } catch (err: any) {
      console.error('[handleApplyBorder base]', err);
      setErrorMessage(String(err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCropSelection = async () => {
    const activeMask = maskCanvasRef.current;
    const activeRegion = selectionRegionRef.current;
    const activeQuad = quadPointsRef.current;
    const activePolyClosed = isPolyClosedRef.current;
    if (!currentImageRef.current || !(activeMask || activeRegion || (activeQuad && activePolyClosed))) return;

    // 1. 矩形选区剪裁
    if (activeRegion?.type === 'rect') {
      await commitFinalCrop();
      return;
    }

    // 2. 多边范围或套索选区剪裁
    const pts = (activeQuad && activePolyClosed) ? activeQuad : (activeRegion?.type === 'path' ? (activeRegion.data as Point[]) : null);
    if (pts && pts.length >= 3) {
      setIsLoading(true);
      try {
        const resolved = await resolveEffectiveSource();
        if (!resolved) return;
        const nw = resolved.nw, nh = resolved.nh;
        const canvas = document.createElement('canvas');
        canvas.width = nw; canvas.height = nh;
        const ctx = canvas.getContext('2d'); 
        if (!ctx) return;
        ctx.clearRect(0, 0, nw, nh);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(resolved.source, 0, 0);

        const pixels = ctx.getImageData(0, 0, nw, nh);
        const bound = findNonTransparentBounds(pixels.data, nw, nh);
        if (bound) {
          const copy = document.createElement('canvas');
          copy.width = bound.width; copy.height = bound.height; 
          const copyCtx = copy.getContext('2d');
          if (copyCtx) {
            copyCtx.putImageData(ctx.getImageData(bound.left, bound.top, bound.width, bound.height), 0, 0);
            const res = copy.toDataURL('image/png');
            commitBaseEditResult(res, "按选区剪裁");
          }
        }
        clearSelection();
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 3. 魔棒蒙版剪裁
    if (activeMask) {
      setIsLoading(true);
      try {
        const resolved = await resolveEffectiveSource();
        if (!resolved) return;
        const nw = resolved.nw, nh = resolved.nh;
        const maskCtx = activeMask.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, nw, nh).data;
          let bound = { top: null as number | null, left: null as number | null, right: null as number | null, bottom: null as number | null };
          for (let i = 0; i < maskData.length; i += 4) {
            if (maskData[i + 3] > 0) {
              const x = (i / 4) % nw, y = Math.floor((i / 4) / nw);
              if (bound.top === null || y < bound.top) bound.top = y;
              if (bound.left === null || x < bound.left) bound.left = x;
              if (bound.right === null || x > bound.right) bound.right = x;
              if (bound.bottom === null || y > bound.bottom) bound.bottom = y;
            }
          }
          if (bound.top !== null && bound.left !== null && bound.right !== null && bound.bottom !== null) {
            const canvas = document.createElement('canvas');
            const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
            canvas.width = tw; canvas.height = th;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, tw, th);
              ctx.drawImage(resolved.source, bound.left, bound.top, tw, th, 0, 0, tw, th);
              const res = canvas.toDataURL('image/png');
              commitBaseEditResult(res, "魔棒选区剪裁");
            }
          }
        }
        clearSelection();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCropTransparency = async () => {
    if (!currentImageRef.current) return;
    const resolved = await resolveEffectiveSource();
    if (!resolved) return;
    const canvas = document.createElement('canvas');
    canvas.width = resolved.nw; canvas.height = resolved.nh;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    ctx.drawImage(resolved.source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bound = findNonTransparentBounds(pixels.data, canvas.width, canvas.height);
    if (bound) {
      setSelectionRegion({ type: 'rect', data: { x: bound.left, y: bound.top, w: bound.width, h: bound.height } });
      setActiveTool('rect'); 
    }
  };

  /**
   * 智能寻角：非 AI 方案自动识别画面中矩形物体的 4 个推荐顶点并进入正交编辑模式
   * (交互模式与智能修边点击后进入剪裁模式保持一致)
   */
  const handleAutoDetectOrtho = async () => {
    if (!currentImageRef.current) return;
    try {
      const resolved = await resolveEffectiveSource();
      const targetSource = resolved ? resolved.source : imageRef.current;
      if (!targetSource) return;
      const { points, isAutoDetected } = detectOrthoQuadCorners(targetSource);
      setOrthoPoints(points);
      setActiveTool('ortho');
      if (!isAutoDetected) {
        console.log('[TiamoImageEditor] 未检测到显著四边形边缘，已应用默认推荐四角顶点');
      }
    } catch (err) {
      console.warn('[TiamoImageEditor] 自动寻角异常，应用默认推荐顶点:', err);
      if (imageRef.current) {
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        const mx = Math.round(nw * 0.15);
        const my = Math.round(nh * 0.15);
        setOrthoPoints([
          { x: mx, y: my },
          { x: nw - mx, y: my },
          { x: nw - mx, y: nh - my },
          { x: mx, y: nh - my },
        ]);
        setActiveTool('ortho');
      }
    }
  };

  const commitFinalCrop = async () => {
    const activeRegion = selectionRegionRef.current;
    if (!activeRegion || activeRegion.type !== 'rect' || !currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const r = activeRegion.data; const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, r.w); canvas.height = Math.max(1, r.h);
      const ctx = canvas.getContext('2d'); 
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(resolved.source, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      const res = canvas.toDataURL('image/png');
      commitBaseEditResult(res, "精细选区裁剪");
      setSelectionRegion(null); setActiveTool(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvertSelection = () => {
    const activeMask = maskCanvasRef.current;
    if (!activeMask) return;
    const ctx = activeMask.getContext('2d'); 
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, activeMask.width, activeMask.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 0) data[i + 3] = 0; else { data[i]=255; data[i+1]=255; data[i+2]=0; data[i+3]=180; } }
    const newCanvas = document.createElement('canvas'); newCanvas.width = activeMask.width; newCanvas.height = activeMask.height;
    newCanvas.getContext('2d')?.putImageData(imageData, 0, 0); setMaskCanvas(newCanvas);
  };

  // 执行单独去色边滤镜
  const applyDeSpillGreen = async () => {
    if (!currentImageRef.current) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const canvas = document.createElement('canvas');
      canvas.width = resolved.nw;
      canvas.height = resolved.nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(resolved.source, 0, 0);

      const imgDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgDataObj.data;
      const activeMask = maskCanvasRef.current;
      const modified = activeMask
        ? processLocalDeSpill(
            data,
            canvas.width,
            canvas.height,
            activeMask.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data || new Uint8ClampedArray(canvas.width * canvas.height * 4),
            sampledColorRef.current,
            toleranceRef.current,
            spillRadiusRef.current
          )
        : processUniversalDeSpill(data, sampledColorRef.current, toleranceRef.current);

      if (modified) {
        ctx.putImageData(imgDataObj, 0, 0);
        const res = canvas.toDataURL('image/png');
        const curSampled = sampledColorRef.current;
        const colorDesc = curSampled ? `rgb(${curSampled.r},${curSampled.g},${curSampled.b})` : "背景色";
        commitBaseEditResult(res, `智能去色边 (${colorDesc})`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 选区擦除为透明：
   * 1. 支持魔棒选色蒙版 (maskCanvas)
   * 2. 支持矩形框选 (selectionRegion.type === 'rect')
   * 3. 支持套索手绘框选 (selectionRegion.type === 'path')
   * 4. 支持多边形框选 (quadPoints && isPolyClosed)
   * 5. 适配反选状态 (isRegionInverted)
   * 将选区内的对应区域 Alpha 通道置为 0，变为透明背景。
   */
  const handleEraseSelection = async () => {
    const activeMask = maskCanvasRef.current;
    const activeRegion = selectionRegionRef.current;
    const activeQuad = quadPointsRef.current;
    const activePolyClosed = isPolyClosedRef.current;
    const hasActiveSelection = !!(activeMask || activeRegion || (activeQuad && activePolyClosed));
    if (!currentImageRef.current || !hasActiveSelection) return;
    setIsLoading(true);
    try {
      const resolved = await resolveEffectiveSource();
      if (!resolved) return;
      const nw = resolved.nw;
      const nh = resolved.nh;
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 清空离屏画布并绘制当前底图画面
      ctx.clearRect(0, 0, nw, nh);
      ctx.drawImage(resolved.source, 0, 0);
      let modified = false;

      // 1. 魔棒蒙版擦除（RGBA 全置 0，确保无色边与完整透明通道）
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
          const imgDataObj = ctx.getImageData(0, 0, nw, nh);
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

          // 方案A智能去溢色：遵循设定的边缘影响范围 (spillRadius)，避免影响全图
          if (spillRadiusRef.current > 0) {
            processLocalDeSpill(
              data,
              nw,
              nh,
              maskData,
              sampledColorRef.current,
              toleranceRef.current,
              spillRadiusRef.current
            );
          }
          ctx.putImageData(imgDataObj, 0, 0);
        }
      }

      // 2. 矩形选区擦除
      const inverted = isRegionInvertedRef.current;
      if (activeRegion?.type === 'rect') {
        const r = activeRegion.data;
        if (!inverted) {
          // 正选：直接清空矩形内部
          ctx.clearRect(r.x, r.y, r.w, r.h);
          modified = true;
        } else {
          // 反选：清空矩形外部
          ctx.clearRect(0, 0, nw, r.y);
          ctx.clearRect(0, r.y + r.h, nw, nh - (r.y + r.h));
          ctx.clearRect(0, r.y, r.x, r.h);
          ctx.clearRect(r.x + r.w, r.y, nw - (r.x + r.w), r.h);
          modified = true;
        }
      }

      // 3. 套索或多边形路径选区擦除
      const pts = (activeQuad && activePolyClosed)
        ? activeQuad
        : (activeRegion?.type === 'path' ? (activeRegion.data as Point[]) : null);

      if (pts && pts.length >= 3) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();

        if (!inverted) {
          // 正选：清空多边形内部
          ctx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((p, idx) => { if (idx > 0) ctx.lineTo(p.x, p.y); });
          ctx.closePath();
          ctx.fillStyle = '#000000';
          ctx.fill();
        } else {
          // 反选：清空多边形外部 (evenodd 绕数)
          ctx.rect(0, 0, nw, nh);
          ctx.moveTo(pts[0].x, pts[0].y);
          pts.forEach((p, idx) => { if (idx > 0) ctx.lineTo(p.x, p.y); });
          ctx.closePath();
          ctx.fillStyle = '#000000';
          ctx.fill('evenodd');
        }
        ctx.restore();
        modified = true;
      }

      if (modified) {
        const res = canvas.toDataURL('image/png');
        commitBaseEditResult(res, "选区擦除透明");
      }

      clearSelection();
      resetWand();
    } finally {
      setIsLoading(false);
    }
  };

  const applyWandCutout = handleEraseSelection;

  const executeEdit = async () => {
    const latestImage = currentImageRef.current;
    if (!latestImage || !prompt.trim()) return;
    setIsLoading(true); setErrorMessage(null); setShowConfirmModal(false);
    try {
      const hadGraphics = importedGraphicsRef.current.length > 0;
      let inputBase64Data = latestImage.includes(',') ? latestImage.split(',')[1] : '';
      if (hadGraphics || !inputBase64Data) {
        const resolved = await resolveEffectiveSource();
        if (resolved) {
          if (hadGraphics) {
            const compCanvas = await compositeGraphicsToCanvas(resolved.source, importedGraphicsRef.current, baseLayerIndexRef.current);
            inputBase64Data = compCanvas.toDataURL('image/png').split(',')[1];
          } else {
            const rawCanvas = document.createElement('canvas');
            rawCanvas.width = resolved.nw;
            rawCanvas.height = resolved.nh;
            const rawCtx = rawCanvas.getContext('2d');
            if (rawCtx) {
              rawCtx.drawImage(resolved.source, 0, 0);
              inputBase64Data = rawCanvas.toDataURL('image/png').split(',')[1];
            }
          }
        }
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${effectiveApiKey}`;
      const payload = { contents: [{ parts: [{ text: `Modify: ${prompt}. Consistent style. Removed parts alpha=0.` }, { inlineData: { mimeType: "image/png", data: inputBase64Data } }]}], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const base64Data = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (base64Data) {
        const res = `data:image/png;base64,${base64Data}`;
        commitBaseEditResult(res, prompt);
        setPrompt("");
        if (hadGraphics) clearGraphicsLayer();
      } 
      else throw new Error(result.error?.message || "无图像生成");
    } catch (err: any) { setErrorMessage(String(err.message || err)); } finally { setIsLoading(false); }
  };

  const handleEditClick = () => { if (history.length > 0 && activeRecord?.id !== history[0]?.id) setShowConfirmModal(true); else executeEdit(); };

  // 构建 32 位 RGBA 无损透明 PNG 导出快照（同步读取 currentImageRef.current，并另存分层状态缓存）
  const buildExportSnapshot = useCallback(async () => {
    const latestImage = currentImageRef.current;
    if (!latestImage) throw new Error("没有可导出的图像");

    const state = getLayerState();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = latestImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = importedGraphicsRef.current.length > 0
      ? await compositeGraphicsToCanvas(img, importedGraphicsRef.current, baseLayerIndexRef.current)
      : (() => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width;
          c.height = img.naturalHeight || img.height;
          const ctx = c.getContext('2d');
          if (!ctx) throw new Error("无法创建画布上下文");
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0);
          return c;
        })();

    const base64 = canvas.toDataURL('image/png');
    saveLayerStateToCache(base64, state);
    if (onSaveStateRef.current) {
      onSaveStateRef.current(state);
    }

    return { canvas, base64, state };
  }, [getLayerState]);

  // 导出图像为 Blob / Base64 / Canvas（导出预览成片的同时保留当前未融合图层，并将独立分层状态另存缓存并触发 onSaveState）
  const exportResult = useCallback(async (outputType: 'blob' | 'base64' | 'canvas' = 'blob'): Promise<any> => {
    const { canvas, base64 } = await buildExportSnapshot();

    if (outputType === 'canvas') return canvas;
    if (outputType === 'base64') return base64;

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("转换为 Blob 失败"));
      }, 'image/png');
    });
  }, [buildExportSnapshot]);

  // SDK 完成动作（保持未融合分层数据并在图片之外输出 state，以便下次编辑直接继承）
  const handleFinish = async () => {
    if (!currentImageRef.current) {
      if (onCancelRef.current) onCancelRef.current();
      return;
    }
    const { canvas, base64, state } = await buildExportSnapshot();

    canvas.toBlob((blob) => {
      if (!blob) {
        const msg = '导出图像转换为 Blob 失败';
        console.error('[TiamoImageEditor handleFinish]', msg);
        setErrorMessage(msg);
        return;
      }
      if (onCompleteRef.current) {
        onCompleteRef.current({ blob, base64, canvas, state });
      }
    }, 'image/png');
  };

  const handleCancel = () => {
    if (onCancelRef.current) onCancelRef.current();
  };

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
    deSpillGreen,
    setDeSpillGreen,
    spillRadius,
    setSpillRadius,
    applyDeSpillGreen,
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

  // 全模式统一挂载活跃核心实例供宿主调用 (modal / toolbar / distributed)
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
