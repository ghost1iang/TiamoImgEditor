import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  X, 
  Sparkles,
  Scissors,
  Wand2,
  Settings,
  Scan,
  Focus,
  SunMedium,
  CircleDot,
  ImagePlus,
  Maximize2,
  Check,
  Trash2,
  Layers,
  SquareDashed,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';
import { ToolbarToolId, resolveVisibleTools } from '../types/toolbar';
import { ToolbarSettingsPopover } from './ToolbarSettingsPopover';

interface RotationPopoverProps {
  angle: number;
  onChange: (a: number) => void;
  onApply: () => void;
  onReset: () => void;
  top: number;
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
  top,
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
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 1000000,
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

interface SpillRadiusPopoverProps {
  radius: number;
  maxRadius: number;
  onChange: (r: number) => void;
  onClose: () => void;
  top: number;
  left: number;
  arrowOffset: number;
  popoverRef: React.RefObject<HTMLDivElement>;
  isCompact?: boolean;
}

const SpillRadiusPopover: React.FC<SpillRadiusPopoverProps> = ({
  radius,
  maxRadius,
  onChange,
  onClose,
  top,
  left,
  arrowOffset,
  popoverRef,
  isCompact = false,
}) => {
  const isAll = radius >= maxRadius;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 1000000,
      }}
      className={`w-[270px] rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none backdrop-blur-xl ${
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
          left: `${Math.max(14, Math.min(arrowOffset, 256))}px`,
          transform: 'translateX(-50%) rotate(45deg)',
        }}
      />

      {/* 头部标题与关闭 */}
      <div className={`w-full flex items-center justify-between pb-1 border-b text-xs font-bold ${
        isCompact ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        <span className="flex items-center gap-1.5 text-indigo-600">
          <CircleDot size={13} />
          <span>去色边影响范围</span>
        </span>
        <button
          onClick={onClose}
          className={`p-0.5 rounded transition-colors ${
            isCompact ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="关闭"
        >
          <X size={13} />
        </button>
      </div>

      {/* 快捷档位预设 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(1)}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
            radius === 1
              ? 'bg-indigo-600 text-white shadow-sm'
              : isCompact
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="微羽化边缘（1像素）"
        >
          1 像素
        </button>
        <button
          type="button"
          onClick={() => onChange(3)}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
            radius === 3
              ? 'bg-indigo-600 text-white shadow-sm'
              : isCompact
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="标准去绿边推荐（3像素）"
        >
          3 像素 (推荐)
        </button>
        <button
          type="button"
          onClick={() => onChange(maxRadius)}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
            isAll
              ? 'bg-indigo-600 text-white shadow-sm'
              : isCompact
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title="全图所有同色相像素（Max）"
        >
          全图 (Max)
        </button>
      </div>

      {/* 拉把滑块控制 */}
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>拉把调节 (1 ~ {maxRadius}px)</span>
          <span className="font-mono text-indigo-500 font-bold">{isAll ? '全图' : `${radius}px`}</span>
        </div>
        <input
          type="range"
          min="1"
          max={maxRadius}
          value={Math.min(radius, maxRadius)}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>

      {/* 直接输入框 */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[11px] text-slate-500 font-medium">直接输入数值:</span>
        <div className={`flex items-center border rounded-lg px-2 py-0.5 ${
          isCompact ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <input
            type="number"
            min="0"
            max={maxRadius}
            value={radius}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onChange(isNaN(val) ? 0 : Math.max(0, Math.min(maxRadius, val)));
            }}
            className="w-16 text-[12px] font-black text-center bg-transparent outline-none"
          />
          <span className="text-[10px] text-slate-400 font-bold">px</span>
        </div>
      </div>

      {/* 提示文案 */}
      <div className="flex items-start gap-1.5 text-[9px] text-slate-400 leading-tight border-t border-slate-100 dark:border-slate-800 pt-1.5">
        {isAll ? (
          <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <Check size={11} className="text-emerald-500 shrink-0 mt-0.5" />
        )}
        <span>
          {isAll
            ? '当前为全图模式，全屏所有符合色相特征的像素均会受到消色边影响。'
            : `橡皮擦擦除时，仅对交界处外沿 ${radius} 像素过渡带消解背景溢色，保护主体内部颜色不受影响。`}
        </span>
      </div>
    </div>
  );
};

interface BorderWidthPopoverProps {
  borderWidth: number;
  onChange: (w: number) => void;
  onClose: () => void;
  top: number;
  left: number;
  arrowOffset: number;
  popoverRef: React.RefObject<HTMLDivElement>;
  isCompact?: boolean;
}

const BorderWidthPopover: React.FC<BorderWidthPopoverProps> = ({
  borderWidth,
  onChange,
  onClose,
  top,
  left,
  arrowOffset,
  popoverRef,
  isCompact = false,
}) => {
  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 1000000,
      }}
      className={`w-[260px] rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none backdrop-blur-xl ${
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
          left: `${Math.max(14, Math.min(arrowOffset, 246))}px`,
          transform: 'translateX(-50%) rotate(45deg)',
        }}
      />

      {/* 头部标题与关闭 */}
      <div className={`w-full flex items-center justify-between pb-1 border-b text-xs font-bold ${
        isCompact ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        <span className="flex items-center gap-1.5 text-indigo-600">
          <SquareDashed size={13} />
          <span>边框宽度调节</span>
        </span>
        <button
          onClick={onClose}
          className={`p-0.5 rounded transition-colors ${
            isCompact ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="关闭"
        >
          <X size={13} />
        </button>
      </div>

      {/* 主体拉把调节区 */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className={isCompact ? 'text-slate-400' : 'text-slate-500'}>
            边框宽度 (PX)
          </span>
          <span className="font-mono text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded text-[11px] border border-indigo-200/50 dark:border-indigo-800/50">
            {borderWidth} PX
          </span>
        </div>

        {/* 滑动拉把 */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="range"
            min="1"
            max="64"
            step="1"
            value={borderWidth}
            onChange={(e) => onChange(Number(e.target.value) || 1)}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {/* 预设快捷尺寸 */}
        <div className="flex items-center justify-between gap-1 pt-1.5">
          {[2, 4, 8, 12, 16, 24, 32].map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => onChange(sz)}
              className={`flex-1 py-0.5 text-[10px] font-mono rounded border transition-all ${
                borderWidth === sz
                  ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                  : isCompact
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* 说明文案 */}
      <div className={`text-[10px] leading-relaxed pt-1 border-t ${
        isCompact ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-400'
      }`}>
        沿着有效像素最外层轮廓向外延展添加指定宽度的平滑边框。
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
    currentImage,
    activeTool,
    setActiveTool,
    isRegionInverted,
    toggleInvertSelection,
    clearSelection,
    setQuadPoints,
    isPolyClosed,
    setIsPolyClosed,
    showAlphaMask,
    setShowAlphaMask,
    selectionMode,
    setSelectionMode,
    tolerance,
    setTolerance,
    spillRadius,
    setSpillRadius,
    imageRef,
    handleCropTransparency,
    handleAutoDetectOrtho,
    handleApplyDeShadow,
    fillColor,
    setFillColor,
    borderColor,
    setBorderColor,
    borderWidth,
    setBorderWidth,
    handleApplyBorder,
    hasSelection,
    handleFillSelection,
    handleCropSelection,
    rotationAngle,
    setRotationAngle,
    handleApplyRotation,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    handleEraseSelection,
    applyWandCutout,
    importedGraphics,
    baseLayerIndex,
    selectedGraphicId,
    setSelectedGraphicId,
    handleImportGraphicFile,
    handleTriggerImportGraphic,
    hasCustomImportGraphicHandler,
    handleGraphicFlip,
    handleGraphicRotate90,
    handleGraphicLayerOrder,
    handleLockSelectedGraphic,
    handleUnlockAllGraphics,
    handleDeleteSelectedGraphic,
    commitImportedGraphics,
    handleExpandCanvas,
    isLoading,
    handleFinish: coreFinish,
    handleCancel: coreCancel,
  } = core;

  const handleFinishClick = onFinish || coreFinish;
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

  // 支持外部事件（如导航栏设置）全局动态更新可见工具与浮窗切换
  useEffect(() => {
    const handleSetVisibleToolsEvent = (e: any) => {
      if (e && e.detail) {
        const toolsList = Array.isArray(e.detail) ? e.detail : Array.from(e.detail);
        setVisibleTools(new Set(toolsList as ToolbarToolId[]));
      }
    };
    const handleToggleSettingsEvent = () => {
      setShowSettingsPopover((p) => !p);
    };

    window.addEventListener('tiamo-set-visible-tools', handleSetVisibleToolsEvent as EventListener);
    window.addEventListener('tiamo-toggle-toolbar-settings', handleToggleSettingsEvent as EventListener);
    return () => {
      window.removeEventListener('tiamo-set-visible-tools', handleSetVisibleToolsEvent as EventListener);
      window.removeEventListener('tiamo-toggle-toolbar-settings', handleToggleSettingsEvent as EventListener);
    };
  }, []);

  // ----------------------------------------------------
  // 2. 旋转浮窗与设置浮窗定位控制 (Portal + Fixed 视口坐标，彻底突破宿主 overflow/backdrop-filter 裁剪)
  // ----------------------------------------------------
  const toolbarRef = useRef<HTMLDivElement>(null);
  const rotateBtnRef = useRef<HTMLButtonElement>(null);
  const rotatePopoverRef = useRef<HTMLDivElement>(null);
  const [rotatePopoverPos, setRotatePopoverPos] = useState<{ top: number; left: number; arrowOffset: number }>({ top: 0, left: 0, arrowOffset: 130 });

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [settingsPopoverPos, setSettingsPopoverPos] = useState<{ top: number; left: number; arrowOffset: number }>({ top: 0, left: 0, arrowOffset: 160 });

  const spillRadiusBtnRef = useRef<HTMLButtonElement>(null);
  const spillRadiusPopoverRef = useRef<HTMLDivElement>(null);
  const [showSpillRadiusPopover, setShowSpillRadiusPopover] = useState(false);
  const [spillRadiusPopoverPos, setSpillRadiusPopoverPos] = useState<{ top: number; left: number; arrowOffset: number }>({ top: 0, left: 0, arrowOffset: 135 });

  const borderWidthBtnRef = useRef<HTMLButtonElement>(null);
  const borderWidthPopoverRef = useRef<HTMLDivElement>(null);
  const [showBorderWidthPopover, setShowBorderWidthPopover] = useState(false);
  const [borderWidthPopoverPos, setBorderWidthPopoverPos] = useState<{ top: number; left: number; arrowOffset: number }>({ top: 0, left: 0, arrowOffset: 130 });

  const importGraphicInputRef = useRef<HTMLInputElement>(null);

  const getPopoverPortalTarget = (): HTMLElement => {
    const root = toolbarRef.current?.getRootNode();
    if (root && typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
      return (root.querySelector('div') as HTMLElement) || document.body;
    }
    return document.body;
  };

  const handleToggleRotatePopover = () => {
    if (activeTool === 'rotate') {
      setActiveTool(null);
    } else {
      setActiveTool('rotate');
    }
  };

  // 旋转浮窗位置自适应 (基于视口 fixed 坐标 + 监听横向滚动)
  useEffect(() => {
    if (activeTool === 'rotate' && rotateBtnRef.current) {
      const updatePos = () => {
        if (!rotateBtnRef.current) return;
        const btnRect = rotateBtnRef.current.getBoundingClientRect();
        const popoverWidth = 264;
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const btnCenterX = btnRect.left + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, viewportW - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setRotatePopoverPos({
          top: btnRect.bottom + 8,
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
    }
  }, [activeTool]);

  // 设置浮窗位置自适应 (基于视口 fixed 坐标 + 监听横向滚动)
  useEffect(() => {
    if (showSettingsPopover && settingsBtnRef.current) {
      const updatePos = () => {
        if (!settingsBtnRef.current) return;
        const btnRect = settingsBtnRef.current.getBoundingClientRect();
        const popoverWidth = Math.min(360, (window.innerWidth || 360) * 0.92);
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const btnCenterX = btnRect.left + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, viewportW - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setSettingsPopoverPos({
          top: btnRect.bottom + 8,
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
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

  // 影响范围浮窗位置自适应 (基于视口 fixed 坐标 + 监听横向滚动)
  useEffect(() => {
    if (showSpillRadiusPopover && spillRadiusBtnRef.current) {
      const updatePos = () => {
        if (!spillRadiusBtnRef.current) return;
        const btnRect = spillRadiusBtnRef.current.getBoundingClientRect();
        const popoverWidth = 270;
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const btnCenterX = btnRect.left + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, viewportW - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setSpillRadiusPopoverPos({
          top: btnRect.bottom + 8,
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
    }
  }, [showSpillRadiusPopover]);

  // 点击外部关闭影响范围浮窗
  useEffect(() => {
    if (!showSpillRadiusPopover) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const path = (e.composedPath ? e.composedPath() : []) as Node[];
      const inPopover = spillRadiusPopoverRef.current && (path.includes(spillRadiusPopoverRef.current) || spillRadiusPopoverRef.current.contains(e.target as Node));
      const inBtn = spillRadiusBtnRef.current && (path.includes(spillRadiusBtnRef.current) || spillRadiusBtnRef.current.contains(e.target as Node));

      if (!inPopover && !inBtn) {
        setShowSpillRadiusPopover(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showSpillRadiusPopover]);

  // 边框宽度拉把浮窗位置自适应
  useEffect(() => {
    if (showBorderWidthPopover && borderWidthBtnRef.current) {
      const updatePos = () => {
        if (!borderWidthBtnRef.current) return;
        const btnRect = borderWidthBtnRef.current.getBoundingClientRect();
        const popoverWidth = 260;
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        const btnCenterX = btnRect.left + btnRect.width / 2;
        let left = btnCenterX - popoverWidth / 2;
        const maxLeft = Math.max(8, viewportW - popoverWidth - 8);
        left = Math.max(8, Math.min(left, maxLeft));
        setBorderWidthPopoverPos({
          top: btnRect.bottom + 8,
          left,
          arrowOffset: btnCenterX - left,
        });
      };
      updatePos();
      window.addEventListener('resize', updatePos);
      window.addEventListener('scroll', updatePos, true);
      return () => {
        window.removeEventListener('resize', updatePos);
        window.removeEventListener('scroll', updatePos, true);
      };
    }
  }, [showBorderWidthPopover]);

  // 点击外部关闭边框宽度浮窗
  useEffect(() => {
    if (!showBorderWidthPopover) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const path = (e.composedPath ? e.composedPath() : []) as Node[];
      const inPopover = borderWidthPopoverRef.current && (path.includes(borderWidthPopoverRef.current) || borderWidthPopoverRef.current.contains(e.target as Node));
      const inBtn = borderWidthBtnRef.current && (path.includes(borderWidthBtnRef.current) || borderWidthBtnRef.current.contains(e.target as Node));

      if (!inPopover && !inBtn) {
        setShowBorderWidthPopover(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showBorderWidthPopover]);

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
    visibleTools.has('tolerance') ||
    visibleTools.has('spillRadius');

  const maxImgDimension = Math.max(
    imageRef.current?.naturalWidth || 2000,
    imageRef.current?.naturalHeight || 2000
  );

  const hasColorTools = visibleTools.has('colorPicker') || visibleTools.has('pipette');

  const hasBorderTools = visibleTools.has('border');

  const hasActionTools = visibleTools.has('crop') || visibleTools.has('fill') || visibleTools.has('erase') || visibleTools.has('hd') || visibleTools.has('importGraphic') || visibleTools.has('expandCanvas');

  const hasTransformTools = 
    visibleTools.has('flipH') || 
    visibleTools.has('flipV') || 
    visibleTools.has('rotateCcw') || 
    visibleTools.has('rotateCw') || 
    visibleTools.has('rotateAny') ||
    visibleTools.has('ortho') ||
    visibleTools.has('orthoAuto') ||
    visibleTools.has('deShadow');

  const selectedGraphicIndex = selectedGraphicId
    ? importedGraphics.findIndex((g) => g.id === selectedGraphicId)
    : -1;
  const selectedGraphic = selectedGraphicIndex !== -1 ? importedGraphics[selectedGraphicIndex] : null;
  const clampedBaseIdx = Math.max(0, Math.min(importedGraphics.length, baseLayerIndex ?? 0));
  const selectedStackPos =
    selectedGraphicIndex !== -1
      ? selectedGraphicIndex < clampedBaseIdx
        ? selectedGraphicIndex
        : selectedGraphicIndex + 1
      : -1;
  const isGraphicAtTop = selectedStackPos === importedGraphics.length;
  const isGraphicAtBottom = selectedStackPos === 0;
  const lockedCount = importedGraphics.filter((g) => !!g.locked).length;

  useEffect(() => {
    if (selectedGraphicId) {
      setShowSpillRadiusPopover(false);
      setShowBorderWidthPopover(false);
    }
  }, [selectedGraphicId]);

  const triggerImportGraphic = () => {
    if (hasCustomImportGraphicHandler) {
      void handleTriggerImportGraphic();
    } else {
      importGraphicInputRef.current?.click();
    }
  };

  // 载入图片后，工具栏与其包含的全部SDK按钮（含工具栏设置）才一并出现
  if (!currentImage) {
    return null;
  }

  return (
    <div ref={toolbarRef} className={`relative flex items-center justify-between ${isCompact ? 'p-1.5 bg-slate-900/90 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-white/20' : 'h-10 px-2 bg-white/90 backdrop-blur-md border-b border-slate-200 z-30 shrink-0 text-slate-800'}`}>
      {/* 隐藏文件选择器（普通模式与选中图形模式共用） */}
      <input
        ref={importGraphicInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportGraphicFile(file);
          }
          e.target.value = '';
        }}
      />

      {/* 核心编辑工具组：选中导入图形时切换为仅对其生效的上下文工具栏，失焦后恢复原始工具栏 */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 mr-2">
        {selectedGraphic ? (
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
                    <span className={`px-1 py-0.2 rounded text-[10px] font-mono ${
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
        ) : (
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
                    className={`p-1.5 rounded-md transition-all ${activeTool === 'pipette' ? 'bg-indigo-600 text-white shadow-md' : isCompact ? 'text-slate-300 hover:bg-slate-700 hover:text-indigo-400' : 'text-slate-500 hover:bg-white hover:text-indigo-600'}`} 
                    title="吸管取色"
                  >
                    <Pipette size={12} />
                  </button>
                )}
              </div>
            )}

            {/* 4. 独立选区执行操作组: 剪裁 & 油漆桶着色 */}
            {(hasActionTools || lockedCount > 0) && (
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
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95' 
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
                    title="稀疏高清重构 (四角固定比例缩放，左右调宽、上下调高，松开自动高清化)"
                  >
                    <Sparkles size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">高清</span>
                  </button>
                )}

                {visibleTools.has('importGraphic') && (
                  <button
                    type="button"
                    onClick={triggerImportGraphic}
                    disabled={isLoading}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      isCompact
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'text-slate-600 hover:bg-white hover:text-indigo-600'
                    }`}
                    title="导入图形 (导入新图片并叠加在画布上，支持 8 点触控吸附缩放、吸附移动、镜像及正负 90° 旋转)"
                  >
                    <ImagePlus size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">导入图形</span>
                  </button>
                )}

                {visibleTools.has('expandCanvas') && (
                  <button
                    type="button"
                    onClick={handleExpandCanvas}
                    disabled={importedGraphics.length === 0 || isLoading}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                      importedGraphics.length > 0 && !isLoading
                        ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md active:scale-95 cursor-pointer'
                        : 'opacity-30 cursor-not-allowed pointer-events-none text-slate-400'
                    }`}
                    title={importedGraphics.length > 0 ? "扩展画布 (将所有元素的外边框取最大值生成新的画布)" : "请先导入图形后再扩展画布"}
                  >
                    <Maximize2 size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">扩展画布</span>
                  </button>
                )}

                {lockedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleUnlockAllGraphics}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                    title={`画布中有 ${lockedCount} 个已锁定图层（不响应鼠标），点击全部解锁恢复编辑`}
                  >
                    <Unlock size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">解锁({lockedCount})</span>
                  </button>
                )}
              </div>
            )}

            {/* 边框功能组 */}
            {hasBorderTools && (
              <div className={`flex items-center p-0.5 border gap-1 shrink-0 rounded-lg shadow-inner ${isCompact ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                {/* 1. 颜色选择（复用铺色的色彩选择界面） */}
                <div className="relative flex items-center px-1" title="选择边框颜色">
                  <input 
                    type="color" 
                    value={borderColor} 
                    onChange={(e) => setBorderColor(e.target.value)} 
                    className="w-5 h-5 border-0 p-0 cursor-pointer opacity-0 absolute inset-0 z-10" 
                  />
                  <div className="w-5 h-5 rounded border border-white/50 shadow-sm" style={{ backgroundColor: borderColor }} />
                </div>

                {/* 2. 宽度显示 "xx PX"，点击后出现拉把 */}
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
                  <span className={`px-1 py-0.2 rounded text-[10px] font-mono ${
                    showBorderWidthPopover
                      ? 'bg-indigo-700 text-white'
                      : isCompact
                        ? 'bg-slate-800 text-indigo-400'
                        : 'bg-slate-100 text-indigo-600 border border-indigo-100'
                  }`}>
                    {borderWidth} PX
                  </span>
                </button>

                {/* 3. 执行添加边框按钮 */}
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
                  title="沿着有效像素最外层添加指定宽度与颜色的边框"
                >
                  <SquareDashed size={12} strokeWidth={2.5} />
                  <span className="text-[10px] font-bold">边框</span>
                </button>
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

                {((visibleTools.has('rotateCcw') || visibleTools.has('rotateCw') || visibleTools.has('rotateAny') || visibleTools.has('flipH') || visibleTools.has('flipV')) && (visibleTools.has('ortho') || visibleTools.has('orthoAuto') || visibleTools.has('deShadow'))) && (
                  <div className={`w-px h-3 mx-0.5 ${isCompact ? 'bg-slate-700' : 'bg-slate-300'}`} />
                )}

                {/* 矩形正交化校正按钮 */}
                {visibleTools.has('ortho') && (
                  <button 
                    onClick={() => setActiveTool(activeTool === 'ortho' ? null : 'ortho')} 
                    className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all ${
                      activeTool === 'ortho' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : isCompact 
                          ? 'text-slate-300 hover:bg-slate-700 hover:text-white' 
                          : 'text-slate-500 hover:bg-white hover:text-indigo-600'
                    }`} 
                    title="矩形正交化 (四角顶点对齐与透视正交平面校正)"
                  >
                    <Scan size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">正交化</span>
                  </button>
                )}

                {/* 智能寻角 (自动识别画面矩形物体的4个推荐顶点并进入正交模式) */}
                {visibleTools.has('orthoAuto') && (
                  <button 
                    onClick={handleAutoDetectOrtho} 
                    disabled={isLoading}
                    className={`p-1.5 transition-all rounded-md ${
                      isCompact 
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white' 
                        : 'text-slate-500 hover:bg-white hover:text-indigo-600'
                    }`} 
                    title="智能寻角 (自动识别画面矩形物体的4个推荐顶点并进入正交模式)"
                  >
                    <Focus size={12} strokeWidth={2.5} />
                  </button>
                )}

                {/* 白化去影净化按钮 */}
                {visibleTools.has('deShadow') && (
                  <button 
                    onClick={handleApplyDeShadow} 
                    disabled={isLoading}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-all ${
                      isCompact 
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white' 
                        : 'text-slate-500 hover:bg-white hover:text-amber-600'
                    }`} 
                    title="白化去影 (光照估计除法消除拍摄纸张的不均匀阴影与暗角，平底白化并保留彩色文字与印章)"
                  >
                    <SunMedium size={12} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">去阴影</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右侧动作按钮组 (设置、完成与取消) */}
      {(visibleTools.has('settings') || showComplete || showCancel) && (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* 工具栏设置按钮 (SDK内置工具) */}
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

          {/* SDK 完成按钮 */}
          {showComplete && (
            <button
              type="button"
              onClick={handleFinishClick}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
              title="完成编辑并保存返回结果"
            >
              <Check size={13} strokeWidth={2.5} />
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
      )}

      {/* 任意角度旋转控制浮窗 (Portal 脱离父级 overflow 裁剪) */}
      {activeTool === 'rotate' && createPortal(
        <RotationPopover
          angle={rotationAngle}
          onChange={(val) => setRotationAngle(val)}
          onApply={() => handleApplyRotation()}
          onReset={() => {
            setRotationAngle(0);
            setActiveTool(null);
          }}
          top={rotatePopoverPos.top}
          left={rotatePopoverPos.left}
          arrowOffset={rotatePopoverPos.arrowOffset}
          popoverRef={rotatePopoverRef}
          isCompact={isCompact}
        />,
        getPopoverPortalTarget()
      )}

      {/* 去色边影响范围控制浮窗 (Portal 脱离父级 overflow 裁剪) */}
      {showSpillRadiusPopover && createPortal(
        <SpillRadiusPopover
          radius={spillRadius}
          maxRadius={maxImgDimension}
          onChange={(val) => setSpillRadius(val)}
          onClose={() => setShowSpillRadiusPopover(false)}
          top={spillRadiusPopoverPos.top}
          left={spillRadiusPopoverPos.left}
          arrowOffset={spillRadiusPopoverPos.arrowOffset}
          popoverRef={spillRadiusPopoverRef}
          isCompact={isCompact}
        />,
        getPopoverPortalTarget()
      )}

      {/* 边框宽度拉把浮窗 (Portal 脱离父级 overflow 裁剪) */}
      {showBorderWidthPopover && createPortal(
        <BorderWidthPopover
          borderWidth={borderWidth}
          onChange={(val) => setBorderWidth(val)}
          onClose={() => setShowBorderWidthPopover(false)}
          top={borderWidthPopoverPos.top}
          left={borderWidthPopoverPos.left}
          arrowOffset={borderWidthPopoverPos.arrowOffset}
          popoverRef={borderWidthPopoverRef}
          isCompact={isCompact}
        />,
        getPopoverPortalTarget()
      )}

      {/* 工具栏按钮显示设置浮窗 (Portal 脱离父级 overflow 裁剪) */}
      {showSettingsPopover && createPortal(
        <ToolbarSettingsPopover
          visibleTools={visibleTools}
          onToggleTool={handleToggleTool}
          onSetTools={handleSetTools}
          onClose={() => setShowSettingsPopover(false)}
          top={settingsPopoverPos.top}
          left={settingsPopoverPos.left}
          arrowOffset={settingsPopoverPos.arrowOffset}
          popoverRef={settingsPopoverRef}
          isCompact={isCompact}
        />,
        getPopoverPortalTarget()
      )}
    </div>
  );
};
