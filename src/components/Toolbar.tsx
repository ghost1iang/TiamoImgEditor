import React, { useRef, useState, useEffect } from 'react';
import { 
  Square, 
  Pencil, 
  FlipHorizontal, 
  XCircle, 
  Eye, 
  Eraser, 
  Crop, 
  LandPlot, 
  Pipette, 
  PaintBucket, 
  RotateCw, 
  RotateCcw,
  FlipHorizontal2,
  FlipVertical2,
  Compass,
  Check, 
  X, 
  RefreshCw, 
  Download, 
  Upload, 
  Sparkles,
  Scissors,
  Wand2,
  Settings
} from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';
import { ToolbarToolId, resolveVisibleTools } from '../types/toolbar';
import { ToolbarSettingsPopover } from './ToolbarSettingsPopover';

interface RotationPopoverProps {
  angle: number;
  onChange: (a: number) => void;
  onApply: () => void;
  onReset: () => void;
  left: number;
  arrowOffset: number;
  popoverRef: React.RefObject<HTMLDivElement>;
  isCompact?: boolean;
}

const RotationPopover: React.FC<RotationPopoverProps> = ({
  angle,
  onChange,
  onApply,
  onReset,
  left,
  arrowOffset,
  popoverRef,
  isCompact = false,
}) => {
  const normalized = ((angle % 360) + 360) % 360;
  const displayAngle = normalized > 180 ? normalized - 360 : normalized;
  const presets = [-90, -45, 0, 45, 90, 180];

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: `${left}px`,
        zIndex: 99999,
      }}
      className={`w-[264px] rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none backdrop-blur-xl ${
        isCompact 
          ? 'bg-slate-900/95 text-white border border-slate-700/80' 
          : 'bg-white/95 text-slate-800 border border-slate-200/90 shadow-slate-900/10'
      }`}
    >
      {/* 顶部小箭头对齐按钮 */}
      <div
        className={`absolute -top-1 w-2.5 h-2.5 border-t border-l ${
          isCompact 
            ? 'bg-slate-900 border-slate-700/80' 
            : 'bg-white border-slate-200'
        }`}
        style={{
          left: `${Math.max(14, Math.min(arrowOffset, 250))}px`,
          transform: 'translateX(-50%) rotate(45deg)',
        }}
      />

      {/* 头部标题与关闭 */}
      <div className={`w-full flex items-center justify-between pb-1 border-b text-xs font-bold ${
        isCompact ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        <span className="flex items-center gap-1.5 text-indigo-600">
          <Compass size={13} />
          <span>自由角度旋转</span>
        </span>
        <button
          onClick={onReset}
          className={`p-0.5 rounded transition-colors ${
            isCompact ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="关闭"
        >
          <X size={13} />
        </button>
      </div>

      {/* 数值显示与微调按键 */}
      <div className="flex items-center justify-between gap-1 px-1">
        <button
          onClick={() => onChange(displayAngle - 1)}
          className={`px-2 py-1 active:scale-95 text-[11px] font-bold rounded-lg transition-all ${
            isCompact 
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="逆时针微调 1°"
        >
          -1°
        </button>
        <div className={`flex items-center justify-center border rounded-lg px-2 py-0.5 ${
          isCompact ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <input
            type="number"
            min="-180"
            max="180"
            value={displayAngle}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onChange(isNaN(val) ? 0 : val);
            }}
            className="w-12 text-[12px] font-black text-center bg-transparent outline-none"
          />
          <span className="text-[10px] text-slate-400 font-bold">°</span>
        </div>
        <button
          onClick={() => onChange(displayAngle + 1)}
          className={`px-2 py-1 active:scale-95 text-[11px] font-bold rounded-lg transition-all ${
            isCompact 
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="顺时针微调 1°"
        >
          +1°
        </button>
      </div>

      {/* 连续滑块 (-180° ~ 180°) */}
      <div className="flex flex-col gap-1 px-1">
        <input
          type="range"
          min="-180"
          max="180"
          value={displayAngle}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className={`w-full h-1.5 appearance-none cursor-pointer accent-indigo-600 rounded-lg ${
            isCompact ? 'bg-slate-700' : 'bg-slate-200'
          }`}
        />
        <div className="flex justify-between text-[8px] text-slate-400 font-mono px-0.5">
          <span>-180°</span>
          <span>-90°</span>
          <span className="font-bold text-slate-600">0°</span>
          <span>+90°</span>
          <span>+180°</span>
        </div>
      </div>

      {/* 快捷常用刻度预设 */}
      <div className="grid grid-cols-6 gap-1 w-full">
        {presets.map((p) => {
          const isAct = displayAngle === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`py-1 text-[9px] font-bold rounded-md transition-all ${
                isAct
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isCompact
                    ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p > 0 ? `+${p}°` : `${p}°`}
            </button>
          );
        })}
      </div>

      {/* 底部动作栏 */}
      <div className={`flex items-center gap-2 w-full pt-1.5 border-t ${
        isCompact ? 'border-slate-800' : 'border-slate-100'
      }`}>
        <button
          onClick={onReset}
          className={`flex-1 py-1.5 text-center text-[10px] font-bold active:scale-95 rounded-lg transition-colors ${
            isCompact 
              ? 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700' 
              : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
          }`}
        >
          还原
        </button>
        <button
          onClick={onApply}
          className="flex-1 py-1.5 text-center text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg shadow-sm transition-colors"
        >
          确认旋转
        </button>
      </div>
    </div>
  );
};

export interface ToolbarProps {
  core: ImageEditorCore;
  mode?: 'modal' | 'toolbar' | 'distributed';
  showComplete?: boolean;
  showCancel?: boolean;
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  onFinish?: () => void;
  onCancel?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  core,
  mode = 'modal',
  showComplete = true,
  showCancel = true,
  tools,
  visibleTools: propVisibleTools,
  hiddenTools,
  onFinish,
  onCancel,
}) => {
  const {
    version,
    currentImage,
    activeTool,
    setActiveTool,
    selectionRegion,
    setSelectionRegion,
    isRegionInverted,
    setIsRegionInverted,
    toggleInvertSelection,
    clearSelection,
    quadPoints,
    setQuadPoints,
    isPolyClosed,
    setIsPolyClosed,
    showAlphaMask,
    setShowAlphaMask,
    selectionMode,
    setSelectionMode,
    tolerance,
    setTolerance,
    deSpillGreen,
    setDeSpillGreen,
    applyDeSpillGreen,
    sampledColor,
    handleCropTransparency,
    fillColor,
    setFillColor,
    hasSelection,
    handleFillSelection,
    handleCropSelection,
    rotationAngle,
    setRotationAngle,
    handleApplyRotation,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    handleApplyQuadCrop,
    commitFinalCrop,
    maskCanvas,
    handleInvertSelection,
    handleEraseSelection,
    applyWandCutout,
    handleUpload,
    isLoading,
    handleFinish,
    handleCancel: coreCancel,
  } = core;

  const handleDoneClick = onFinish || handleFinish;
  const handleCancelClick = onCancel || coreCancel;

  const isCompact = mode === 'toolbar';

  // ----------------------------------------------------
  // 1. 工具可见性控制 (支持外部参数预设 + 内部运行时动态修改)
  // ----------------------------------------------------
  const [visibleTools, setVisibleTools] = useState<Set<ToolbarToolId>>(() => {
    return resolveVisibleTools({
      tools,
      visibleTools: propVisibleTools,
      hiddenTools,
    });
  });

  // 当外部传入的配置更新时自动响应
  useEffect(() => {
    setVisibleTools(resolveVisibleTools({
      tools,
      visibleTools: propVisibleTools,
      hiddenTools,
    }));
  }, [tools, propVisibleTools, hiddenTools]);

  const handleToggleTool = (id: ToolbarToolId) => {
    setVisibleTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSetTools = (toolIds: ToolbarToolId[]) => {
    setVisibleTools(new Set(toolIds));
  };

  // ----------------------------------------------------
  // 2. 旋转浮窗与设置浮窗定位控制
  // ----------------------------------------------------
  const toolbarRef = useRef<HTMLDivElement>(null);
  const rotateBtnRef = useRef<HTMLButtonElement>(null);
  const rotatePopoverRef = useRef<HTMLDivElement>(null);
  const [rotatePopoverPos, setRotatePopoverPos] = useState<{ left: number; arrowOffset: number }>({ left: 0, arrowOffset: 130 });

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [settingsPopoverPos, setSettingsPopoverPos] = useState<{ left: number; arrowOffset: number }>({ left: 0, arrowOffset: 160 });

  const handleToggleRotatePopover = () => {
    if (activeTool === 'rotate') {
      setActiveTool(null);
    } else {
      setActiveTool('rotate');
    }
  };

  // 旋转浮窗位置自适应
  useEffect(() => {
    if (activeTool === 'rotate' && rotateBtnRef.current && toolbarRef.current) {
      const updatePos = () => {
        const btnRect = rotateBtnRef.current!.getBoundingClientRect();
        const tbRect = toolbarRef.current!.getBoundingClientRect();
        const popoverWidth = 264;
        const btnCenterX = (btnRect.left - tbRect.left) + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, tbRect.width - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setRotatePopoverPos({
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      return () => window.removeEventListener('resize', updatePos);
    }
  }, [activeTool]);

  // 设置浮窗位置自适应
  useEffect(() => {
    if (showSettingsPopover && settingsBtnRef.current && toolbarRef.current) {
      const updatePos = () => {
        const btnRect = settingsBtnRef.current!.getBoundingClientRect();
        const tbRect = toolbarRef.current!.getBoundingClientRect();
        const popoverWidth = 360;
        const btnCenterX = (btnRect.left - tbRect.left) + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, tbRect.width - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setSettingsPopoverPos({
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      return () => window.removeEventListener('resize', updatePos);
    }
  }, [showSettingsPopover]);

  // 点击外部关闭旋转浮窗
  useEffect(() => {
    if (activeTool !== 'rotate') return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const path = (e.composedPath ? e.composedPath() : []) as Node[];
      const inPopover = rotatePopoverRef.current && (path.includes(rotatePopoverRef.current) || rotatePopoverRef.current.contains(e.target as Node));
      const inBtn = rotateBtnRef.current && (path.includes(rotateBtnRef.current) || rotateBtnRef.current.contains(e.target as Node));

      if (!inPopover && !inBtn) {
        setRotationAngle(0);
        setActiveTool(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activeTool, setRotationAngle, setActiveTool]);

  // 点击外部关闭设置浮窗
  useEffect(() => {
    if (!showSettingsPopover) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const path = (e.composedPath ? e.composedPath() : []) as Node[];
      const inPopover = settingsPopoverRef.current && (path.includes(settingsPopoverRef.current) || settingsPopoverRef.current.contains(e.target as Node));
      const inBtn = settingsBtnRef.current && (path.includes(settingsBtnRef.current) || settingsBtnRef.current.contains(e.target as Node));

      if (!inPopover && !inBtn) {
        setShowSettingsPopover(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showSettingsPopover]);

  // 计算各个分组是否有可见工具（用于整组容器的自适应渲染）
  const hasSelectionTools = 
    visibleTools.has('rect') || 
    visibleTools.has('cropAuto') || 
    visibleTools.has('lasso') || 
    visibleTools.has('quad') || 
    visibleTools.has('invert') || 
    visibleTools.has('clear');

  const hasWandTools = 
    visibleTools.has('alphaMask') || 
    visibleTools.has('wand') || 
    visibleTools.has('wandMode') || 
    visibleTools.has('tolerance');

  const hasColorTools = visibleTools.has('colorPicker') || visibleTools.has('pipette');

  const hasActionTools = visibleTools.has('crop') || visibleTools.has('fill') || visibleTools.has('erase') || visibleTools.has('hd');

  const hasTransformTools = 
    visibleTools.has('flipH') || 
    visibleTools.has('flipV') || 
    visibleTools.has('rotateCcw') || 
    visibleTools.has('rotateCw') || 
    visibleTools.has('rotateAny');

  return (
    <div ref={toolbarRef} className={`relative flex items-center justify-between ${isCompact ? 'p-1.5 bg-slate-900/90 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-white/20' : 'h-10 px-2 bg-white/90 backdrop-blur-md border-b border-slate-200 z-30 shrink-0 text-slate-800'}`}>
      {/* 标题 & Logo (弹窗与分布式模式显示) */}
      {!isCompact && (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-900 flex items-center justify-center shadow-lg transform rotate-3 shrink-0 rounded-lg">
            <Sparkles size={12} className="text-white" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 leading-none">
            <h1 className="text-[11px] font-black text-slate-900 tracking-tight">AI编辑器</h1>
            <span className="inline-block text-[8px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded border border-emerald-300 shadow-sm leading-none">{version}</span>
          </div>
        </div>
      )}

      {/* 核心编辑工具组 */}
      <div className="flex items-center gap-1 mx-2 overflow-x-auto no-scrollbar max-w-[85%]">
        {currentImage && (
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
                    className={`p-1.5 rounded-md transition-all ${activeTool === 'wand' ? 'bg-blue-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-500 hover:bg-white hover:text-blue-600'}`} 
                    title="魔棒选色 (点击图片中需要抠除的颜色)"
                  >
                    <Wand2 size={12} />
                  </button>
                )}

                {/* 全屏匹配 vs 连通区域 */}
                {visibleTools.has('wandMode') && (
                  <button 
                    onClick={() => setSelectionMode(m => m === 'global' ? 'connected' : 'global')} 
                    className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded transition-colors ${selectionMode === 'connected' ? 'bg-blue-600 text-white shadow-sm' : isCompact ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
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
                      className="w-12 h-1 bg-slate-300 appearance-none cursor-pointer accent-blue-600 rounded-lg" 
                    />
                  </div>
                )}
              </div>
            )}

            {/* 3. 色卡 + 取色吸管 */}
            {hasColorTools && (
              <div className={`flex items-center p-0.5 border gap-1 shrink-0 rounded-lg shadow-inner ml-1 ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                {visibleTools.has('colorPicker') && (
                  <div className="relative flex items-center px-1" title="选择着色颜色">
                    <input 
                      type="color" 
                      value={fillColor} 
                      onChange={(e) => setFillColor(e.target.value)} 
                      className="w-5 h-5 border-0 p-0 cursor-pointer opacity-0 absolute inset-0 z-10" 
                    />
                    <div className="w-5 h-5 rounded border border-white/50 shadow-sm" style={{ backgroundColor: fillColor }} />
                  </div>
                )}
                {visibleTools.has('pipette') && (
                  <button 
                    onClick={() => setActiveTool(activeTool === 'pipette' ? null : 'pipette')} 
                    className={`p-1.5 rounded-md transition-all ${activeTool === 'pipette' ? 'bg-blue-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-blue-400' : 'text-slate-500 hover:bg-white hover:text-blue-600'}`} 
                    title="吸管取色"
                  >
                    <Pipette size={12} />
                  </button>
                )}
              </div>
            )}

            {/* 4. 独立选区执行操作组: 剪裁 & 油漆桶着色 */}
            {hasActionTools && (
              <div className={`flex items-center p-0.5 border gap-1 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                {visibleTools.has('crop') && (
                  <button 
                    onClick={handleCropSelection} 
                    disabled={!hasSelection} 
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      hasSelection 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95' 
                        : 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400'
                    }`} 
                    title={hasSelection ? "按选区剪裁" : "无选区 (无法剪裁)"}
                  >
                    <Scissors size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">剪裁</span>
                  </button>
                )}

                {visibleTools.has('fill') && (
                  <button 
                    onClick={handleFillSelection} 
                    disabled={!hasSelection} 
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      hasSelection 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95' 
                        : 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400'
                    }`} 
                    title={hasSelection ? "在选区内着色" : "无选区 (无法着色)"}
                  >
                    <PaintBucket size={12} />
                    <span className="text-[10px] font-bold">着色</span>
                  </button>
                )}

                {visibleTools.has('erase') && (
                  <button 
                    onClick={handleEraseSelection || applyWandCutout} 
                    disabled={!hasSelection || isLoading} 
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      hasSelection && !isLoading
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-95 cursor-pointer' 
                        : 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400'
                    }`} 
                    title={hasSelection ? "擦除选区内容为透明区域 (支持魔棒、矩形、套索、多边形)" : "无选区 (请先通过魔棒、矩形、套索或多边形框选)"}
                  >
                    <Eraser size={12} />
                    <span className="text-[10px] font-bold">擦除</span>
                  </button>
                )}

                {visibleTools.has('hd') && (
                  <button 
                    onClick={() => setActiveTool(activeTool === 'hd' ? null : 'hd')} 
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      activeTool === 'hd' 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-95' 
                        : isCompact
                          ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          : 'text-slate-600 hover:bg-white hover:text-amber-600'
                    }`} 
                    title="稀疏高清重构 (等比拖拽外框 8 点控制放大，松开自动高清化)"
                  >
                    <Sparkles size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">高清</span>
                  </button>
                )}
              </div>
            )}

            {/* 5. 旋转变换工具组 */}
            {hasTransformTools && (
              <div className={`relative flex items-center p-0.5 border gap-0.5 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                {visibleTools.has('flipH') && (
                  <button 
                    onClick={handleFlipHorizontal} 
                    className={`p-1.5 rounded-md transition-all ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="水平镜像翻转"
                  >
                    <FlipHorizontal2 size={12} />
                  </button>
                )}

                {visibleTools.has('flipV') && (
                  <button 
                    onClick={handleFlipVertical} 
                    className={`p-1.5 rounded-md transition-all ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="垂直镜像翻转"
                  >
                    <FlipVertical2 size={12} />
                  </button>
                )}

                {(visibleTools.has('flipH') || visibleTools.has('flipV')) && 
                 (visibleTools.has('rotateCcw') || visibleTools.has('rotateCw') || visibleTools.has('rotateAny')) && (
                  <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />
                )}

                {visibleTools.has('rotateCcw') && (
                  <button 
                    onClick={() => handleRotate90('ccw')} 
                    className={`p-1.5 rounded-md transition-all ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="逆时针旋转 90°"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}

                {visibleTools.has('rotateCw') && (
                  <button 
                    onClick={() => handleRotate90('cw')} 
                    className={`p-1.5 rounded-md transition-all ${isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="顺时针旋转 90°"
                  >
                    <RotateCw size={12} />
                  </button>
                )}

                {(visibleTools.has('rotateCcw') || visibleTools.has('rotateCw')) && visibleTools.has('rotateAny') && (
                  <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />
                )}

                {/* 任意角度浮窗开关 */}
                {visibleTools.has('rotateAny') && (
                  <button 
                    ref={rotateBtnRef}
                    data-rotate-trigger="true"
                    onClick={handleToggleRotatePopover} 
                    className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all ${activeTool === 'rotate' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="任意角度旋转 (控制圆盘与滑杆)"
                  >
                    <Compass size={12} />
                    <span className="text-[10px] font-bold">{rotationAngle !== 0 ? `${((rotationAngle % 360) + 360) % 360}°` : '旋转'}</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右侧动作按钮组 (下载、上传、设置、完成与取消) */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {/* 本地下载 */}
        {currentImage && visibleTools.has('download') && (
          <button 
            onClick={() => { 
              const l = document.createElement('a'); 
              l.href = currentImage; 
              l.download = 'output.png'; 
              l.click(); 
            }} 
            className={`p-1.5 rounded-lg shadow-sm transition-colors ${isCompact ? 'bg-slate-800 text-slate-300 hover:text-blue-400' : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-600'}`} 
            title="保存到本地"
          >
            <Download size={14} />
          </button>
        )}

        {/* 重新上传 */}
        {!isCompact && visibleTools.has('upload') && (
          <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white cursor-pointer font-bold text-[10px] active:scale-95 shrink-0 shadow-md rounded-lg hover:bg-slate-800">
            <Upload size={12} /> 
            <span className="hidden sm:inline">重新上传</span>
            <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
          </label>
        )}

        {/* 工具栏设置按钮 (全新增加：点击弹开界面选择哪些按钮显示/隐藏) */}
        {visibleTools.has('settings') && (
          <button
            ref={settingsBtnRef}
            onClick={() => setShowSettingsPopover(p => !p)}
            className={`p-1.5 rounded-lg shadow-sm transition-all ${
              showSettingsPopover 
                ? 'bg-indigo-600 text-white shadow-md' 
                : isCompact 
                  ? 'bg-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-slate-700' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50'
            }`}
            title="工具栏设置 (自定义哪些按钮显示或隐藏)"
          >
            <Settings size={14} />
          </button>
        )}

        {/* SDK 完成返回原应用按钮 */}
        {showComplete && currentImage && (
          <button
            onClick={handleDoneClick}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] active:scale-95 shrink-0 shadow-md rounded-lg transition-all"
            title="完成编辑并返回原应用"
          >
            <Check size={13} strokeWidth={3} />
            <span>完成</span>
          </button>
        )}

        {/* SDK 取消按钮 */}
        {showCancel && (
          <button
            onClick={handleCancelClick}
            className={`p-1.5 rounded-lg transition-colors ${isCompact ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400' : 'bg-white hover:bg-red-50 border border-slate-200 text-slate-400 hover:text-red-500'}`}
            title="取消并关闭"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 任意角度旋转控制浮窗 */}
      {activeTool === 'rotate' && (
        <RotationPopover
          angle={rotationAngle}
          onChange={(val) => setRotationAngle(val)}
          onApply={() => handleApplyRotation()}
          onReset={() => {
            setRotationAngle(0);
            setActiveTool(null);
          }}
          left={rotatePopoverPos.left}
          arrowOffset={rotatePopoverPos.arrowOffset}
          popoverRef={rotatePopoverRef}
          isCompact={isCompact}
        />
      )}

      {/* 工具栏按钮显示设置浮窗 (工具栏设置) */}
      {showSettingsPopover && (
        <ToolbarSettingsPopover
          visibleTools={visibleTools}
          onToggleTool={handleToggleTool}
          onSetTools={handleSetTools}
          onClose={() => setShowSettingsPopover(false)}
          left={settingsPopoverPos.left}
          arrowOffset={settingsPopoverPos.arrowOffset}
          popoverRef={settingsPopoverRef}
          isCompact={isCompact}
        />
      )}
    </div>
  );
};
