import React from 'react';
import {
  Pipette,
  Scissors,
  PaintBucket,
  Eraser,
  Sparkles,
  ImagePlus,
  Maximize2,
  Unlock,
  SquareDashed,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  RotateCw,
  Compass,
  Scan,
  Focus,
  SunMedium,
} from 'lucide-react';
import { ImageEditorCore } from '../../core/useImageEditorCore';
import { ToolbarToolId } from '../../types/toolbar';

export interface ActionToolsGroupProps {
  core: ImageEditorCore;
  isCompact: boolean;
  visibleTools: Set<ToolbarToolId>;
  hasColorTools: boolean;
  hasActionTools: boolean;
  hasBorderTools: boolean;
  hasTransformTools: boolean;
  lockedCount: number;
  borderWidthBtnRef: React.RefObject<HTMLButtonElement>;
  showBorderWidthPopover: boolean;
  setShowBorderWidthPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSpillRadiusPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettingsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  rotateBtnRef: React.RefObject<HTMLButtonElement>;
  handleToggleRotatePopover: () => void;
  triggerImportGraphic: () => void;
}

export const ActionToolsGroup: React.FC<ActionToolsGroupProps> = ({
  core,
  isCompact,
  visibleTools,
  hasColorTools,
  hasActionTools,
  hasBorderTools,
  hasTransformTools,
  lockedCount,
  borderWidthBtnRef,
  showBorderWidthPopover,
  setShowBorderWidthPopover,
  setShowSpillRadiusPopover,
  setShowSettingsPopover,
  rotateBtnRef,
  handleToggleRotatePopover,
  triggerImportGraphic,
}) => {
  const {
    fillColor,
    setFillColor,
    activeTool,
    setActiveTool,
    handleCropSelection,
    hasSelection,
    handleFillSelection,
    handleEraseSelection,
    isLoading,
    importedGraphics,
    handleExpandCanvas,
    handleUnlockAllGraphics,
    borderColor,
    setBorderColor,
    borderWidth,
    handleApplyBorder,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90,
    rotationAngle,
    handleAutoDetectOrtho,
    handleApplyDeShadow,
  } = core;

  return (
    <>
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
              onClick={handleEraseSelection} 
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
  );
};
