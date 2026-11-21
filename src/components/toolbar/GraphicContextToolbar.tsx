import React from 'react';
import {
  Layers,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Maximize2,
  SquareDashed,
  ImagePlus,
  Lock,
  Unlock,
  Check,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ImageEditorCore } from '../../core/useImageEditorCore';
import { ImportedGraphic } from '../../core/algorithms/graphicLayer';
import { ToolbarToolId } from '../../types/toolbar';

export interface GraphicContextToolbarProps {
  selectedGraphic: ImportedGraphic;
  core: ImageEditorCore;
  isCompact: boolean;
  visibleTools: Set<ToolbarToolId>;
  borderWidthBtnRef: React.RefObject<HTMLButtonElement>;
  showBorderWidthPopover: boolean;
  setShowBorderWidthPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSpillRadiusPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettingsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  triggerImportGraphic: () => void;
  isGraphicAtTop: boolean;
  isGraphicAtBottom: boolean;
  lockedCount: number;
}

export const GraphicContextToolbar: React.FC<GraphicContextToolbarProps> = ({
  selectedGraphic,
  core,
  isCompact,
  visibleTools,
  borderWidthBtnRef,
  showBorderWidthPopover,
  setShowBorderWidthPopover,
  setShowSpillRadiusPopover,
  setShowSettingsPopover,
  triggerImportGraphic,
  isGraphicAtTop,
  isGraphicAtBottom,
  lockedCount,
}) => {
  const {
    isLoading,
    borderColor,
    setBorderColor,
    borderWidth,
    handleGraphicFlip,
    handleGraphicRotate90,
    handleGraphicLayerOrder,
    handleExpandCanvas,
    handleApplyBorder,
    handleLockSelectedGraphic,
    handleUnlockAllGraphics,
    commitImportedGraphics,
    handleDeleteSelectedGraphic,
    setSelectedGraphicId,
  } = core;

  return (
    <>
      {/* 选中图形标识与尺寸 */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 text-[10px] font-bold ${isCompact ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
        <Layers size={12} strokeWidth={2.5} />
        <span>已选图形</span>
        <span className="font-mono opacity-80">
          {Math.round(selectedGraphic.w)}×{Math.round(selectedGraphic.h)}
        </span>
      </div>

      {/* 1. 图形变换工具组：左右镜像、上下镜像、逆时针90°、顺时针90° */}
      <div className={`flex items-center p-0.5 border gap-0.5 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        <button
          type="button"
          onClick={() => handleGraphicFlip('flipH')}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-200 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
          title="左右镜像选中图形"
        >
          <FlipHorizontal2 size={12} />
          <span className="text-[10px] font-bold">左右镜像</span>
        </button>

        <button
          type="button"
          onClick={() => handleGraphicFlip('flipV')}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-200 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
          title="上下镜像选中图形"
        >
          <FlipVertical2 size={12} />
          <span className="text-[10px] font-bold">上下镜像</span>
        </button>

        <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />

        <button
          type="button"
          onClick={() => handleGraphicRotate90('ccw')}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-200 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
          title="逆时针旋转 90°"
        >
          <RotateCcw size={12} />
          <span className="text-[10px] font-bold">逆时针90°</span>
        </button>

        <button
          type="button"
          onClick={() => handleGraphicRotate90('cw')}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-200 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
          title="顺时针旋转 90°"
        >
          <RotateCw size={12} />
          <span className="text-[10px] font-bold">顺时针90°</span>
        </button>
      </div>

      {/* 2. 图层层级排列组：最顶、上一层、下一层、最底（支持与底图穿插叠放） */}
      <div className={`flex items-center p-0.5 border gap-0.5 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        <button
          type="button"
          onClick={() => handleGraphicLayerOrder('front')}
          disabled={isLoading || isGraphicAtTop}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${isCompact ? 'text-slate-200 enabled:hover:bg-slate-700 enabled:hover:text-white' : 'text-slate-600 enabled:hover:bg-white enabled:hover:text-indigo-600'}`}
          title="置于最顶层"
        >
          <ArrowUpToLine size={12} />
          <span className="text-[10px] font-bold">最顶</span>
        </button>

        <button
          type="button"
          onClick={() => handleGraphicLayerOrder('forward')}
          disabled={isLoading || isGraphicAtTop}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${isCompact ? 'text-slate-200 enabled:hover:bg-slate-700 enabled:hover:text-white' : 'text-slate-600 enabled:hover:bg-white enabled:hover:text-indigo-600'}`}
          title="上移一层"
        >
          <ArrowUp size={12} />
          <span className="text-[10px] font-bold">上一层</span>
        </button>

        <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />

        <button
          type="button"
          onClick={() => handleGraphicLayerOrder('backward')}
          disabled={isLoading || isGraphicAtBottom}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${isCompact ? 'text-slate-200 enabled:hover:bg-slate-700 enabled:hover:text-white' : 'text-slate-600 enabled:hover:bg-white enabled:hover:text-indigo-600'}`}
          title="下移一层（可移至底图下方）"
        >
          <ArrowDown size={12} />
          <span className="text-[10px] font-bold">下一层</span>
        </button>

        <button
          type="button"
          onClick={() => handleGraphicLayerOrder('back')}
          disabled={isLoading || isGraphicAtBottom}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-35 disabled:cursor-not-allowed ${isCompact ? 'text-slate-200 enabled:hover:bg-slate-700 enabled:hover:text-white' : 'text-slate-600 enabled:hover:bg-white enabled:hover:text-indigo-600'}`}
          title="置于最底层（底图下方最底）"
        >
          <ArrowDownToLine size={12} />
          <span className="text-[10px] font-bold">最底</span>
        </button>
      </div>

      {/* 3. 图层与画布动作组：扩展画布、边框、继续导入、融合、删除、取消选中 */}
      <div className={`flex items-center p-0.5 border gap-1 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        <button
          type="button"
          onClick={handleExpandCanvas}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer"
          title="扩展画布 (将所有元素的外边框取最大值生成新的画布)"
        >
          <Maximize2 size={12} strokeWidth={2.5} />
          <span className="text-[10px] font-bold">扩展画布</span>
        </button>

        {visibleTools.has('border') && (
          <div className="flex items-center gap-0.5">
            <div className="relative flex items-center justify-center p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" title="选择边框颜色">
              <input
                type="color"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                title="选择边框颜色"
              />
              <div className="w-5 h-5 rounded border border-white/50 shadow-sm" style={{ backgroundColor: borderColor }} />
            </div>

            <button
              ref={borderWidthBtnRef}
              type="button"
              onClick={() => {
                setShowBorderWidthPopover((v) => !v);
                setShowSpillRadiusPopover(false);
                setShowSettingsPopover(false);
              }}
              className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                showBorderWidthPopover
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                  : isCompact
                    ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-xs'
              }`}
              title="调节边框宽度 (PX)"
            >
              <span className={`px-1 py-0.5 rounded text-[10px] font-mono ${
                showBorderWidthPopover
                  ? 'bg-indigo-700 text-white'
                  : isCompact
                    ? 'bg-slate-800 text-indigo-400'
                    : 'bg-slate-100 text-indigo-600 border border-indigo-100'
              }`}>
                {borderWidth} PX
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBorderWidthPopover(false);
                handleApplyBorder();
              }}
              disabled={isLoading}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                !isLoading
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 cursor-pointer'
                  : 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400'
              }`}
              title="为当前选中图形有效像素最外层添加边框"
            >
              <SquareDashed size={12} strokeWidth={2.5} />
              <span className="text-[10px] font-bold">边框</span>
            </button>
          </div>
        )}

        {visibleTools.has('importGraphic') && (
          <button
            type="button"
            onClick={triggerImportGraphic}
            disabled={isLoading}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-200 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-white hover:text-indigo-600'}`}
            title="继续导入新的图形"
          >
            <ImagePlus size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">导入图形</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleLockSelectedGraphic}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-600 hover:text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:text-amber-800'}`}
          title="锁定当前图形（锁定后不能移动和缩放，也不响应任何鼠标事件，避免遮挡下方元素编辑）"
        >
          <Lock size={12} strokeWidth={2.5} />
          <span className="text-[10px] font-bold">锁定</span>
        </button>

        {lockedCount > 0 && (
          <button
            type="button"
            onClick={handleUnlockAllGraphics}
            disabled={isLoading}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'bg-slate-700 text-amber-300 hover:bg-slate-600 hover:text-white' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}
            title={`解锁全部 ${lockedCount} 个已锁定图层`}
          >
            <Unlock size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">解锁({lockedCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={commitImportedGraphics}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer"
          title="仅将当前选中图形这一层融合到底图（融合后与底图一起成为最底一层，其余未融合图层保留）"
        >
          <Check size={12} strokeWidth={2.5} />
          <span className="text-[10px] font-bold">融合</span>
        </button>

        <button
          type="button"
          onClick={handleDeleteSelectedGraphic}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-rose-400 hover:bg-rose-950/60 hover:text-rose-300' : 'text-rose-600 hover:bg-white hover:text-rose-700'}`}
          title="删除选中图形"
        >
          <Trash2 size={12} />
          <span className="text-[10px] font-bold">删除</span>
        </button>

        <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />

        <button
          type="button"
          onClick={() => setSelectedGraphicId(null)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-slate-800'}`}
          title="取消选中图形并恢复原始工具栏 (也可点击画布空白处或按 Esc)"
        >
          <XCircle size={12} />
          <span className="text-[10px] font-bold">完成调整</span>
        </button>
      </div>
    </>
  );
};
