import React from 'react';
import {
  Square,
  Crop,
  Pencil,
  LandPlot,
  FlipHorizontal,
  XCircle,
  Eye,
  Wand2,
} from 'lucide-react';
import { ImageEditorCore } from '../../core/useImageEditorCore';
import { ToolbarToolId } from '../../types/toolbar';

export interface SelectionToolsGroupProps {
  core: ImageEditorCore;
  isCompact: boolean;
  visibleTools: Set<ToolbarToolId>;
  hasSelectionTools: boolean;
  hasWandTools: boolean;
  maxImgDimension: number;
  spillRadiusBtnRef: React.RefObject<HTMLButtonElement>;
  showSpillRadiusPopover: boolean;
  setShowSpillRadiusPopover: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SelectionToolsGroup: React.FC<SelectionToolsGroupProps> = ({
  core,
  isCompact,
  visibleTools,
  hasSelectionTools,
  hasWandTools,
  maxImgDimension,
  spillRadiusBtnRef,
  showSpillRadiusPopover,
  setShowSpillRadiusPopover,
}) => {
  const {
    activeTool,
    setActiveTool,
    isPolyClosed,
    setQuadPoints,
    setIsPolyClosed,
    handleCropTransparency,
    isLoading,
    toggleInvertSelection,
    hasSelection,
    isRegionInverted,
    clearSelection,
    showAlphaMask,
    setShowAlphaMask,
    selectionMode,
    setSelectionMode,
    tolerance,
    setTolerance,
    spillRadius,
  } = core;

  return (
    <>
      {/* 1. 选区范围工具组 */}
      {hasSelectionTools && (
        <div className={`flex items-center p-0.5 border gap-0.5 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          {visibleTools.has('rect') && (
            <button 
              onClick={() => setActiveTool(activeTool === 'rect' ? null : 'rect')} 
              className={`p-1.5 transition-all rounded-md ${activeTool === 'rect' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
              title="矩形范围"
            >
              <Square size={12} />
            </button>
          )}
          {visibleTools.has('cropAuto') && (
            <button 
              onClick={handleCropTransparency} 
              disabled={isLoading} 
              className={`p-1.5 transition-all rounded-md ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
              title="智能修边 (自动寻找最小有效像素并进入矩形范围)"
            >
              <Crop size={12} />
            </button>
          )}
          {visibleTools.has('lasso') && (
            <button 
              onClick={() => setActiveTool(activeTool === 'lasso' ? null : 'lasso')} 
              className={`p-1.5 transition-all rounded-md ${activeTool === 'lasso' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
              title="索套范围"
            >
              <Pencil size={12} />
            </button>
          )}
          {visibleTools.has('quad') && (
            <button 
              onClick={() => {
                if (activeTool === 'quad') {
                  setActiveTool(null);
                } else {
                  setActiveTool('quad');
                  if (!isPolyClosed) {
                    setQuadPoints(null);
                    setIsPolyClosed(false);
                  }
                }
              }} 
              className={`p-1.5 transition-all rounded-md ${activeTool === 'quad' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
              title="多边范围 (点按连线，首尾闭合，支持顶点调整)"
            >
              <LandPlot size={12} />
            </button>
          )}

          {(visibleTools.has('rect') || visibleTools.has('cropAuto') || visibleTools.has('lasso') || visibleTools.has('quad')) && 
           (visibleTools.has('invert') || visibleTools.has('clear')) && (
            <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />
          )}

          {/* 反选: 始终显示，无选区时不可点击 */}
          {visibleTools.has('invert') && (
            <button 
              onClick={toggleInvertSelection} 
              disabled={!hasSelection}
              className={`p-1.5 transition-all rounded-md ${
                !hasSelection 
                  ? 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400' 
                  : isRegionInverted 
                    ? 'bg-amber-500 text-white shadow-md' 
                    : isCompact 
                      ? 'text-slate-300 hover:bg-slate-700' 
                      : 'text-slate-500 hover:bg-white hover:text-amber-600'
              }`} 
              title={hasSelection ? (isRegionInverted ? "恢复正选" : "反选选区") : "无选区 (无法反选)"}
            >
              <FlipHorizontal size={12} />
            </button>
          )}

          {/* 清除选区 */}
          {visibleTools.has('clear') && (
            <button 
              onClick={clearSelection} 
              disabled={!hasSelection}
              className={`p-1.5 transition-all rounded-md ${
                !hasSelection 
                  ? 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400' 
                  : isCompact 
                    ? 'text-red-400 hover:bg-red-950/40' 
                    : 'text-red-500 hover:bg-white hover:text-red-600'
              }`} 
              title={hasSelection ? "清除选区" : "无选区"}
            >
              <XCircle size={12} />
            </button>
          )}
        </div>
      )}

      {/* 2. 抠图与魔棒工具组 */}
      {hasWandTools && (
        <div className={`flex items-center p-0.5 border gap-1 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          {/* 透明检测 */}
          {visibleTools.has('alphaMask') && (
            <button 
              onClick={() => setShowAlphaMask(!showAlphaMask)} 
              className={`p-1.5 rounded-md transition-all ${showAlphaMask ? 'bg-red-500 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-500 hover:bg-white'}`} 
              title="透明检测 (红网格标示透明背景)"
            >
              <Eye size={12} />
            </button>
          )}

          {visibleTools.has('alphaMask') && (visibleTools.has('wand') || visibleTools.has('wandMode') || visibleTools.has('tolerance') || visibleTools.has('erase')) && (
            <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />
          )}

          {/* 魔棒选色 */}
          {visibleTools.has('wand') && (
            <button 
              onClick={() => setActiveTool(activeTool === 'wand' ? null : 'wand')} 
              className={`p-1.5 rounded-md transition-all ${activeTool === 'wand' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-indigo-400' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
              title="魔棒选色 (点击图片中需要抠除的颜色)"
            >
              <Wand2 size={12} />
            </button>
          )}

          {/* 全屏匹配 vs 连通区域 */}
          {visibleTools.has('wandMode') && (
            <button 
              onClick={() => setSelectionMode(m => m === 'global' ? 'connected' : 'global')} 
              className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded transition-colors ${selectionMode === 'connected' ? 'bg-indigo-600 text-white shadow-sm' : isCompact ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              title="魔棒选色模式：全屏匹配 vs 仅连续区域"
            >
              {selectionMode === 'global' ? '全屏' : '连通'}
            </button>
          )}

          {/* 容差滑块 */}
          {visibleTools.has('tolerance') && (
            <div className="flex items-center gap-1 px-0.5" title={`魔棒选色容差: ${tolerance}`}>
              <span className="text-[8px] text-slate-400 font-bold">容差</span>
              <input 
                type="range" 
                min="1" 
                max="255" 
                value={tolerance} 
                onChange={(e) => setTolerance(parseInt(e.target.value))} 
                className="w-12 h-1 bg-slate-300 appearance-none cursor-pointer accent-indigo-600 rounded-lg" 
              />
            </div>
          )}

          {/* 影响范围按钮 (去色边过渡带半径) */}
          {visibleTools.has('spillRadius') && (
            <button
              ref={spillRadiusBtnRef}
              type="button"
              onClick={() => setShowSpillRadiusPopover((v) => !v)}
              className={`flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold rounded transition-colors ${
                showSpillRadiusPopover
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isCompact
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              title={`去色边影响范围: ${spillRadius >= maxImgDimension ? '全图' : `${spillRadius}px`}`}
            >
              <span>影响范围</span>
              <span className={`text-[7px] px-1 rounded font-black ${
                showSpillRadiusPopover
                  ? 'bg-indigo-700 text-white'
                  : isCompact
                  ? 'bg-slate-800 text-indigo-400'
                  : 'bg-slate-100 text-indigo-600 border border-indigo-100'
              }`}>
                {spillRadius >= maxImgDimension ? '全图' : `${spillRadius}px`}
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
};
