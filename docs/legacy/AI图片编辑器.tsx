/**
 * 软件名称：AI图片编辑器 (请勿随意更改)
 * * 版本号规则：
 * 1. 调整前为 BETA x.y，正式发布后切换为 Vx.y
 * 2. 大调整：x + 1（例如架构重构、核心功能变更）
 * 3. 小调整：y + 1（例如 UI 优化、Bug 修复、交互微调）
 * * 当前状态：BETA
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Send, 
  History, 
  Download, 
  RotateCcw, 
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Info,
  Sparkles,
  MousePointer2,
  AlertTriangle,
  X,
  Eye,
  Eraser,
  Crop,
  Check,
  MousePointerClick,
  SlidersHorizontal,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Hand,
  Bug,
  Layers,
  Square,
  SquareSelect,
  XCircle,
  Pencil,
  FlipHorizontal,
  PaintBucket,
  Pipette,
  LandPlot,
  RotateCw
} from 'lucide-react';

const apiKey = ""; // 运行时由环境提供

export default function App() {
  const [currentImage, setCurrentImage] = useState(null);
  const [activeRecord, setActiveRecord] = useState(null); 
  const [history, setHistory] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false); 
  const [showAlphaMask, setShowAlphaMask] = useState(false); 

  // 视口状态
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 工具状态
  const [activeTool, setActiveTool] = useState(null); // 'wand' | 'rect' | 'lasso' | 'pipette' | 'quad' | 'rotate'
  const [selectionMode, setSelectionMode] = useState('global'); 
  const [selectionRegion, setSelectionRegion] = useState(null); 
  const [isRegionInverted, setIsRegionInverted] = useState(false); 
  const [drawingPath, setDrawingPath] = useState([]); 
  const [regionStart, setRegionStart] = useState(null); 
  const [maskCanvas, setMaskCanvas] = useState(null); 
  const maskCanvasRef = useRef(null); 
  const [tolerance, setTolerance] = useState(32); 
  const [lastClickPos, setLastClickPos] = useState(null); 
  const [fillColor, setFillColor] = useState("#3b82f6"); 

  // 变换状态
  const [quadPoints, setQuadPoints] = useState(null); 
  const [draggingPointIdx, setDraggingPointIdx] = useState(-1); 
  const [rotationAngle, setRotationAngle] = useState(0); // 预览角度
  const dragStartData = useRef(null); 
  
  const imageRef = useRef(null);
  const displayMaskRef = useRef(null);

  // 当前版本号：BETA 0.52 (功能升级：支持导入 PDF 文件并将其转换为高分辨率编辑图片)
  const version = "BETA 0.52";

  // 动态加载 PDF.js 库
  useEffect(() => {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.async = true;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // 处理文件上传（支持图片和 PDF）
  const processFile = (file) => {
    if (!file) return;
    
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      if (!window.pdfjsLib) {
        setErrorMessage("错误: PDF 解析引擎仍在加载中，请稍后再试");
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
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
          
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          const base64 = canvas.toDataURL('image/png');
          
          const newRecord = { 
            id: Date.now(), 
            url: base64, 
            prompt: `导入PDF第1页: ${file.name}`, 
            timestamp: new Date().toLocaleTimeString() 
          };
          
          setCurrentImage(base64); 
          setActiveRecord(newRecord); 
          setHistory([newRecord]);
          setPrompt(""); 
          resetWand(); 
          resetView(); 
          setSelectionRegion(null); 
          setIsRegionInverted(false); 
          setRotationAngle(0);
        } catch (err) {
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
        const base64 = event.target.result;
        const newRecord = { 
          id: Date.now(), 
          url: base64, 
          prompt: `导入图片: ${file.name}`, 
          timestamp: new Date().toLocaleTimeString() 
        };
        setCurrentImage(base64); 
        setActiveRecord(newRecord); 
        setHistory([newRecord]);
        setPrompt(""); 
        resetWand(); 
        resetView(); 
        setSelectionRegion(null); 
        setIsRegionInverted(false); 
        setRotationAngle(0);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage("错误: 不支持的文件格式（请上传图片或 PDF）");
    }
  };

  const handleUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  useEffect(() => {
    if (activeTool === 'quad' && currentImage && imageRef.current && !quadPoints) {
      const w = imageRef.current.naturalWidth;
      const h = imageRef.current.naturalHeight;
      setQuadPoints([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]);
    } else if (activeTool !== 'quad') {
      setQuadPoints(null);
    }
  }, [activeTool, currentImage]);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.code === 'Space' && !isLoading) setSpacePressed(true); };
    const handleKeyUp = (e) => { if (e.code === 'Space') setSpacePressed(false); };
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(maskCanvas, 0, 0);
    } else if (!maskCanvas && displayMaskRef.current) {
        const ctx = displayMaskRef.current.getContext('2d');
        ctx.clearRect(0, 0, displayMaskRef.current.width, displayMaskRef.current.height);
    }
  }, [maskCanvas]);

  const isInsideLockedRegion = (x, y, region) => {
    if (!region) return true;
    let inside = false;
    if (region.type === 'rect') {
        const r = region.data;
        inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    } else if (region.type === 'path') {
        const path = region.data;
        if (path.length < 3) return true;
        for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
            const xi = path[i].x, yi = path[i].y;
            const xj = path[j].x, yj = path[j].y;
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
    }
    return isRegionInverted ? !inside : inside;
  };

  const computeSelection = useCallback((startX, startY, currentTolerance, mode, region, isAdding) => {
    if (!currentImage || !imageRef.current) return;
    const img = imageRef.current;
    if (!img.complete || img.naturalWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data; const { width, height } = canvas;
    const targetIdx = (startY * width + startX) * 4;
    const [targetR, targetG, targetB, targetA] = [data[targetIdx], data[targetIdx+1], data[targetIdx+2], data[targetIdx+3]];
    const mCanvas = document.createElement('canvas'); mCanvas.width = width; mCanvas.height = height;
    const mCtx = mCanvas.getContext('2d');
    if (isAdding && maskCanvasRef.current) mCtx.drawImage(maskCanvasRef.current, 0, 0);
    const mImageData = mCtx.getImageData(0, 0, width, height);
    const mData = mImageData.data; const tolSq = currentTolerance * currentTolerance;
    let hasSelected = false;
    const isSimilar = (idx) => {
      const dr = data[idx] - targetR, dg = data[idx+1] - targetG, db = data[idx+2] - targetB, da = data[idx+3] - targetA;
      return (dr*dr + dg*dg + db*db + da*da) < tolSq;
    };
    if (mode === 'global') {
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width, y = Math.floor((i / 4) / width);
        if (isSimilar(i) && isInsideLockedRegion(x, y, region)) {
          mData[i] = 255; mData[i+1] = 255; mData[i+2] = 0; mData[i+3] = 180; hasSelected = true;
        }
      }
    } else {
      if (!isInsideLockedRegion(startX, startY, region)) return;
      const visited = new Uint8Array(width * height); const stack = [[startX, startY]];
      visited[startY * width + startX] = 1;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop(); const pIdx = (cy * width + cx) * 4;
        mData[pIdx] = 255; mData[pIdx+1] = 255; mData[pIdx+2] = 0; mData[pIdx+3] = 180; hasSelected = true;
        const neighbors = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!visited[nIdx] && isSimilar(nIdx * 4) && isInsideLockedRegion(nx, ny, region)) {
              visited[nIdx] = 1; stack.push([nx, ny]);
            }
          }
        }
      }
    }
    if (hasSelected || isAdding) { mCtx.putImageData(mImageData, 0, 0); setMaskCanvas(mCanvas); } 
    else setMaskCanvas(null);
  }, [currentImage, isRegionInverted]); 

  useEffect(() => {
    if (activeTool === 'wand' && lastClickPos) {
      computeSelection(lastClickPos.x, lastClickPos.y, tolerance, selectionMode, selectionRegion, lastClickPos.isAdding);
    }
  }, [tolerance, activeTool, lastClickPos, selectionMode, selectionRegion, isRegionInverted, computeSelection]); 

  const handleMouseDown = (e) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isAdding = e.metaKey || e.ctrlKey;

    if (e.button !== 0 || spacePressed || !activeTool) {
      e.preventDefault(); setIsPanning(true); lastMousePos.current = { x: e.clientX, y: e.clientY }; return;
    }

    const nw = imageRef.current.naturalWidth, nh = imageRef.current.naturalHeight;
    const imgX = Math.max(0, Math.min(nw, Math.floor(((e.clientX - rect.left) / rect.width) * nw)));
    const imgY = Math.max(0, Math.min(nh, Math.floor(((e.clientY - rect.top) / rect.height) * nh)));

    if (activeTool === 'quad' && quadPoints) {
      const thr = 20 / zoom;
      const idx = quadPoints.findIndex(p => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
      if (idx !== -1) { setDraggingPointIdx(idx); dragStartData.current = { x: quadPoints[idx].x, y: quadPoints[idx].y }; return; }
    }
    if (activeTool === 'rect' && selectionRegion?.type === 'rect') {
      const r = selectionRegion.data; const thr = 20 / zoom; let hitIdx = -1;
      if (Math.abs(r.x - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 0;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 1;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 2;
      else if (Math.abs(r.x - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 3;
      if (hitIdx !== -1) { setDraggingPointIdx(hitIdx); dragStartData.current = { ...r }; return; }
    }
    if (activeTool === 'pipette') {
      const canvas = document.createElement('canvas'); canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d'); ctx.drawImage(imageRef.current, 0, 0);
      const pixel = ctx.getImageData(Math.min(nw-1, imgX), Math.min(nh-1, imgY), 1, 1).data;
      setFillColor("#" + Array.from(pixel.slice(0, 3)).map(x => x.toString(16).padStart(2, '0')).join(''));
      setActiveTool(null); return;
    }
    if (activeTool === 'rect') {
      setRegionStart({ x: imgX, y: imgY });
      setSelectionRegion({ type: 'rect', data: { x: imgX, y: imgY, w: 0, h: 0 } });
    } else if (activeTool === 'lasso') {
      setDrawingPath([{ x: imgX, y: imgY }]);
    } else if (activeTool === 'wand') {
      setLastClickPos({ x: imgX, y: imgY, isAdding });
      computeSelection(imgX, imgY, tolerance, selectionMode, selectionRegion, isAdding);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x, dy = e.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY }; return;
    }
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const nw = imageRef.current.naturalWidth, nh = imageRef.current.naturalHeight;
    const imgX = Math.max(0, Math.min(nw, Math.floor(((e.clientX - rect.left) / rect.width) * nw)));
    const imgY = Math.max(0, Math.min(nh, Math.floor(((e.clientY - rect.top) / rect.height) * nh)));

    if (activeTool === 'quad' && draggingPointIdx !== -1) {
      let fx = imgX, fy = imgY;
      if ((e.metaKey || e.ctrlKey) && dragStartData.current) {
        if (Math.abs(imgX - dragStartData.current.x) > Math.abs(imgY - dragStartData.current.y)) fy = dragStartData.current.y; else fx = dragStartData.current.x;
      }
      setQuadPoints(prev => { const n = [...prev]; n[draggingPointIdx] = { x: fx, y: fy }; return n; }); return;
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
      setSelectionRegion({ type: 'rect', data: r }); return;
    }
    if (!regionStart && drawingPath.length === 0) return;
    if (activeTool === 'rect' && regionStart) {
      const x = Math.min(regionStart.x, imgX), y = Math.min(regionStart.y, imgY);
      const w = Math.abs(regionStart.x - imgX), h = Math.abs(regionStart.y - imgY);
      setSelectionRegion({ type: 'rect', data: { x, y, w, h } });
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      setDrawingPath(prev => [...prev, { x: imgX, y: imgY }]);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false); setDraggingPointIdx(-1); dragStartData.current = null;
    if (activeTool === 'rect' && regionStart) {
      setRegionStart(null); if (selectionRegion && (selectionRegion.data.w < 2 || selectionRegion.data.h < 2)) { setSelectionRegion(null); setActiveTool(null); }
    } else if (activeTool === 'lasso' && drawingPath.length > 0) {
      if (drawingPath.length > 3) setSelectionRegion({ type: 'path', data: drawingPath }); else setSelectionRegion(null);
      setDrawingPath([]); setActiveTool(null);
    }
  };

  // 旋转应用逻辑
  const handleApplyRotation = () => {
    if (!currentImage || !imageRef.current || rotationAngle === 0) return;
    setIsLoading(true);
    const img = imageRef.current;
    const angleRad = (rotationAngle * Math.PI) / 180;
    
    // 计算旋转后的新画布尺寸
    const nw = Math.abs(img.naturalWidth * Math.cos(angleRad)) + Math.abs(img.naturalHeight * Math.sin(angleRad));
    const nh = Math.abs(img.naturalWidth * Math.sin(angleRad)) + Math.abs(img.naturalHeight * Math.cos(angleRad));
    
    const canvas = document.createElement('canvas');
    canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d');
    
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    
    const res = canvas.toDataURL();
    const rec = { id: Date.now(), url: res, prompt: `旋转图像 (${rotationAngle}°)`, timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
    setRotationAngle(0); setActiveTool(null); setIsLoading(false);
  };

  const handleApplyQuadCrop = () => {
    if (!quadPoints || !currentImage || !imageRef.current) return;
    setIsLoading(true);
    const img = imageRef.current; const canvas = document.createElement('canvas');
    const nw = img.naturalWidth, nh = img.naturalHeight; canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d'); ctx.beginPath(); ctx.moveTo(quadPoints[0].x, quadPoints[0].y);
    quadPoints.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, nw, nh); const data = pixels.data;
    let bound = { top: null, left: null, right: null, bottom: null };
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] !== 0) { const x = (i / 4) % nw, y = Math.floor((i / 4) / nw); if (bound.top === null || y < bound.top) bound.top = y; if (bound.left === null || x < bound.left) bound.left = x; if (bound.right === null || x > bound.right) bound.right = x; if (bound.bottom === null || y > bound.bottom) bound.bottom = y; } }
    if (bound.top !== null) {
      const copy = document.createElement('canvas'); const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
      copy.width = tw; copy.height = th; copy.getContext('2d').putImageData(ctx.getImageData(bound.left, bound.top, tw, th), 0, 0);
      const res = copy.toDataURL(); const rec = { id: Date.now(), url: res, prompt: "顶点不规则剪裁", timestamp: new Date().toLocaleTimeString() };
      setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
    }
    setActiveTool(null); setIsLoading(false);
  };

  const handleFillSelection = () => {
    if ((!maskCanvas && !selectionRegion) || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    const nw = img.naturalWidth, nh = img.naturalHeight; canvas.width = nw; canvas.height = nh;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const imgDataObj = ctx.getImageData(0, 0, nw, nh); const imgData = imgDataObj.data;
    const r = parseInt(fillColor.slice(1, 3), 16), g = parseInt(fillColor.slice(3, 5), 16), b = parseInt(fillColor.slice(5, 7), 16);
    if (maskCanvas) { const maskData = maskCanvas.getContext('2d').getImageData(0, 0, nw, nh).data; for (let i = 0; i < maskData.length; i += 4) { if (maskData[i + 3] > 0) { imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; } }
    } else if (selectionRegion) { for (let y = 0; y < nh; y++) { for (let x = 0; x < nw; x++) { if (isInsideLockedRegion(x, y, selectionRegion)) { const i = (y * nw + x) * 4; imgData[i] = r; imgData[i+1] = g; imgData[i+2] = b; imgData[i+3] = 255; } } } }
    ctx.putImageData(imgDataObj, 0, 0); const res = canvas.toDataURL();
    const rec = { id: Date.now(), url: res, prompt: `选区着色 (${fillColor})`, timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); resetWand();
  };

  const handleCropTransparency = () => {
    if (!currentImage || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height); const data = pixels.data;
    let bound = { top: null, left: null, right: null, bottom: null };
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] !== 0) { const x = (i / 4) % canvas.width, y = Math.floor((i / 4) / canvas.width); if (bound.top === null || y < bound.top) bound.top = y; if (bound.left === null || x < bound.left) bound.left = x; if (bound.right === null || x > bound.right) bound.right = x; if (bound.bottom === null || y > bound.bottom) bound.bottom = y; } }
    if (bound.top !== null) {
      const tw = bound.right - bound.left + 1, th = bound.bottom - bound.top + 1;
      setSelectionRegion({ type: 'rect', data: { x: bound.left, y: bound.top, w: tw, h: th } }); setActiveTool('rect'); 
    }
  };

  const commitFinalCrop = () => {
    if (!selectionRegion || selectionRegion.type !== 'rect' || !imageRef.current) return;
    setIsLoading(true); const r = selectionRegion.data; const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, r.w); canvas.height = Math.max(1, r.h);
    const ctx = canvas.getContext('2d'); ctx.drawImage(imageRef.current, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const res = canvas.toDataURL(); const rec = { id: Date.now(), url: res, prompt: "精细选区裁剪", timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec);
    setSelectionRegion(null); setActiveTool(null); setIsLoading(false);
  };

  const handleInvertSelection = () => {
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d'); const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 0) data[i + 3] = 0; else { data[i]=255; data[i+1]=255; data[i+2]=0; data[i+3]=180; } }
    const newCanvas = document.createElement('canvas'); newCanvas.width = maskCanvas.width; newCanvas.height = maskCanvas.height;
    newCanvas.getContext('2d').putImageData(imageData, 0, 0); setMaskCanvas(newCanvas);
  };

  const applyWandCutout = () => {
    if (!maskCanvas || !imageRef.current) return;
    const img = imageRef.current; const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const maskData = maskCanvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const imgDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const imgData = imgDataObj.data;
    for (let i = 0; i < maskData.length; i += 4) { if (maskData[i + 3] > 0) imgData[i + 3] = 0; }
    ctx.putImageData(imgDataObj, 0, 0); const res = canvas.toDataURL();
    const rec = { id: Date.now(), url: res, prompt: "区域擦除", timestamp: new Date().toLocaleTimeString() };
    setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); resetWand();
  };

  const executeEdit = async () => {
    if (!currentImage || !prompt.trim()) return;
    setIsLoading(true); setErrorMessage(null); setShowConfirmModal(false);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: `Modify: ${prompt}. Consistent style. Removed parts alpha=0.` }, { inlineData: { mimeType: "image/png", data: currentImage.split(',')[1] } }]}], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const base64Data = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (base64Data) { const res = `data:image/png;base64,${base64Data}`; const rec = { id: Date.now(), url: res, prompt: prompt, timestamp: new Date().toLocaleTimeString() }; setHistory(prev => [rec, ...prev]); setCurrentImage(res); setActiveRecord(rec); setPrompt(""); } 
      else throw new Error(result.error?.message || "无图像生成");
    } catch (err) { setErrorMessage(String(err.message || err)); } finally { setIsLoading(false); }
  };

  const handleEditClick = () => { if (history.length > 0 && activeRecord?.id !== history[0]?.id) setShowConfirmModal(true); else executeEdit(); };
  const resetWand = () => { setActiveTool(null); setMaskCanvas(null); setLastClickPos(null); };
  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };
  const changeZoom = (delta) => setZoom(prev => Math.max(0.5, Math.min(5, Math.round((prev + delta) * 100) / 100)));
  const hasSelection = !!(maskCanvas || selectionRegion);

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden select-none">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-slate-200 flex flex-col relative overflow-hidden shadow-sm shrink-0`}>
        <div className="p-2 border-b border-slate-100 flex justify-between items-center whitespace-nowrap text-xs leading-none">
          <div className="flex items-center gap-2"><div className="p-1 bg-blue-50 text-blue-600 font-black"><History size={14} /></div><span className="font-bold text-slate-700">编辑历史</span></div>
          <button onClick={() => {setHistory([]); setCurrentImage(null); setActiveRecord(null); setPrompt(""); resetWand();}} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          {history.map((item) => (
            <div key={item.id} onClick={() => {setCurrentImage(item.url); setActiveRecord(item);}} className={`group cursor-pointer border-2 p-1.5 transition-all duration-200 rounded-xl ${activeRecord?.id === item.id ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
              <div className="relative aspect-[4/3] overflow-hidden mb-1 bg-slate-100 border border-slate-200 shadow-inner rounded-lg leading-[0]">
                <img src={item.url} alt="History" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><RotateCcw size={16} className="text-blue-600" /></div>
              </div>
              <p className="px-0.5 text-[9px] font-medium text-slate-500 truncate leading-tight italic">"{item.prompt}"</p>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-[#f1f5f9]">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-slate-200 shadow-sm p-1 text-slate-400 hover:text-blue-600 transition-colors">{sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>

        <header className="h-10 flex items-center justify-between px-2 bg-white/90 backdrop-blur-md border-b border-slate-200 z-30 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 flex items-center justify-center shadow-lg transform rotate-3 shrink-0 rounded-lg"><Sparkles size={12} className="text-white" /></div>
            <div className="hidden sm:block leading-none"><h1 className="text-[11px] font-black text-slate-900 tracking-tight">AI编辑器</h1><span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">{version}</span></div>
          </div>
          
          <div className="flex items-center gap-1 mx-2 overflow-x-auto no-scrollbar max-w-[75%]">
            {currentImage && (
              <>
                <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 gap-0.5 shrink-0 rounded-lg shadow-inner">
                   <button onClick={() => { setActiveTool(activeTool === 'rect' ? null : 'rect'); }} className={`p-1.5 transition-all rounded-md ${activeTool === 'rect' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} title="矩形范围"><Square size={12} /></button>
                  <button onClick={() => { setActiveTool(activeTool === 'lasso' ? null : 'lasso'); }} className={`p-1.5 transition-all rounded-md ${activeTool === 'lasso' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} title="套索范围"><Pencil size={12} /></button>
                  {selectionRegion && (
                    <>
                      <button onClick={() => setIsRegionInverted(!isRegionInverted)} className={`p-1.5 transition-all rounded-md ${isRegionInverted ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} title="反转选区"><FlipHorizontal size={12} /></button>
                      <button onClick={() => {setSelectionRegion(null); setIsRegionInverted(false);}} className="p-1.5 text-red-500 hover:bg-red-50 transition-colors" title="清除选区"><XCircle size={12} /></button>
                    </>
                  )}
                </div>

                <div className="w-px h-3 bg-slate-200 mx-1" />

                <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 gap-0.5 shrink-0 rounded-lg shadow-inner">
                  <button onClick={() => setShowAlphaMask(!showAlphaMask)} className={`p-1.5 rounded-lg transition-all ${showAlphaMask ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`} title="透明检测"><Eye size={12} /></button>
                  <div className="w-px h-3 bg-slate-200 mx-0.5" />
                  <div className="flex items-center gap-1 px-1">
                    <button onClick={() => { setActiveTool(activeTool === 'wand' ? null : 'wand'); }} className={`p-1.5 rounded-md transition-all ${activeTool === 'wand' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-blue-600'}`} title="魔棒选色"><Eraser size={12} /></button>
                    {activeTool === 'wand' && (
                      <div className="flex items-center gap-1.5 px-1 border-l border-slate-200 ml-1 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => setSelectionMode(m => m === 'global' ? 'connected' : 'global')} className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded transition-colors ${selectionMode === 'connected' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{selectionMode === 'global' ? '全屏' : '连通'}</button>
                        <input type="range" min="1" max="255" value={tolerance} onChange={(e) => setTolerance(parseInt(e.target.value))} className="w-16 h-1 bg-slate-200 appearance-none cursor-pointer accent-blue-600 rounded-lg" />
                      </div>
                    )}
                  </div>
                  <div className="w-px h-3 bg-slate-200 mx-0.5" />
                  <button onClick={handleCropTransparency} disabled={isLoading} className={`p-1.5 rounded-lg transition-all ${activeTool === 'rect' && selectionRegion ? 'bg-indigo-100 text-indigo-700 shadow-inner' : 'text-slate-500 hover:bg-white'}`} title="智能修边"><Crop size={12} /></button>
                  <button onClick={() => { setActiveTool(activeTool === 'quad' ? null : 'quad'); }} className={`p-1.5 rounded-lg transition-all ${activeTool === 'quad' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`} title="顶点拉伸"><LandPlot size={12} /></button>
                </div>

                <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 gap-1 shrink-0 rounded-lg shadow-inner ml-1">
                  <div className="relative flex items-center px-1"><input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-5 h-5 border-0 p-0 cursor-pointer opacity-0 absolute inset-0 z-10" /><div className="w-5 h-5 rounded border border-white/50 shadow-sm" style={{ backgroundColor: fillColor }} /></div>
                  <button onClick={() => setActiveTool(activeTool === 'pipette' ? null : 'pipette')} className={`p-1.5 rounded-md transition-all ${activeTool === 'pipette' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-blue-600'}`} title="取色"><Pipette size={12} /></button>
                  <button onClick={handleFillSelection} disabled={!hasSelection} className={`p-1.5 rounded-md transition-all ${hasSelection ? 'text-blue-600 hover:bg-white shadow-sm active:scale-90' : 'text-slate-300 pointer-events-none'}`} title="选区着色"><PaintBucket size={12} /></button>
                </div>

                <div className="w-px h-3 bg-slate-200 mx-1" />

                {/* 旋转变换工具组 */}
                <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 gap-1 shrink-0 rounded-lg shadow-inner">
                   <button onClick={() => setActiveTool(activeTool === 'rotate' ? null : 'rotate')} className={`p-1.5 rounded-md transition-all ${activeTool === 'rotate' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`} title="旋转变换"><RotateCw size={12} /></button>
                   {activeTool === 'rotate' && (
                     <div className="flex items-center gap-1.5 px-1 animate-in fade-in slide-in-from-left-1 duration-200">
                        <input 
                          type="number" value={rotationAngle} onChange={(e) => setRotationAngle(parseInt(e.target.value) || 0)} 
                          className="w-10 h-5 text-[9px] font-black text-center bg-white border border-slate-200 rounded outline-none" 
                          placeholder="deg"
                        />
                        <input 
                          type="range" min="-180" max="180" value={rotationAngle} onChange={(e) => setRotationAngle(parseInt(e.target.value))} 
                          className="w-16 h-1 bg-slate-200 appearance-none cursor-pointer accent-indigo-600 rounded-lg" 
                        />
                        <button onClick={handleApplyRotation} className="p-1 text-indigo-600 hover:bg-white rounded"><Check size={12} /></button>
                     </div>
                   )}
                </div>

                {(activeTool === 'quad' || (activeTool === 'rect' && selectionRegion)) && (
                    <div className="flex items-center gap-1 animate-in slide-in-from-top-1 ml-1">
                         <button onClick={activeTool === 'quad' ? handleApplyQuadCrop : commitFinalCrop} className="px-2 py-1 bg-green-600 text-white text-[9px] font-black shadow active:scale-95 transition-all">确认剪裁</button>
                         <button onClick={() => {setActiveTool(null); setSelectionRegion(null);}} className="p-1 text-slate-400 hover:text-red-500"><X size={12} /></button>
                    </div>
                )}
                
                {maskCanvas && !isLoading && (
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={handleInvertSelection} className="p-1 text-slate-500" title="反选像素"><RefreshCw size={10} /></button>
                    <button onClick={applyWandCutout} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold shadow active:scale-95 transition-all" title="确认擦除"><Check size={10} /></button>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            {currentImage && <button onClick={() => { const l = document.createElement('a'); l.href = currentImage; l.download = 'output.png'; l.click(); }} className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:text-blue-600 transition-colors"><Download size={14} /></button>}
            <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white cursor-pointer font-bold text-[10px] active:scale-95 shrink-0 shadow-md rounded-lg hover:bg-slate-800">
              <Upload size={12} /> <span className="hidden sm:inline">重新上传</span>
              <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        </header>

        <div 
          className={`flex-1 flex flex-col p-2 overflow-hidden relative no-scrollbar ${isPanning || spacePressed ? 'cursor-grabbing' : (activeTool === 'rect' || activeTool === 'lasso' || activeTool === 'pipette' || activeTool === 'quad' ? 'cursor-crosshair' : (activeTool === 'wand' ? 'cursor-cell' : 'cursor-grab'))}`} 
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onContextMenu={(e)=>e.preventDefault()}
          onDragOver={(e)=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={(e)=>{e.preventDefault();setIsDragging(false);processFile(e.dataTransfer.files[0])}}
        >
          {currentImage && (
            <div className="absolute top-4 right-4 z-40 animate-in fade-in slide-in-from-right-2">
              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-2xl p-1.5 flex items-center gap-1 rounded-2xl">
                <button onClick={() => changeZoom(-0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors"><ZoomOut size={12} /></button>
                <button onClick={() => setZoom(1)} className="px-2 text-[10px] font-black text-slate-800 min-w-[36px] text-center">{Math.round(zoom * 100)}%</button>
                <button onClick={() => changeZoom(0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors"><ZoomIn size={12} /></button>
                <div className="w-px h-3 bg-slate-200 mx-0.5" />
                <button onClick={() => {setZoom(1); setPanOffset({x:0, y:0});}} className="p-1 hover:bg-slate-100 text-slate-400" title="重置"><Maximize size={12} /></button>
              </div>
            </div>
          )}

          <div className="min-h-full min-w-full flex items-center justify-center relative transition-all" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}>
            {currentImage && (
              <div 
                className="relative transition-transform duration-200 inline-block pointer-events-none" 
                style={{ transform: `scale(${zoom}) rotate(${rotationAngle}deg)`, transformOrigin: 'center center' }}
              >
                <div className={`relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-4 border-white select-none pointer-events-auto leading-[0] transition-colors ${showAlphaMask ? 'alpha-mask-bg' : 'bg-white/5'}`}>
                  <img ref={imageRef} src={currentImage} alt="Workspace" draggable="false" className={`max-w-none transition-all duration-300 ${isLoading ? 'blur-xl opacity-30' : 'opacity-100'}`} style={{ maxHeight: '70vh' }} />
                  <canvas ref={displayMaskRef} className="absolute inset-0 pointer-events-none w-full h-full" />
                  
                  {drawingPath.length > 1 && imageRef.current && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}><polyline points={drawingPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2/zoom).toString()} strokeDasharray="4 4" /></svg>
                  )}

                  {selectionRegion && imageRef.current && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          {selectionRegion.type === 'rect' ? (
                              <div 
                                className={`absolute border-2 border-blue-500 border-dashed ${isRegionInverted ? 'bg-black/40' : 'shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`} 
                                style={{ left: `${(selectionRegion.data.x / imageRef.current.naturalWidth) * 100}%`, top: `${(selectionRegion.data.y / imageRef.current.naturalHeight) * 100}%`, width: `${(selectionRegion.data.w / imageRef.current.naturalWidth) * 100}%`, height: `${(selectionRegion.data.h / imageRef.current.naturalHeight) * 100}%` }} 
                              >
                                  {(activeTool === 'rect' || activeTool === null) && [0,1,2,3].map(i => (
                                      <div key={i} className="absolute w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-lg z-30 pointer-events-auto cursor-move" style={{ left: i === 1 || i === 2 ? '100%' : '0', top: i === 2 || i === 3 ? '100%' : '0', transform: 'translate(-50%, -50%) scale(' + (1/zoom) + ')' }} />
                                  ))}
                              </div>
                          ) : (
                              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}><defs><mask id="lassoMask"><rect width="100%" height="100%" fill={isRegionInverted ? "black" : "white"} /><polygon points={selectionRegion.data.map(p => `${p.x},${p.y}`).join(' ')} fill={isRegionInverted ? "white" : "black"} /></mask></defs><rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" mask="url(#lassoMask)" /><polygon points={selectionRegion.data.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2/zoom).toString()} strokeDasharray="4 4" /></svg>
                          )}
                      </div>
                  )}

                  {activeTool === 'quad' && quadPoints && imageRef.current && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                          <polygon points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(79, 70, 229, 0.15)" stroke="#4f46e5" strokeWidth={(2/zoom).toString()} />
                          {quadPoints.map((p, i) => (
                              <circle key={i} cx={p.x} cy={p.y} r={(8/zoom).toString()} fill={draggingPointIdx === i ? "#ffffff" : "#4f46e5"} stroke="#ffffff" strokeWidth={(2/zoom).toString()} className="pointer-events-auto cursor-move drop-shadow-md" />
                          ))}
                      </svg>
                  )}
                  {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px]"><Loader2 size={32} className="text-blue-600 animate-spin" /></div>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto bg-white/80 backdrop-blur-md border-t border-slate-200 p-2 shrink-0 z-30">
          <div className="max-w-xl mx-auto flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative group"><div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-500 opacity-40"><MousePointer2 size={12} /></div><input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleEditClick()} disabled={!currentImage || isLoading} placeholder="输入 AI 指令..." className="w-full h-8 bg-[#f1f5f9] border-2 border-transparent focus:bg-white focus:border-blue-500/20 pl-8 pr-3 outline-none transition-all font-semibold text-[10px] text-slate-700 rounded-xl" /></div>
              <button onClick={handleEditClick} disabled={!currentImage || isLoading || !prompt.trim()} className="h-8 px-5 bg-slate-900 text-white flex items-center gap-2 font-black hover:bg-slate-800 disabled:bg-slate-300 transition-all text-[10px] shrink-0 shadow-lg active:scale-95 rounded-xl">{isLoading ? <Loader2 size={10} className="animate-spin" /> : <span>重构</span>}{!isLoading && <Send size={10} />}</button>
            </div>
            {errorMessage && <div className="flex items-start gap-1.5 p-1.5 bg-red-50 border border-red-100 rounded-lg animate-in slide-in-from-bottom-1"><Bug size={10} className="text-red-500 mt-0.5 shrink-0" /><p className="text-[9px] text-red-600 font-bold leading-tight break-all">错误: {errorMessage}</p></div>}
          </div>
        </div>

        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white shadow-xl max-w-xs w-full p-5 border border-slate-100 animate-in zoom-in-95">
              <div className="flex justify-between items-start mb-3 text-slate-900"><div className="w-10 h-10 bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner "><AlertTriangle size={20} /></div><button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button></div>
              <h3 className="text-xs font-black mb-1 text-slate-900 text-center">开启新分支？</h3>
              <p className="text-slate-500 text-[9px] mb-4 text-center px-2">此节点后的历史记录将被覆盖。</p>
              <div className="grid grid-cols-2 gap-3"><button onClick={() => setShowConfirmModal(false)} className="py-2.5 bg-slate-100 text-slate-500 font-black text-[10px] hover:bg-slate-200 rounded-xl">取消</button><button onClick={executeEdit} className="py-2.5 bg-slate-900 text-white font-black text-[10px] hover:bg-slate-800 shadow-lg rounded-xl">确认</button></div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .alpha-mask-bg { background-color: rgba(239, 68, 68, 0.25) !important; background-image: radial-gradient(rgba(239, 68, 68, 0.3) 1px, transparent 0); background-size: 10px 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; border-radius: 999px; height: 10px; width: 10px; background: #2563eb; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}