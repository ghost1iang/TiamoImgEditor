import React, { useState, useEffect, useRef } from 'react';
import { useImageEditorCore, CoreOptions } from '../core/useImageEditorCore';
import { Toolbar } from '../components/Toolbar';
import { ConfirmModal } from '../components/ConfirmModal';
import { Loader2 } from 'lucide-react';
import { ToolbarToolId } from '../types/toolbar';

export interface ToolbarPopoverEditorProps extends CoreOptions {
  targetElement: HTMLElement;
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  onFinish?: () => void;
  onCancel?: () => void;
}

export const ToolbarPopoverEditor: React.FC<ToolbarPopoverEditorProps> = (props) => {
  const { targetElement } = props;
  const core = useImageEditorCore(props);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // 更新目标元素的位置与尺寸
  const updateRect = () => {
    if (targetElement) {
      setTargetRect(targetElement.getBoundingClientRect());
    }
  };

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [targetElement]);

  // 如果初始未设置图片且目标是 <img> 或 <canvas>，自动加载
  useEffect(() => {
    if (!core.currentImage && targetElement) {
      if (targetElement instanceof HTMLImageElement && targetElement.src) {
        core.loadImageSource(targetElement.src);
      } else if (targetElement instanceof HTMLCanvasElement) {
        core.loadImageSource(targetElement.toDataURL('image/png'));
      }
    }
  }, [targetElement, core.currentImage]);

  const {
    currentImage,
    isPanning,
    spacePressed,
    activeTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    rotationAngle,
    showAlphaMask,
    isLoading,
    imageRef,
    displayMaskRef,
    drawingPath,
    selectionRegion,
    isRegionInverted,
    quadPoints,
    isPolyClosed,
    polyHoverClose,
    polyMousePos,
    draggingPointIdx,
    rectDragPoints,
  } = core;

  // 计算浮动工具栏坐标
  const toolbarTop = targetRect 
    ? (targetRect.top > 60 ? targetRect.top - 52 : targetRect.bottom + 10) 
    : 20;
  const toolbarLeft = targetRect 
    ? Math.max(12, Math.min(window.innerWidth - 680, targetRect.left)) 
    : 20;

  return (
    <div className="fixed inset-0 z-[999990] pointer-events-none select-none">
      {/* 浮动吸附工具栏 */}
      <div 
        className="fixed z-[999999] pointer-events-auto transition-all duration-150 animate-in fade-in slide-in-from-top-2"
        style={{ top: `${toolbarTop}px`, left: `${toolbarLeft}px` }}
      >
        <Toolbar 
          core={core} 
          mode="toolbar" 
          showComplete={true} 
          showCancel={true} 
          tools={props.tools}
          visibleTools={props.visibleTools}
          hiddenTools={props.hiddenTools}
          onFinish={props.onFinish} 
          onCancel={props.onCancel} 
        />
      </div>

      {/* 如果有选区且无进行中的工具，点击图片外部区域取消选区 */}
      {core.hasSelection && !core.activeTool && (
        <div 
          className="fixed inset-0 z-[999980] pointer-events-auto cursor-default"
          onClick={() => core.clearSelection()}
        />
      )}

      {/* 原地编辑遮罩层 (与目标元素重合) */}
      {targetRect && currentImage && (
        <div 
          className="fixed pointer-events-auto overflow-visible cursor-crosshair ring-4 ring-blue-500/80 shadow-2xl rounded-sm transition-all"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 原位渲染画布与选区 */}
          <div 
            className="relative w-full h-full overflow-hidden leading-[0]"
            style={{ transform: `rotate(${rotationAngle}deg)`, transformOrigin: 'center center' }}
          >
            <img 
              ref={imageRef} 
              src={currentImage} 
              alt="In-place Workspace" 
              draggable="false" 
              className={`w-full h-full object-contain pointer-events-none transition-all ${isLoading ? 'blur-sm opacity-40' : 'opacity-100'}`} 
            />
            <canvas ref={displayMaskRef} className="absolute inset-0 pointer-events-none w-full h-full" />

            {/* 套索路径 SVG */}
            {drawingPath.length > 1 && imageRef.current && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                <polyline points={drawingPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              </svg>
            )}

            {/* 选区矩形 / 任意路径 */}
            {selectionRegion && imageRef.current && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {selectionRegion.type === 'rect' ? (
                  <div 
                    className={`absolute border-2 border-indigo-500 border-dashed ${isRegionInverted ? 'bg-black/40' : 'shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`} 
                    style={{ 
                      left: `${(selectionRegion.data.x / imageRef.current.naturalWidth) * 100}%`, 
                      top: `${(selectionRegion.data.y / imageRef.current.naturalHeight) * 100}%`, 
                      width: `${(selectionRegion.data.w / imageRef.current.naturalWidth) * 100}%`, 
                      height: `${(selectionRegion.data.h / imageRef.current.naturalHeight) * 100}%` 
                    }} 
                  >
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i} 
                        className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow-lg z-30 pointer-events-auto cursor-move" 
                        style={{ 
                          left: i === 1 || i === 2 ? '100%' : '0', 
                          top: i === 2 || i === 3 ? '100%' : '0', 
                          transform: 'translate(-50%, -50%)' 
                        }} 
                      />
                    ))}
                  </div>
                ) : (
                  <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                    <defs>
                      <mask id="inplaceLassoMask">
                        <rect width="100%" height="100%" fill={isRegionInverted ? "black" : "white"} />
                        <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill={isRegionInverted ? "white" : "black"} />
                      </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" mask="url(#inplaceLassoMask)" />
                    <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </div>
            )}

            {/* 多边范围 / 顶点拉伸 */}
            {activeTool === 'quad' && imageRef.current && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                {isPolyClosed && quadPoints && (
                  <>
                    <polygon points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(79, 70, 229, 0.15)" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {quadPoints.map((p, i) => (
                      <circle 
                        key={i} 
                        cx={p.x} 
                        cy={p.y} 
                        r="6" 
                        fill={draggingPointIdx === i ? "#ffffff" : "#4f46e5"} 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                        className="pointer-events-auto cursor-move drop-shadow-md" 
                      />
                    ))}
                  </>
                )}
                {!isPolyClosed && quadPoints && quadPoints.length > 0 && (
                  <>
                    <polyline points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {polyMousePos && (
                      <line 
                        x1={quadPoints[quadPoints.length - 1].x} 
                        y1={quadPoints[quadPoints.length - 1].y} 
                        x2={polyMousePos.x} 
                        y2={polyMousePos.y} 
                        stroke="#4f46e5" 
                        strokeWidth="2" 
                        strokeDasharray="4 4" 
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {quadPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="1.5" />
                    ))}
                    {polyHoverClose && (
                      <g>
                        <circle cx={quadPoints[0].x} cy={quadPoints[0].y} r="10" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="3 3" />
                        <circle cx={quadPoints[0].x} cy={quadPoints[0].y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      </g>
                    )}
                  </>
                )}
              </svg>
            )}

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                <Loader2 size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 坐标浮动层：固定显示选框左上和右下两个点的物理坐标，只要选框存在即保持显示，并智能规避视口遮挡 */}
      {selectionRegion && selectionRegion.type === 'rect' && imageRef.current && (() => {
        const r = selectionRegion.data;
        if (!r) return null;
        const minX = Math.min(r.x, r.x + r.w);
        const maxX = Math.max(r.x, r.x + r.w);
        const minY = Math.min(r.y, r.y + r.h);
        const maxY = Math.max(r.y, r.y + r.h);
        if (maxX - minX <= 0 || maxY - minY <= 0) return null;

        const imgRect = imageRef.current.getBoundingClientRect();
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        if (!nw || !nh || !viewportW || !viewportH) return null;

        const tlScreenX = imgRect.left + (minX / nw) * imgRect.width;
        const tlScreenY = imgRect.top + (minY / nh) * imgRect.height;

        const brScreenX = imgRect.left + (maxX / nw) * imgRect.width;
        const brScreenY = imgRect.top + (maxY / nh) * imgRect.height;

        const badgeW = 92;
        const badgeH = 26;
        const offset = 8;

        let tlTargetX = tlScreenX - badgeW - offset;
        let tlTargetY = tlScreenY - badgeH - offset;
        if (tlTargetX < 8) tlTargetX = tlScreenX + offset;
        if (tlTargetY < 8) tlTargetY = tlScreenY + offset;

        let brTargetX = brScreenX + offset;
        let brTargetY = brScreenY + offset;
        if (brTargetX + badgeW > viewportW - 8) brTargetX = brScreenX - badgeW - offset;
        if (brTargetY + badgeH > viewportH - 8) brTargetY = brScreenY - badgeH - offset;

        // 视口边界碰撞钳制：
        // 1. 如果拖拽鼠标 x + 坐标w 大于 视口w，则显示位置为 x = 视口w - 坐标w
        // 2. 如果拖拽鼠标 y + 坐标h 大于 视口h，则显示位置为 y = 视口h - 坐标h
        const clampToViewport = (x: number, y: number) => {
          let resX = x;
          let resY = y;
          const padding = 8;

          if (resX + badgeW > viewportW - padding) {
            resX = viewportW - badgeW - padding;
          }
          if (resX < padding) {
            resX = padding;
          }

          if (resY + badgeH > viewportH - padding) {
            resY = viewportH - badgeH - padding;
          }
          if (resY < padding) {
            resY = padding;
          }

          return { x: resX, y: resY };
        };

        const tlPos = clampToViewport(tlTargetX, tlTargetY);
        let brPos = clampToViewport(brTargetX, brTargetY);

        if (Math.abs(tlPos.x - brPos.x) < badgeW && Math.abs(tlPos.y - brPos.y) < badgeH) {
          if (tlPos.y - badgeH - 6 >= 8) {
            tlPos.y = brPos.y - badgeH - 6;
          } else {
            brPos.y = tlPos.y + badgeH + 6;
          }
        }

        return (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-[999995]">
            {/* 左上角物理坐标 */}
            <div 
              className="absolute pointer-events-none whitespace-nowrap bg-slate-950/95 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xl border border-indigo-400 backdrop-blur-md flex items-center gap-1.5 select-none"
              style={{
                left: `${tlPos.x}px`,
                top: `${tlPos.y}px`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <span>({Math.round(minX)}, {Math.round(minY)})</span>
            </div>

            {/* 右下角物理坐标 */}
            <div 
              className="absolute pointer-events-none whitespace-nowrap bg-slate-900/95 text-slate-200 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xl border border-indigo-400/80 backdrop-blur-md flex items-center gap-1.5 select-none"
              style={{
                left: `${brPos.x}px`,
                top: `${brPos.y}px`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span>({Math.round(maxX)}, {Math.round(maxY)})</span>
            </div>
          </div>
        );
      })()}

      {/* 确认弹窗 */}
      <ConfirmModal core={core} />
    </div>
  );
};
