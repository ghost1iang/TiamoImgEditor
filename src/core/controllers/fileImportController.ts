import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditorLayerState } from '../algorithms/graphicLayer';
import { findCachedLayerState } from '../algorithms/graphicLayer';
import type { HistoryRecord } from '../useImageEditorCore';
import type { SelectionRegion } from '../../types/canvas';

export interface FileImportControllerContext {
  setIsLoading: (val: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  loadLayerState: (state: string | EditorLayerState) => boolean;
  setCurrentImage: (url: string) => void;
  setActiveRecord: (rec: HistoryRecord) => void;
  setHistory: Dispatch<SetStateAction<HistoryRecord[]>>;
  setPrompt: (p: string) => void;
  resetWand: () => void;
  resetView: () => void;
  clearGraphicsLayer: () => void;
  setHdOriginalImage: (url: string | null) => void;
  setIsComparingOriginal: (val: boolean) => void;
  setSelectionRegion: (r: SelectionRegion | null) => void;
  setIsRegionInverted: (val: boolean) => void;
  setRotationAngle: (angle: number) => void;
}

export function createFileImportController(ctx: FileImportControllerContext) {
  const processFile = (file: File) => {
    if (!file) return;

    const isJsonState = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (isJsonState) {
      ctx.setIsLoading(true);
      ctx.setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string' && ctx.loadLayerState(text)) {
          ctx.setIsLoading(false);
          return;
        }
        ctx.setErrorMessage('错误: 无效的图层状态文件（请确认是 TiamoImageEditor 导出的 .layers.json）');
        ctx.setIsLoading(false);
      };
      reader.onerror = () => {
        ctx.setErrorMessage('错误: 读取图层状态文件失败');
        ctx.setIsLoading(false);
      };
      reader.readAsText(file);
      return;
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (isPDF) {
      if (!(window as any).pdfjsLib) {
        ctx.setErrorMessage('错误: PDF 解析引擎仍在加载中，请稍后再试');
        return;
      }
      ctx.setIsLoading(true);
      ctx.setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          if (pdf.numPages === 0) throw new Error('该PDF文件不包含任何有效页面');

          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const canvasCtx = canvas.getContext('2d');
          if (!canvasCtx) throw new Error('无法创建画布上下文');

          await page.render({ canvasContext: canvasCtx, viewport }).promise;
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

          ctx.setCurrentImage(base64);
          ctx.setActiveRecord(newRecord);
          ctx.setHistory([newRecord]);
          ctx.setPrompt('');
          ctx.resetWand();
          ctx.resetView();
          ctx.clearGraphicsLayer();
          ctx.setSelectionRegion(null);
          ctx.setIsRegionInverted(false);
          ctx.setRotationAngle(0);
        } catch (err: any) {
          ctx.setErrorMessage('PDF 导入失败: ' + err.message);
        } finally {
          ctx.setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
      ctx.setIsLoading(true);
      ctx.setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const cached = findCachedLayerState(base64);
        if (cached && cached.graphics.length > 0 && ctx.loadLayerState(cached)) {
          ctx.setIsLoading(false);
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
        ctx.setCurrentImage(base64);
        ctx.setActiveRecord(newRecord);
        ctx.setHistory([newRecord]);
        ctx.setPrompt('');
        ctx.resetWand();
        ctx.resetView();
        ctx.clearGraphicsLayer();
        ctx.setSelectionRegion(null);
        ctx.setIsRegionInverted(false);
        ctx.setRotationAngle(0);
        ctx.setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      ctx.setErrorMessage('错误: 不支持的文件格式（请上传图片、PDF 或 .layers.json 状态文件）');
    }
  };

  const loadImageSource = (source: string | Blob | File | HTMLImageElement | HTMLCanvasElement) => {
    if (!source) return;
    if (typeof source === 'string') {
      const cached = findCachedLayerState(source);
      if (cached && cached.graphics.length > 0) {
        ctx.loadLayerState(cached);
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
      ctx.setCurrentImage(source);
      ctx.setActiveRecord(newRecord);
      ctx.setHistory([newRecord]);
      ctx.setPrompt('');
      ctx.resetWand();
      ctx.resetView();
      ctx.clearGraphicsLayer();
      ctx.setHdOriginalImage(null);
      ctx.setIsComparingOriginal(false);
      ctx.setSelectionRegion(null);
      ctx.setIsRegionInverted(false);
      ctx.setRotationAngle(0);
    } else if (source instanceof HTMLImageElement) {
      const attrState = source.dataset?.tiamoLayerState;
      if (attrState && ctx.loadLayerState(attrState)) {
        return;
      }
      loadImageSource(source.src);
    } else if (source instanceof HTMLCanvasElement) {
      loadImageSource(source.toDataURL('image/png'));
    } else if (source instanceof Blob) {
      processFile(source as File);
    }
  };

  return {
    processFile,
    loadImageSource,
  };
}
