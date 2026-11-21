import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type React from 'react';
import type { Point, SelectionRegion, RectDragPoints } from '../../types/canvas';
import type {
  GraphicLayer,
  BaseElementTransform,
  EightPointHandleId,
  GraphicDragState,
  ToolType,
} from '../useImageEditorCore';
import {
  computeGraphicMoveWithSnap,
  computeGraphicResizeWithSnap,
} from '../algorithms/graphicLayer';

export interface CanvasPointerControllerContext {
  imageRef: MutableRefObject<HTMLImageElement | null>;
  currentImageRef: MutableRefObject<string | null>;
  selectedGraphicIdRef: MutableRefObject<string | null>;
  importedGraphicsRef: MutableRefObject<GraphicLayer[]>;
  graphicDragStateRef: MutableRefObject<GraphicDragState | null>;
  pendingGraphicDeselectRef: MutableRefObject<{ x: number; y: number } | null>;
  mouseDownOutsideRef: MutableRefObject<{ x: number; y: number } | null>;
  hdDragStartRef: MutableRefObject<{ clientX: number; clientY: number; box: { x: number; y: number; w: number; h: number } } | null>;
  hdBoxRef: MutableRefObject<{ x: number; y: number; w: number; h: number } | null>;
  dragStartData: MutableRefObject<any>;
  lastMousePos: MutableRefObject<{ x: number; y: number }>;
  baseElementRef: MutableRefObject<BaseElementTransform | null>;

  activeTool: ToolType | null;
  spacePressed: boolean;
  zoom: number;
  hdBox: { x: number; y: number; w: number; h: number } | null;
  hdDragHandle: string | null;
  orthoPoints: Point[] | null;
  draggingOrthoIdx: number;
  isPolyClosed: boolean;
  quadPoints: Point[] | null;
  selectionRegion: SelectionRegion | null;
  regionStart: Point | null;
  drawingPath: Point[];
  tolerance: number;
  selectionMode: 'global' | 'connected';
  hasSelection: boolean;
  isPanning: boolean;
  draggingPointIdx: number;

  setSelectedGraphicId: (id: string | null) => void;
  setGraphicDragState: (val: GraphicDragState | null) => void;
  setGraphicSnapLines: (lines: { x: number | null; y: number | null }) => void;
  setImportedGraphics: Dispatch<SetStateAction<GraphicLayer[]>>;
  setIsPanning: (val: boolean) => void;
  setPanOffset: Dispatch<SetStateAction<{ x: number; y: number }>>;
  setHdDragHandle: (handle: string | null) => void;
  setHdBox: Dispatch<SetStateAction<{ x: number; y: number; w: number; h: number } | null>>;
  setDraggingOrthoIdx: (idx: number) => void;
  setOrthoPoints: Dispatch<SetStateAction<Point[] | null>>;
  setOrthoMagnifier: (val: any) => void;
  setDraggingPointIdx: (idx: number) => void;
  setRectDragPoints: (val: RectDragPoints | null) => void;
  setQuadPoints: Dispatch<SetStateAction<Point[] | null>>;
  setIsPolyClosed: (val: boolean) => void;
  setPolyHoverClose: (val: boolean) => void;
  setPolyMousePos: (pos: Point | null) => void;
  setSelectionRegion: Dispatch<SetStateAction<SelectionRegion | null>>;
  setFillColor: (color: string) => void;
  setActiveTool: (tool: ToolType | null) => void;
  setRegionStart: (pt: Point | null) => void;
  setDrawingPath: Dispatch<SetStateAction<Point[]>>;
  setLastClickPos: (pos: (Point & { isAdding: boolean }) | null) => void;
  clearSelection: () => void;
  computeSelection: (
    startX: number,
    startY: number,
    tol: number,
    mode: 'global' | 'connected',
    curRegion: SelectionRegion | null,
    isAdding: boolean
  ) => void;
  applySparseHD: (targetW: number, targetH: number) => void;
}

export function createCanvasPointerController(ctx: CanvasPointerControllerContext) {
  const handlePointerDown = (e: React.PointerEvent | React.MouseEvent) => {
    if ('pointerId' in e && e.currentTarget && typeof (e.currentTarget as any).setPointerCapture === 'function') {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    const rect = ctx.imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const isAdding = e.metaKey || e.ctrlKey;

    const nw = ctx.imageRef.current!.naturalWidth;
    const nh = ctx.imageRef.current!.naturalHeight;
    const rawFloatX = ((e.clientX - rect.left) / rect.width) * nw;
    const rawFloatY = ((e.clientY - rect.top) / rect.height) * nh;
    const rawX = Math.floor(rawFloatX);
    const rawY = Math.floor(rawFloatY);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    const isOutsideImage =
      e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;

    // 导入图形图层命中与 8 点触控把手拖拽拦截
    if (e.button === 0 && !ctx.spacePressed && !ctx.activeTool) {
      const targetEl = e.target as HTMLElement | null;
      const graphicHandleEl = targetEl?.closest('[data-graphic-handle]') as HTMLElement | null;
      if (graphicHandleEl && ctx.selectedGraphicIdRef.current) {
        const handleId = graphicHandleEl.dataset.graphicHandle as EightPointHandleId | undefined;
        const targetGraphic = ctx.importedGraphicsRef.current.find((g) => g.id === ctx.selectedGraphicIdRef.current);
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
          ctx.graphicDragStateRef.current = dragInit;
          ctx.setGraphicDragState(dragInit);
          ctx.pendingGraphicDeselectRef.current = null;
          return;
        }
      }

      const graphicBodyEl = targetEl?.closest('[data-graphic-id]') as HTMLElement | null;
      let hitGraphicId = graphicBodyEl?.dataset.graphicId || null;
      if (hitGraphicId) {
        const directTarget = ctx.importedGraphicsRef.current.find((g) => g.id === hitGraphicId);
        if (!directTarget || directTarget.locked) {
          hitGraphicId = null;
        }
      }
      if (!hitGraphicId && ctx.importedGraphicsRef.current.length > 0) {
        for (let i = ctx.importedGraphicsRef.current.length - 1; i >= 0; i--) {
          const g = ctx.importedGraphicsRef.current[i];
          if (g.locked) continue;
          if (rawFloatX >= g.x && rawFloatX <= g.x + g.w && rawFloatY >= g.y && rawFloatY <= g.y + g.h) {
            hitGraphicId = g.id;
            break;
          }
        }
      }

      if (hitGraphicId) {
        const targetGraphic = ctx.importedGraphicsRef.current.find((g) => g.id === hitGraphicId);
        if (targetGraphic && !targetGraphic.locked) {
          e.preventDefault();
          e.stopPropagation();
          ctx.selectedGraphicIdRef.current = targetGraphic.id;
          ctx.setSelectedGraphicId(targetGraphic.id);
          const dragInit = {
            mode: 'move' as const,
            graphicId: targetGraphic.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startBox: { x: targetGraphic.x, y: targetGraphic.y, w: targetGraphic.w, h: targetGraphic.h },
          };
          ctx.graphicDragStateRef.current = dragInit;
          ctx.setGraphicDragState(dragInit);
          ctx.pendingGraphicDeselectRef.current = null;
          return;
        }
      }

      if (ctx.selectedGraphicIdRef.current) {
        ctx.pendingGraphicDeselectRef.current = { x: e.clientX, y: e.clientY };
      }
    }

    // 快捷键空格、非鼠标主键或未选择任何绘制工具时，进入画布平移拖拽模式
    if (e.button !== 0 || ctx.spacePressed || !ctx.activeTool) {
      e.preventDefault();
      ctx.setIsPanning(true);
      ctx.lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (isOutsideImage) {
        ctx.mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    // 高清化 8 点控制拖拽拦截
    if (ctx.activeTool === 'hd') {
      const hdTarget = (e.target as HTMLElement).closest('[data-hd-handle]') as HTMLElement | null;
      const targetHandle = hdTarget ? hdTarget.dataset.hdHandle : null;
      if (targetHandle) {
        e.preventDefault();
        e.stopPropagation();
        ctx.setHdDragHandle(targetHandle);
        ctx.hdDragStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          box: { ...(ctx.hdBox || { x: 0, y: 0, w: nw, h: nh }) },
        };
        return;
      }
    }

    // 正交化工具 4 角拖拽手柄命中
    if (ctx.activeTool === 'ortho' && ctx.orthoPoints && ctx.orthoPoints.length === 4) {
      const thr = 28 / ctx.zoom;
      const idx = ctx.orthoPoints.findIndex((p) => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
      if (idx !== -1) {
        ctx.setDraggingOrthoIdx(idx);
        ctx.setOrthoMagnifier({
          visible: true,
          imgX: ctx.orthoPoints[idx].x,
          imgY: ctx.orthoPoints[idx].y,
          clientX: e.clientX,
          clientY: e.clientY,
        });
        return;
      }
    }

    // 非框选/套索/高清/正交化类工具，在画布外点击时作为画布平移处理
    if (
      isOutsideImage &&
      ctx.activeTool !== 'rect' &&
      ctx.activeTool !== 'lasso' &&
      ctx.activeTool !== 'hd' &&
      ctx.activeTool !== 'ortho'
    ) {
      if (e.button === 0) {
        ctx.setIsPanning(true);
        ctx.lastMousePos.current = { x: e.clientX, y: e.clientY };
        ctx.mouseDownOutsideRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (ctx.activeTool === 'quad') {
      if (ctx.isPolyClosed && ctx.quadPoints) {
        const thr = 20 / ctx.zoom;
        const idx = ctx.quadPoints.findIndex((p) => Math.abs(p.x - imgX) < thr && Math.abs(p.y - imgY) < thr);
        if (idx !== -1) {
          ctx.setDraggingPointIdx(idx);
          ctx.dragStartData.current = { x: ctx.quadPoints[idx].x, y: ctx.quadPoints[idx].y };
          return;
        }
      } else {
        if (!ctx.quadPoints || ctx.quadPoints.length === 0) {
          ctx.setQuadPoints([{ x: imgX, y: imgY }]);
          ctx.setIsPolyClosed(false);
          return;
        }
        const p0 = ctx.quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        if (ctx.quadPoints.length >= 3 && dist < 20 / ctx.zoom) {
          ctx.setIsPolyClosed(true);
          ctx.setSelectionRegion({ type: 'path', data: ctx.quadPoints });
          ctx.setPolyHoverClose(false);
          ctx.setPolyMousePos(null);
          return;
        }
        ctx.setQuadPoints((prev) => (prev ? [...prev, { x: imgX, y: imgY }] : [{ x: imgX, y: imgY }]));
        return;
      }
    }

    if (ctx.activeTool === 'rect' && ctx.selectionRegion?.type === 'rect') {
      const r = ctx.selectionRegion.data;
      const thr = 20 / ctx.zoom;
      let hitIdx = -1;
      if (Math.abs(r.x - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 0;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y - imgY) < thr) hitIdx = 1;
      else if (Math.abs(r.x + r.w - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 2;
      else if (Math.abs(r.x - imgX) < thr && Math.abs(r.y + r.h - imgY) < thr) hitIdx = 3;
      if (hitIdx !== -1) {
        ctx.setDraggingPointIdx(hitIdx);
        ctx.dragStartData.current = { ...r };
        const curPt =
          hitIdx === 0
            ? { x: r.x, y: r.y }
            : hitIdx === 1
              ? { x: r.x + r.w, y: r.y }
              : hitIdx === 2
                ? { x: r.x + r.w, y: r.y + r.h }
                : { x: r.x, y: r.y + r.h };
        const oppPt =
          hitIdx === 0
            ? { x: r.x + r.w, y: r.y + r.h }
            : hitIdx === 1
              ? { x: r.x, y: r.y + r.h }
              : hitIdx === 2
                ? { x: r.x, y: r.y }
                : { x: r.x + r.w, y: r.y };
        ctx.setRectDragPoints({ current: curPt, opposite: oppPt });
        return;
      }
    }

    if (ctx.activeTool === 'pipette') {
      const sampleFromCanvas = (canvas: HTMLCanvasElement) => {
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;
        const pixel = canvasCtx.getImageData(Math.min(nw - 1, imgX), Math.min(nh - 1, imgY), 1, 1).data;
        ctx.setFillColor('#' + Array.from(pixel.slice(0, 3)).map((x) => x.toString(16).padStart(2, '0')).join(''));
        ctx.setActiveTool(null);
      };

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const canvasCtx = canvas.getContext('2d');
      if (canvasCtx && ctx.imageRef.current) {
        canvasCtx.drawImage(ctx.imageRef.current, 0, 0);
        sampleFromCanvas(canvas);
      } else {
        ctx.setActiveTool(null);
      }
      return;
    }

    if (ctx.activeTool === 'rect') {
      ctx.setRegionStart({ x: imgX, y: imgY });
      ctx.setSelectionRegion({ type: 'rect', data: { x: imgX, y: imgY, w: 0, h: 0 } });
      ctx.setRectDragPoints({ current: { x: imgX, y: imgY }, opposite: { x: imgX, y: imgY } });
    } else if (ctx.activeTool === 'lasso') {
      ctx.setDrawingPath([{ x: imgX, y: imgY }]);
    } else if (ctx.activeTool === 'wand') {
      ctx.setLastClickPos({ x: imgX, y: imgY, isAdding });
      ctx.computeSelection(imgX, imgY, ctx.tolerance, ctx.selectionMode, ctx.selectionRegion, isAdding);
    }
  };

  const handleDoubleClick = () => {
    if (ctx.activeTool === 'quad' && !ctx.isPolyClosed && ctx.quadPoints && ctx.quadPoints.length >= 3) {
      ctx.setIsPolyClosed(true);
      ctx.setSelectionRegion({ type: 'path', data: ctx.quadPoints });
      ctx.setPolyHoverClose(false);
      ctx.setPolyMousePos(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent | React.MouseEvent) => {
    const gDrag = ctx.graphicDragStateRef.current;
    if (gDrag && ctx.imageRef.current) {
      const rect = ctx.imageRef.current.getBoundingClientRect();
      const nw = ctx.imageRef.current.naturalWidth;
      const nh = ctx.imageRef.current.naturalHeight;
      if (!nw || !nh || !rect.width || !rect.height) return;

      const snapThreshold = Math.max(3, (8 * nw) / rect.width);
      const otherGraphics = ctx.importedGraphicsRef.current.filter((g) => g.id !== gDrag.graphicId);
      const extraSnapBoxes = ctx.baseElementRef.current
        ? [
            {
              x: ctx.baseElementRef.current.x,
              y: ctx.baseElementRef.current.y,
              w: ctx.baseElementRef.current.w,
              h: ctx.baseElementRef.current.h,
            },
          ]
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
        ctx.setGraphicSnapLines(snapLines);
        const updated = ctx.importedGraphicsRef.current.map((g) =>
          g.id === gDrag.graphicId ? { ...g, x, y } : g
        );
        ctx.importedGraphicsRef.current = updated;
        ctx.setImportedGraphics(updated);
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
        ctx.setGraphicSnapLines(snapLines);
        const updated = ctx.importedGraphicsRef.current.map((g) =>
          g.id === gDrag.graphicId ? { ...g, ...box } : g
        );
        ctx.importedGraphicsRef.current = updated;
        ctx.setImportedGraphics(updated);
      }
      return;
    }

    if (ctx.isPanning) {
      const dx = e.clientX - ctx.lastMousePos.current.x;
      const dy = e.clientY - ctx.lastMousePos.current.y;
      ctx.setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      ctx.lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!ctx.imageRef.current) return;
    const rect = ctx.imageRef.current.getBoundingClientRect();
    const nw = ctx.imageRef.current.naturalWidth;
    const nh = ctx.imageRef.current.naturalHeight;
    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * nw);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * nh);
    const imgX = Math.max(0, Math.min(nw, rawX));
    const imgY = Math.max(0, Math.min(nh, rawY));

    if (ctx.activeTool === 'hd' && ctx.hdDragHandle) {
      const aspect = nw / nh;
      let w = nw;
      let h = nh;
      let x = 0;
      let y = 0;

      switch (ctx.hdDragHandle) {
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

      ctx.setHdBox({ x, y, w, h });
      return;
    }

    if (ctx.activeTool === 'ortho' && ctx.draggingOrthoIdx !== -1 && ctx.orthoPoints) {
      const newPts = [...ctx.orthoPoints];
      newPts[ctx.draggingOrthoIdx] = { x: imgX, y: imgY };
      ctx.setOrthoPoints(newPts);
      ctx.setOrthoMagnifier({
        visible: true,
        imgX,
        imgY,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      return;
    }

    if (ctx.activeTool === 'quad') {
      if (ctx.isPolyClosed && ctx.draggingPointIdx !== -1 && ctx.quadPoints) {
        let fx = imgX;
        let fy = imgY;
        if ((e.metaKey || e.ctrlKey) && ctx.dragStartData.current) {
          if (Math.abs(imgX - ctx.dragStartData.current.x) > Math.abs(imgY - ctx.dragStartData.current.y)) {
            fy = ctx.dragStartData.current.y;
          } else {
            fx = ctx.dragStartData.current.x;
          }
        }
        ctx.setQuadPoints((prev) => {
          if (!prev) return null;
          const n = [...prev];
          n[ctx.draggingPointIdx] = { x: fx, y: fy };
          return n;
        });
        ctx.setSelectionRegion({ type: 'path', data: ctx.quadPoints });
        return;
      }
      if (!ctx.isPolyClosed && ctx.quadPoints && ctx.quadPoints.length > 0) {
        ctx.setPolyMousePos({ x: imgX, y: imgY });
        const p0 = ctx.quadPoints[0];
        const dist = Math.hypot(p0.x - imgX, p0.y - imgY);
        ctx.setPolyHoverClose(ctx.quadPoints.length >= 3 && dist < 20 / ctx.zoom);
        return;
      }
    }

    if (ctx.activeTool === 'rect' && ctx.draggingPointIdx !== -1 && ctx.selectionRegion?.type === 'rect') {
      const r = { ...ctx.selectionRegion.data };
      const start = ctx.dragStartData.current;
      let fx = imgX;
      let fy = imgY;
      if (e.metaKey || e.ctrlKey) {
        const bx = ctx.draggingPointIdx === 0 || ctx.draggingPointIdx === 3 ? start.x : start.x + start.w;
        const by = ctx.draggingPointIdx === 0 || ctx.draggingPointIdx === 1 ? start.y : start.y + start.h;
        if (Math.abs(imgX - bx) > Math.abs(imgY - by)) fy = by;
        else fx = bx;
      }
      if (ctx.draggingPointIdx === 0) {
        r.w += r.x - fx;
        r.h += r.y - fy;
        r.x = fx;
        r.y = fy;
      } else if (ctx.draggingPointIdx === 1) {
        r.w = fx - r.x;
        r.h += r.y - fy;
        r.y = fy;
      } else if (ctx.draggingPointIdx === 2) {
        r.w = fx - r.x;
        r.h = fy - r.y;
      } else if (ctx.draggingPointIdx === 3) {
        r.w += r.x - fx;
        r.x = fx;
        r.h = fy - r.y;
      }
      ctx.setSelectionRegion({ type: 'rect', data: r });

      const curPt =
        ctx.draggingPointIdx === 0
          ? { x: r.x, y: r.y }
          : ctx.draggingPointIdx === 1
            ? { x: r.x + r.w, y: r.y }
            : ctx.draggingPointIdx === 2
              ? { x: r.x + r.w, y: r.y + r.h }
              : { x: r.x, y: r.y + r.h };
      const oppPt =
        ctx.draggingPointIdx === 0
          ? { x: r.x + r.w, y: r.y + r.h }
          : ctx.draggingPointIdx === 1
            ? { x: r.x, y: r.y + r.h }
            : ctx.draggingPointIdx === 2
              ? { x: r.x, y: r.y }
              : { x: r.x + r.w, y: r.y };
      ctx.setRectDragPoints({ current: curPt, opposite: oppPt });
      return;
    }

    if (!ctx.regionStart && ctx.drawingPath.length === 0) return;

    if (ctx.activeTool === 'rect' && ctx.regionStart) {
      const x = Math.min(ctx.regionStart.x, imgX);
      const y = Math.min(ctx.regionStart.y, imgY);
      const w = Math.abs(ctx.regionStart.x - imgX);
      const h = Math.abs(ctx.regionStart.y - imgY);
      ctx.setSelectionRegion({ type: 'rect', data: { x, y, w, h } });
      ctx.setRectDragPoints({
        current: { x: imgX, y: imgY },
        opposite: { x: ctx.regionStart.x, y: ctx.regionStart.y },
      });
    } else if (ctx.activeTool === 'lasso' && ctx.drawingPath.length > 0) {
      ctx.setDrawingPath((prev) => [...prev, { x: imgX, y: imgY }]);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent | React.MouseEvent) => {
    if (e && 'pointerId' in e && e.currentTarget && typeof (e.currentTarget as any).releasePointerCapture === 'function') {
      try {
        if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch {}
    }
    ctx.setIsPanning(false);
    ctx.setDraggingPointIdx(-1);
    ctx.setDraggingOrthoIdx(-1);
    ctx.setOrthoMagnifier(null);
    ctx.dragStartData.current = null;
    ctx.setRectDragPoints(null);

    if (ctx.graphicDragStateRef.current) {
      ctx.graphicDragStateRef.current = null;
      ctx.setGraphicDragState(null);
      ctx.setGraphicSnapLines({ x: null, y: null });
    }

    if (ctx.pendingGraphicDeselectRef.current) {
      const startPos = ctx.pendingGraphicDeselectRef.current;
      ctx.pendingGraphicDeselectRef.current = null;
      const clientX = e ? e.clientX : startPos.x;
      const clientY = e ? e.clientY : startPos.y;
      const dist = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (dist < 5) {
        ctx.selectedGraphicIdRef.current = null;
        ctx.setSelectedGraphicId(null);
      }
    }

    if (ctx.mouseDownOutsideRef.current) {
      const startPos = ctx.mouseDownOutsideRef.current;
      ctx.mouseDownOutsideRef.current = null;
      const clientX = e ? e.clientX : startPos.x;
      const clientY = e ? e.clientY : startPos.y;
      const dist = Math.hypot(clientX - startPos.x, clientY - startPos.y);
      if (dist < 5 && ctx.hasSelection) {
        ctx.clearSelection();
      }
    }

    if (ctx.activeTool === 'hd' && ctx.hdDragHandle) {
      const box = ctx.hdBoxRef.current;
      ctx.setHdDragHandle(null);
      ctx.hdDragStartRef.current = null;
      if (box && ctx.imageRef.current) {
        const nw = ctx.imageRef.current.naturalWidth;
        const nh = ctx.imageRef.current.naturalHeight;
        if (box.w > nw || box.h > nh) {
          ctx.applySparseHD(Math.round(box.w), Math.round(box.h));
        } else {
          ctx.setHdBox({ x: 0, y: 0, w: nw, h: nh });
        }
      }
      return;
    }

    if (ctx.activeTool === 'rect' && ctx.regionStart) {
      ctx.setRegionStart(null);
      if (ctx.selectionRegion && (ctx.selectionRegion.data.w < 2 || ctx.selectionRegion.data.h < 2)) {
        ctx.clearSelection();
      }
    } else if (ctx.activeTool === 'lasso' && ctx.drawingPath.length > 0) {
      if (ctx.drawingPath.length > 3) {
        ctx.setSelectionRegion({ type: 'path', data: ctx.drawingPath });
      } else {
        ctx.setSelectionRegion(null);
      }
      ctx.setDrawingPath([]);
    }
  };

  const handlePointerCancel = (e?: React.PointerEvent | React.MouseEvent) => {
    handlePointerUp(e);
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleMouseDown: handlePointerDown,
    handleMouseMove: handlePointerMove,
    handleMouseUp: handlePointerUp,
    handleDoubleClick,
  };
}
