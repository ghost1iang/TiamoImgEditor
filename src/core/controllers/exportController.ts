import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { EditorLayerState, ImportedGraphic } from '../algorithms/graphicLayer';
import { compositeGraphicsToCanvas, saveLayerStateToCache } from '../algorithms/graphicLayer';
import type { HistoryRecord } from '../useImageEditorCore';

export interface ExportControllerContext {
  currentImageRef: MutableRefObject<string | null>;
  importedGraphicsRef: MutableRefObject<ImportedGraphic[]>;
  baseLayerIndexRef: MutableRefObject<number>;
  prompt: string;
  setPrompt: (p: string) => void;
  effectiveApiKey: string | null;
  history: HistoryRecord[];
  activeRecord: HistoryRecord | null;
  setIsLoading: (val: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setShowConfirmModal: (val: boolean) => void;
  clearGraphicsLayer: () => void;
  getLayerState: () => EditorLayerState;
  resolveEffectiveSource: () => Promise<{ source: HTMLImageElement; nw: number; nh: number } | null>;
  commitBaseEditResult: (url: string, prompt: string) => HistoryRecord;
  onSaveStateRef: MutableRefObject<((state: EditorLayerState) => void) | undefined>;
  onCompleteRef: MutableRefObject<
    | ((result: {
        blob: Blob;
        base64: string;
        canvas: HTMLCanvasElement;
        state: EditorLayerState;
      }) => void)
    | undefined
  >;
}

export function createExportController(ctx: ExportControllerContext) {
  const executeEdit = async () => {
    const latestImage = ctx.currentImageRef.current;
    if (!latestImage || !ctx.prompt.trim()) return;
    if (!ctx.effectiveApiKey) {
      ctx.setErrorMessage('未配置有效的 Gemini API Key，请在宿主配置注入或在工作台设置中提供');
      return;
    }
    ctx.setIsLoading(true);
    ctx.setErrorMessage(null);
    ctx.setShowConfirmModal(false);
    try {
      const hadGraphics = ctx.importedGraphicsRef.current.length > 0;
      let inputBase64Data = latestImage.includes(',') ? latestImage.split(',')[1] : '';
      if (hadGraphics || !inputBase64Data) {
        const resolved = await ctx.resolveEffectiveSource();
        if (resolved) {
          if (hadGraphics) {
            const compCanvas = await compositeGraphicsToCanvas(
              resolved.source,
              ctx.importedGraphicsRef.current,
              ctx.baseLayerIndexRef.current
            );
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${ctx.effectiveApiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: `Modify: ${ctx.prompt}. Consistent style. Removed parts alpha=0.` },
              { inlineData: { mimeType: 'image/png', data: inputBase64Data } },
            ],
          },
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      const base64Data = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      if (base64Data) {
        const res = `data:image/png;base64,${base64Data}`;
        ctx.commitBaseEditResult(res, ctx.prompt);
        ctx.setPrompt('');
        if (hadGraphics) ctx.clearGraphicsLayer();
      } else {
        throw new Error(result.error?.message || '无图像生成');
      }
    } catch (err: any) {
      ctx.setErrorMessage(String(err.message || err));
    } finally {
      ctx.setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    if (ctx.history.length > 0 && ctx.activeRecord?.id !== ctx.history[0]?.id) {
      ctx.setShowConfirmModal(true);
    } else {
      executeEdit();
    }
  };

  const buildExportSnapshot = async () => {
    const latestImage = ctx.currentImageRef.current;
    if (!latestImage) throw new Error('没有可导出的图像');

    const state = ctx.getLayerState();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = latestImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas =
      ctx.importedGraphicsRef.current.length > 0
        ? await compositeGraphicsToCanvas(img, ctx.importedGraphicsRef.current, ctx.baseLayerIndexRef.current)
        : (() => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth || img.width;
            c.height = img.naturalHeight || img.height;
            const canvasCtx = c.getContext('2d');
            if (!canvasCtx) throw new Error('无法创建画布上下文');
            canvasCtx.clearRect(0, 0, c.width, c.height);
            canvasCtx.drawImage(img, 0, 0);
            return c;
          })();

    const base64 = canvas.toDataURL('image/png');
    saveLayerStateToCache(base64, state);
    if (ctx.onSaveStateRef.current) {
      ctx.onSaveStateRef.current(state);
    }

    return { canvas, base64, state };
  };

  const exportResult = async (outputType: 'blob' | 'base64' | 'canvas' = 'blob'): Promise<any> => {
    const { canvas, base64 } = await buildExportSnapshot();
    if (outputType === 'canvas') return canvas;
    if (outputType === 'base64') return base64;

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('转换为 Blob 失败'));
      }, 'image/png');
    });
  };

  const handleFinish = async () => {
    try {
      const { blob, base64, canvas, state } = await (async () => {
        const { canvas, base64, state } = await buildExportSnapshot();
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('转换为 Blob 失败'));
          }, 'image/png');
        });
        return { blob, base64, canvas, state };
      })();

      if (ctx.onCompleteRef.current) {
        ctx.onCompleteRef.current({ blob, base64, canvas, state });
      }
    } catch (err: any) {
      console.error('[TiamoImageEditor handleFinish]', err);
      ctx.setErrorMessage(`完成导出失败: ${err?.message || err}`);
    }
  };

  return {
    executeEdit,
    handleEditClick,
    buildExportSnapshot,
    exportResult,
    handleFinish,
  };
}
