import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings,
  Check,
  X,
} from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';
import { ToolbarToolId, resolveVisibleTools } from '../types/toolbar';
import { ToolbarSettingsPopover } from './ToolbarSettingsPopover';
import {
  RotationPopover,
  SpillRadiusPopover,
  BorderWidthPopover,
} from './toolbar/ToolbarPopovers';
import { GraphicContextToolbar } from './toolbar/GraphicContextToolbar';
import { SelectionToolsGroup } from './toolbar/SelectionToolsGroup';
import { ActionToolsGroup } from './toolbar/ActionToolsGroup';

export interface ToolbarProps {
  core: ImageEditorCore;
  mode?: 'modal' | 'toolbar' | 'distributed';
  showComplete?: boolean;
  showCancel?: boolean;
  onFinish?: () => void;
  onCancel?: () => void;
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  core,
  mode = 'modal',
  showComplete = true,
  showCancel = true,
  onFinish,
  onCancel,
  tools,
  visibleTools: explicitVisibleTools,
  hiddenTools: explicitHiddenTools,
  className = '',
}) => {
  const {
    currentImage,
    activeTool,
    setActiveTool,
    rotationAngle,
    setRotationAngle,
    handleApplyRotation,
    tolerance,
    spillRadius,
    setSpillRadius,
    borderWidth,
    setBorderWidth,
    isLoading,
    handleFinish: coreFinish,
    handleCancel: coreCancel,
    hasCustomImportGraphicHandler,
    handleTriggerImportGraphic,
    importedGraphics,
    selectedGraphicId,
    baseLayerIndex,
    imageRef,
    handleImportGraphicFile,
  } = core;

  const handleFinishClick = onFinish || coreFinish;
  const handleCancelClick = onCancel || coreCancel;
  const isCompact = mode === 'toolbar';

  // 1. 工具可见性控制 (支持外部参数预设 + 内部运行时动态修改)
  const [visibleTools, setVisibleTools] = useState<Set<ToolbarToolId>>(() => {
    return resolveVisibleTools({
      tools,
      visibleTools: explicitVisibleTools,
      hiddenTools: explicitHiddenTools,
    });
  });

  // 当外部传入的配置更新时自动响应
  useEffect(() => {
    setVisibleTools(
      resolveVisibleTools({
        tools,
        visibleTools: explicitVisibleTools,
        hiddenTools: explicitHiddenTools,
      })
    );
  }, [tools, explicitVisibleTools, explicitHiddenTools]);

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
    const handleSetVisibleToolsEvent = (e: CustomEvent) => {
      if (e.detail && Array.isArray(e.detail.tools)) {
        setVisibleTools(new Set(e.detail.tools));
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

  // 2. 旋转浮窗与设置浮窗定位控制 (Portal + Fixed 视口坐标)
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
    if (toolbarRef.current) {
      const rootNode = toolbarRef.current.getRootNode();
      if (rootNode instanceof ShadowRoot) {
        return rootNode as unknown as HTMLElement;
      }
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

  // 旋转浮窗位置自适应
  useEffect(() => {
    if (activeTool !== 'rotate') return;

    const updatePos = () => {
      if (!rotateBtnRef.current) return;
      const btnRect = rotateBtnRef.current.getBoundingClientRect();
      const popoverWidth = 264;
      const popoverHeight = 240;
      const gap = 8;
      const margin = 12;

      let top = btnRect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, btnRect.top - popoverHeight - gap);
      }

      let left = btnRect.left + btnRect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const arrowOffset = btnRect.left + btnRect.width / 2 - left;

      setRotatePopoverPos({ top, left, arrowOffset });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [activeTool]);

  // 设置浮窗位置自适应
  useEffect(() => {
    if (!showSettingsPopover) return;

    const updatePos = () => {
      if (!settingsBtnRef.current) return;
      const btnRect = settingsBtnRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      const popoverHeight = 420;
      const gap = 8;
      const margin = 12;

      let top = btnRect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, btnRect.top - popoverHeight - gap);
      }

      let left = btnRect.left + btnRect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const arrowOffset = btnRect.left + btnRect.width / 2 - left;

      setSettingsPopoverPos({ top, left, arrowOffset });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showSettingsPopover]);

  // 点击外部关闭旋转浮窗
  useEffect(() => {
    if (activeTool !== 'rotate') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (rotatePopoverRef.current && rotatePopoverRef.current.contains(target)) return;
      if (rotateBtnRef.current && rotateBtnRef.current.contains(target)) return;
      if (target.closest('[data-rotate-trigger="true"]')) return;
      setActiveTool(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [activeTool, setActiveTool]);

  // 点击外部关闭设置浮窗
  useEffect(() => {
    if (!showSettingsPopover) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (settingsPopoverRef.current && settingsPopoverRef.current.contains(target)) return;
      if (settingsBtnRef.current && settingsBtnRef.current.contains(target)) return;
      setShowSettingsPopover(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showSettingsPopover]);

  // 影响范围浮窗位置自适应
  useEffect(() => {
    if (!showSpillRadiusPopover) return;

    const updatePos = () => {
      if (!spillRadiusBtnRef.current) return;
      const btnRect = spillRadiusBtnRef.current.getBoundingClientRect();
      const popoverWidth = 270;
      const popoverHeight = 260;
      const gap = 8;
      const margin = 12;

      let top = btnRect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, btnRect.top - popoverHeight - gap);
      }

      let left = btnRect.left + btnRect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const arrowOffset = btnRect.left + btnRect.width / 2 - left;

      setSpillRadiusPopoverPos({ top, left, arrowOffset });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showSpillRadiusPopover]);

  // 点击外部关闭影响范围浮窗
  useEffect(() => {
    if (!showSpillRadiusPopover) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (spillRadiusPopoverRef.current && spillRadiusPopoverRef.current.contains(target)) return;
      if (spillRadiusBtnRef.current && spillRadiusBtnRef.current.contains(target)) return;
      setShowSpillRadiusPopover(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showSpillRadiusPopover]);

  // 边框宽度浮窗位置自适应
  useEffect(() => {
    if (!showBorderWidthPopover) return;

    const updatePos = () => {
      if (!borderWidthBtnRef.current) return;
      const btnRect = borderWidthBtnRef.current.getBoundingClientRect();
      const popoverWidth = 260;
      const popoverHeight = 220;
      const gap = 8;
      const margin = 12;

      let top = btnRect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - margin) {
        top = Math.max(margin, btnRect.top - popoverHeight - gap);
      }

      let left = btnRect.left + btnRect.width / 2 - popoverWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
      const arrowOffset = btnRect.left + btnRect.width / 2 - left;

      setBorderWidthPopoverPos({ top, left, arrowOffset });
    };

    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showBorderWidthPopover]);

  // 点击外部关闭边框宽度浮窗
  useEffect(() => {
    if (!showBorderWidthPopover) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (borderWidthPopoverRef.current && borderWidthPopoverRef.current.contains(target)) return;
      if (borderWidthBtnRef.current && borderWidthBtnRef.current.contains(target)) return;
      setShowBorderWidthPopover(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showBorderWidthPopover]);

  // 计算各个分组是否有可见工具
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
    imageRef.current?.naturalWidth || 800,
    imageRef.current?.naturalHeight || 800,
    1000
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
  const clampedBaseIdx = Math.max(0, Math.min(importedGraphics.length, baseLayerIndex));
  const selectedStackPos =
    selectedGraphicIndex === -1
      ? -1
      : selectedGraphicIndex < clampedBaseIdx
      ? selectedGraphicIndex
      : selectedGraphicIndex + 1;
  const isGraphicAtTop = selectedStackPos === importedGraphics.length;
  const isGraphicAtBottom = selectedStackPos === 0;
  const lockedCount = importedGraphics.filter((g) => !!g.locked).length;

  const triggerImportGraphic = () => {
    if (hasCustomImportGraphicHandler) {
      void handleTriggerImportGraphic();
      return;
    }
    if (importGraphicInputRef.current) {
      importGraphicInputRef.current.value = '';
      importGraphicInputRef.current.click();
    }
  };

  if (!currentImage) return null;

  return (
    <div
      ref={toolbarRef}
      className={`relative z-30 shrink-0 w-full flex items-center justify-between p-2 select-none border-b shadow-sm ${
        isCompact
          ? 'bg-slate-900/90 text-white border-slate-700 backdrop-blur-md'
          : 'bg-white text-slate-700 border-slate-200'
      } ${className}`}
    >
      {/* 隐藏文件选择器 */}
      <input
        ref={importGraphicInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportGraphicFile(file);
          }
        }}
      />

      {/* 核心编辑工具组 */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 mr-2">
        {selectedGraphic ? (
          <GraphicContextToolbar
            selectedGraphic={selectedGraphic}
            core={core}
            isCompact={isCompact}
            visibleTools={visibleTools}
            borderWidthBtnRef={borderWidthBtnRef}
            showBorderWidthPopover={showBorderWidthPopover}
            setShowBorderWidthPopover={setShowBorderWidthPopover}
            setShowSpillRadiusPopover={setShowSpillRadiusPopover}
            setShowSettingsPopover={setShowSettingsPopover}
            triggerImportGraphic={triggerImportGraphic}
            isGraphicAtTop={isGraphicAtTop}
            isGraphicAtBottom={isGraphicAtBottom}
            lockedCount={lockedCount}
          />
        ) : (
          <>
            <SelectionToolsGroup
              core={core}
              isCompact={isCompact}
              visibleTools={visibleTools}
              hasSelectionTools={hasSelectionTools}
              hasWandTools={hasWandTools}
              maxImgDimension={maxImgDimension}
              spillRadiusBtnRef={spillRadiusBtnRef}
              showSpillRadiusPopover={showSpillRadiusPopover}
              setShowSpillRadiusPopover={setShowSpillRadiusPopover}
            />

            <ActionToolsGroup
              core={core}
              isCompact={isCompact}
              visibleTools={visibleTools}
              hasColorTools={hasColorTools}
              hasActionTools={hasActionTools}
              hasBorderTools={hasBorderTools}
              hasTransformTools={hasTransformTools}
              lockedCount={lockedCount}
              borderWidthBtnRef={borderWidthBtnRef}
              showBorderWidthPopover={showBorderWidthPopover}
              setShowBorderWidthPopover={setShowBorderWidthPopover}
              setShowSpillRadiusPopover={setShowSpillRadiusPopover}
              setShowSettingsPopover={setShowSettingsPopover}
              rotateBtnRef={rotateBtnRef}
              handleToggleRotatePopover={handleToggleRotatePopover}
              triggerImportGraphic={triggerImportGraphic}
            />
          </>
        )}
      </div>

      {/* 右侧动作按钮组 (设置、完成与取消) */}
      {(visibleTools.has('settings') || showComplete || showCancel) && (
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {visibleTools.has('settings') && (
            <button
              ref={settingsBtnRef}
              onClick={() => setShowSettingsPopover((p) => !p)}
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

          {showCancel && (
            <button
              onClick={handleCancelClick}
              className={`p-1.5 rounded-lg transition-colors ${
                isCompact
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400'
                  : 'bg-white hover:bg-red-50 border border-slate-200 text-slate-400 hover:text-red-500'
              }`}
              title="取消并关闭"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* 任意角度旋转控制浮窗 */}
      {activeTool === 'rotate' &&
        createPortal(
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

      {/* 去色边影响范围控制浮窗 */}
      {showSpillRadiusPopover &&
        createPortal(
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

      {/* 边框宽度拉把浮窗 */}
      {showBorderWidthPopover &&
        createPortal(
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

      {/* 工具栏按钮显示设置浮窗 */}
      {showSettingsPopover &&
        createPortal(
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
