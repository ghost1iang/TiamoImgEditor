import React from 'react';
import {
  X,
  Compass,
  CircleDot,
  AlertTriangle,
  Check,
  SquareDashed,
} from 'lucide-react';

export interface RotationPopoverProps {
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

export const RotationPopover: React.FC<RotationPopoverProps> = ({
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

export interface SpillRadiusPopoverProps {
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

export const SpillRadiusPopover: React.FC<SpillRadiusPopoverProps> = ({
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

export interface BorderWidthPopoverProps {
  borderWidth: number;
  onChange: (w: number) => void;
  onClose: () => void;
  top: number;
  left: number;
  arrowOffset: number;
  popoverRef: React.RefObject<HTMLDivElement>;
  isCompact?: boolean;
}

export const BorderWidthPopover: React.FC<BorderWidthPopoverProps> = ({
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
