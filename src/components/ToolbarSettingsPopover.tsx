import React from 'react';
import { 
  Check, 
  X, 
  RotateCcw, 
  SlidersHorizontal,
  Square,
  Crop,
  Pencil,
  LandPlot,
  FlipHorizontal,
  XCircle,
  Eye,
  Wand2,
  Sliders,
  Eraser,
  Palette,
  Pipette,
  Scissors,
  PaintBucket,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Compass,
  Settings,
  Sparkles,
  Scan,
  Focus,
  SunMedium
} from 'lucide-react';
import { 
  ToolbarToolId, 
  ToolbarCategoryKey,
  ALL_TOOLBAR_TOOLS, 
  TOOLBAR_CATEGORIES,
  DEFAULT_VISIBLE_TOOL_IDS
} from '../types/toolbar';

// 映射每个工具对应的图标组件
const TOOL_ICONS: Record<ToolbarToolId, React.ReactNode> = {
  rect: <Square size={13} />,
  cropAuto: <Crop size={13} />,
  lasso: <Pencil size={13} />,
  quad: <LandPlot size={13} />,
  invert: <FlipHorizontal size={13} />,
  clear: <XCircle size={13} />,
  alphaMask: <Eye size={13} />,
  wand: <Wand2 size={13} />,
  wandMode: <Sliders size={13} />,
  tolerance: <SlidersHorizontal size={13} />,
  erase: <Eraser size={13} />,
  colorPicker: <Palette size={13} />,
  pipette: <Pipette size={13} />,
  crop: <Scissors size={13} />,
  fill: <PaintBucket size={13} />,
  hd: <Sparkles size={13} />,
  flipH: <FlipHorizontal2 size={13} />,
  flipV: <FlipVertical2 size={13} />,
  rotateCcw: <RotateCcw size={13} />,
  rotateCw: <RotateCw size={13} />,
  rotateAny: <Compass size={13} />,
  ortho: <Scan size={13} />,
  orthoAuto: <Focus size={13} />,
  deShadow: <SunMedium size={13} />,
  settings: <Settings size={13} />,
};

interface ToolbarSettingsPopoverProps {
  visibleTools: Set<ToolbarToolId>;
  onToggleTool: (id: ToolbarToolId) => void;
  onSetTools: (tools: ToolbarToolId[]) => void;
  onClose: () => void;
  left: number;
  arrowOffset: number;
  popoverRef: React.RefObject<HTMLDivElement>;
  isCompact?: boolean;
}

export const ToolbarSettingsPopover: React.FC<ToolbarSettingsPopoverProps> = ({
  visibleTools,
  onToggleTool,
  onSetTools,
  onClose,
  left,
  arrowOffset,
  popoverRef,
  isCompact = false,
}) => {
  const visibleCount = visibleTools.size;
  const totalCount = ALL_TOOLBAR_TOOLS.length;

  // 常用精简推荐方案
  const applyRecommended = () => {
    onSetTools([
      'rect', 'cropAuto', 'wand', 'tolerance', 'erase', 
      'colorPicker', 'pipette', 'crop', 'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow',
      'settings'
    ]);
  };

  // 抠图极简方案
  const applyCutoutOnly = () => {
    onSetTools([
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'erase', 
      'crop', 'settings'
    ]);
  };

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: `${left}px`,
        width: '360px',
        maxWidth: '92vw',
        zIndex: 9999,
      }}
      className={`select-none p-3.5 animate-in fade-in zoom-in-95 duration-150 rounded-2xl shadow-2xl backdrop-blur-xl border ${
        isCompact
          ? 'bg-slate-900/95 text-white border-slate-700 shadow-black/60'
          : 'bg-white/95 text-slate-800 border-slate-200/90 shadow-slate-900/15'
      }`}
    >
      {/* 顶部指示小箭头 */}
      <div
        style={{
          position: 'absolute',
          top: '-5px',
          left: `${arrowOffset}px`,
          transform: 'translateX(-50%) rotate(45deg)',
          width: '10px',
          height: '10px',
        }}
        className={`border-t border-l ${
          isCompact ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      />

      {/* 头部标题与关闭按钮 */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
            <SlidersHorizontal size={12} />
          </div>
          <span className="text-[12px] font-black text-slate-900 dark:text-white tracking-tight">
            工具栏设置
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isCompact ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
          }`}>
            已显示 {visibleCount}/{totalCount}
          </span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            isCompact ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="关闭设置"
        >
          <X size={13} />
        </button>
      </div>

      {/* 快捷方案一键切换 */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto no-scrollbar pb-1 text-[10px]">
        <button
          onClick={() => onSetTools(DEFAULT_VISIBLE_TOOL_IDS)}
          className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition-colors ${
            visibleCount === totalCount
              ? 'bg-indigo-600 text-white shadow-sm'
              : isCompact 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          全部显示
        </button>
        <button
          onClick={applyRecommended}
          className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition-colors ${
            isCompact ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          常用推荐
        </button>
        <button
          onClick={applyCutoutOnly}
          className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition-colors ${
            isCompact ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          纯抠图
        </button>
        <button
          onClick={() => onSetTools(['settings'])}
          className={`px-2 py-1 rounded-md font-bold whitespace-nowrap transition-colors ml-auto text-slate-400 hover:text-red-500 ${
            isCompact ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
          }`}
          title="清空除设置外的所有按钮"
        >
          清空
        </button>
      </div>

      {/* 分类工具按钮选择区 (支持平滑滚动) */}
      <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3 overscroll-contain">
        {TOOLBAR_CATEGORIES.map((cat) => {
          const categoryTools = ALL_TOOLBAR_TOOLS.filter((t) => t.category === cat.key);
          const catVisibleCount = categoryTools.filter((t) => visibleTools.has(t.id)).length;

          return (
            <div key={cat.key} className="space-y-1.5">
              {/* 分组标题与小计 */}
              <div className="flex items-center justify-between px-1">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isCompact ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {cat.name}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  {catVisibleCount}/{categoryTools.length}
                </span>
              </div>

              {/* 工具按钮网格 */}
              <div className="grid grid-cols-2 gap-1.5">
                {categoryTools.map((tool) => {
                  const isChecked = visibleTools.has(tool.id);

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => onToggleTool(tool.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-all text-[11px] font-semibold border ${
                        isChecked
                          ? isCompact
                            ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300 shadow-sm'
                            : 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-xs'
                          : isCompact
                            ? 'bg-slate-800/40 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                            : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      title={tool.description}
                    >
                      {/* 自定义复选指示器 */}
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-indigo-600 text-white'
                            : isCompact
                              ? 'border border-slate-600 bg-slate-800'
                              : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </div>

                      {/* 图标 */}
                      <span className={`shrink-0 ${isChecked ? (isCompact ? 'text-indigo-400' : 'text-indigo-600') : 'opacity-40'}`}>
                        {TOOL_ICONS[tool.id]}
                      </span>

                      {/* 标题 */}
                      <span className="truncate flex-1 leading-tight">
                        {tool.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部确认栏 */}
      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          勾选后工具栏实时更新生效
        </span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all"
        >
          确定
        </button>
      </div>
    </div>
  );
};
