import React, { useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize, Loader2, Upload, Eye } from 'lucide-react';
import { ImageEditorCore } from '../core/useImageEditorCore';

interface CanvasWorkspaceProps {
  core: ImageEditorCore;
  showZoomControls?: boolean;
  className?: string;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  core,
  showZoomControls = true,
  className = "",
}) => {
  const {
    currentImage,
    isPanning,
    spacePressed,
    activeTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    setIsDragging,
    processFile,
    zoom,
    changeZoom,
    setZoom,
    setPanOffset,
    panOffset,
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
    handleUpload,
    hdBox,
    applySparseHD,
    hdDragHandle,
    displaySize,
    hdOriginalImage,
    isComparingOriginal,
    setIsComparingOriginal,
    isHdProcessing,
  } = core;

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  return (
    <div 
      ref={workspaceRef}
      className={`flex-1 flex flex-col p-2 overflow-hidden relative no-scrollbar select-none ${isPanning || spacePressed ? 'cursor-grabbing' : (activeTool === 'rect' || activeTool === 'lasso' || activeTool === 'pipette' || activeTool === 'quad' ? 'cursor-crosshair' : (activeTool === 'wand' ? 'cursor-cell' : 'cursor-grab'))} ${className}`} 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={() => {
        // 拖拽/框选/高清放大过程中由 window 全局监听接管，移出工作区绝不中断拖拽；仅非拖拽时才安全重置
        if (!core.regionStart && !isPanning && draggingPointIdx === -1 && drawingPath.length === 0 && !core.rectDragPoints && !hdDragHandle) {
          handleMouseUp();
        }
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
      onDragLeave={() => setIsDragging(false)} 
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
    >
      {/* 缩放控制器 */}
      {currentImage && showZoomControls && (
        <div className="absolute top-4 right-4 z-40 animate-in fade-in slide-in-from-right-2">
          <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-2xl p-1.5 flex items-center gap-1 rounded-2xl">
            <button onClick={() => changeZoom(-0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors rounded-lg"><ZoomOut size={12} /></button>
            <button onClick={() => setZoom(1)} className="px-2 text-[10px] font-black text-slate-800 min-w-[36px] text-center">{Math.round(zoom * 100)}%</button>
            <button onClick={() => changeZoom(0.25)} className="p-1 hover:bg-slate-100 text-slate-600 transition-colors rounded-lg"><ZoomIn size={12} /></button>
            <div className="w-px h-3 bg-slate-200 mx-0.5" />
            <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg" title="重置"><Maximize size={12} /></button>
          </div>
        </div>
      )}

      {/* 稀疏高清：贴附于图形上方的常驻信息与操作栏 (跟随图形浮动，智能贴边规避视口顶端遮挡裁切) */}
      {activeTool === 'hd' && imageRef.current && workspaceRef.current && (() => {
        const wsRect = workspaceRef.current.getBoundingClientRect();
        const imgRect = imageRef.current.getBoundingClientRect();
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        if (!nw || !nh || !wsRect.width || !wsRect.height) return null;

        const isDragging = !!hdDragHandle;
        const curBox = hdBox || { x: 0, y: 0, w: nw, h: nh };

        // 计算 HDBox 在工作区视口内的绝对像素坐标
        let boxTop = imgRect.top - wsRect.top;
        let boxBottom = imgRect.bottom - wsRect.top;
        let boxCenterX = imgRect.left + imgRect.width / 2 - wsRect.left;

        if (isDragging) {
          boxTop = imgRect.top + (curBox.y / nh) * imgRect.height - wsRect.top;
          boxBottom = boxTop + (curBox.h / nh) * imgRect.height;
          boxCenterX = imgRect.left + ((curBox.x + curBox.w / 2) / nw) * imgRect.width - wsRect.left;
        }

        const badgeH = 34; // 胶囊高度估算
        const offset = 12; // 与图形边缘的呼吸间距
        const topToolbarSafeY = 68; // 顶部浮动工具栏的安全避让基准线

        // 默认贴在图形顶边正上方
        let targetY = boxTop - badgeH - offset;
        // 当图形上移靠近或穿过顶部工具栏时，智能翻转至图形下方，或停靠于工具栏正下方
        if (targetY < topToolbarSafeY) {
          if (boxBottom + badgeH + offset < wsRect.height - 20) {
            targetY = boxBottom + offset;
          } else {
            targetY = topToolbarSafeY;
          }
        }

        // 水平居中并增加视口两侧防溢出安全边距
        const minCenterX = 180;
        const maxCenterX = Math.max(minCenterX, wsRect.width - 180);
        const safeCenterX = Math.min(Math.max(boxCenterX, minCenterX), maxCenterX);

        const ratio = Math.round((curBox.w / nw) * 100);

        return (
          <div 
            className="absolute z-40 pointer-events-auto transition-none"
            style={{
              left: `${safeCenterX}px`,
              top: `${targetY}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="bg-slate-900/95 text-amber-300 font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xl border border-amber-500/60 backdrop-blur-md flex items-center gap-2.5 whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full ${isHdProcessing ? 'bg-amber-400 animate-ping' : 'bg-amber-400'}`} />
              <span className="flex items-center gap-1.5">
                {isHdProcessing ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-amber-400" />
                    <span>正在重构高清像素...</span>
                  </>
                ) : (
                  `${Math.round(curBox.w)} × ${Math.round(curBox.h)} px (${ratio}%)`
                )}
              </span>

              {/* 原图 / 高清 实时按住对比 */}
              {hdOriginalImage && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); setIsComparingOriginal(true); }}
                  onMouseUp={(e) => { e.stopPropagation(); setIsComparingOriginal(false); }}
                  onMouseLeave={() => setIsComparingOriginal(false)}
                  onTouchStart={(e) => { e.stopPropagation(); setIsComparingOriginal(true); }}
                  onTouchEnd={(e) => { e.stopPropagation(); setIsComparingOriginal(false); }}
                  className={`ml-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer select-none ${
                    isComparingOriginal 
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700'
                  }`}
                  title="按住鼠标查看原图，松开恢复高清图"
                >
                  <Eye size={12} />
                  <span>{isComparingOriginal ? '当前显示: 原图' : '按住对比原图'}</span>
                </button>
              )}

              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-700">
                {[1.5, 2, 3, 4].map(mul => (
                  <button
                    key={mul}
                    onClick={(e) => {
                      e.stopPropagation();
                      const nw = imageRef.current?.naturalWidth || 1;
                      const nh = imageRef.current?.naturalHeight || 1;
                      applySparseHD(Math.round(nw * mul), Math.round(nh * mul));
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-[10px] text-white transition-colors"
                    title={`快速高清放大至 ${mul}x`}
                  >
                    {mul}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 画布中央区域 (移除 CSS 过渡动画，避免高清重构与坐标变换时发生弹跳与橡皮筋晃动) */}
      <div 
        className="min-h-full min-w-full flex items-center justify-center relative" 
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
      >
        {currentImage ? (
          <div 
            className="relative inline-block pointer-events-none" 
            style={{ transform: `scale(${zoom}) rotate(${rotationAngle}deg)`, transformOrigin: 'center center' }}
          >
            <div className={`relative overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border-4 border-white select-none pointer-events-auto leading-[0] transition-colors ${showAlphaMask ? 'alpha-mask-bg' : 'bg-white/5'}`}>
              <img 
                ref={imageRef} 
                src={isComparingOriginal && hdOriginalImage ? hdOriginalImage : currentImage} 
                alt="Workspace" 
                draggable="false" 
                className={`max-w-none select-none pointer-events-auto ${isLoading ? 'blur-xl opacity-30' : 'opacity-100'}`} 
                style={displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px`, maxWidth: 'none', maxHeight: 'none' } : { maxHeight: '70vh' }} 
              />
              <canvas ref={displayMaskRef} className="absolute inset-0 pointer-events-none w-full h-full" />
              
              {/* 套索路径 SVG */}
              {drawingPath.length > 1 && imageRef.current && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                  <polyline points={drawingPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2 / zoom).toString()} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                </svg>
              )}

              {/* 选区高亮 (矩形 / 任意路径) */}
              {selectionRegion && imageRef.current && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {selectionRegion.type === 'rect' ? (
                    <div 
                      className={`absolute border-2 border-blue-500 border-dashed ${isRegionInverted ? 'bg-black/40' : 'shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`} 
                      style={{ 
                        left: `${(selectionRegion.data.x / imageRef.current.naturalWidth) * 100}%`, 
                        top: `${(selectionRegion.data.y / imageRef.current.naturalHeight) * 100}%`, 
                        width: `${(selectionRegion.data.w / imageRef.current.naturalWidth) * 100}%`, 
                        height: `${(selectionRegion.data.h / imageRef.current.naturalHeight) * 100}%` 
                      }} 
                    >
                      {(activeTool === 'rect' || activeTool === null) && [0, 1, 2, 3].map(i => (
                        <div 
                          key={i} 
                          className="absolute w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-lg z-30 pointer-events-auto cursor-move" 
                          style={{ 
                            left: i === 1 || i === 2 ? '100%' : '0', 
                            top: i === 2 || i === 3 ? '100%' : '0', 
                            transform: `translate(-50%, -50%) scale(${1 / zoom})` 
                          }} 
                        />
                      ))}
                    </div>
                  ) : (
                    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                      <defs>
                        <mask id="lassoMask">
                          <rect width="100%" height="100%" fill={isRegionInverted ? "black" : "white"} />
                          <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill={isRegionInverted ? "white" : "black"} />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="rgba(0,0,0,0.4)" mask="url(#lassoMask)" />
                      <polygon points={(selectionRegion.data as any[]).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth={(2 / zoom).toString()} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}
                </div>
              )}

              {/* 多边范围 (多边形连线 / 顶点拉伸) */}
              {activeTool === 'quad' && imageRef.current && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" viewBox={`0 0 ${imageRef.current.naturalWidth} ${imageRef.current.naturalHeight}`}>
                  {/* 闭合后状态：填充色、描边、可拖拽定点圆圈 (与原顶点拉伸视觉完全一致) */}
                  {isPolyClosed && quadPoints && (
                    <>
                      <polygon 
                        points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="rgba(79, 70, 229, 0.15)" 
                        stroke="#4f46e5" 
                        strokeWidth={(2 / zoom).toString()} 
                        vectorEffect="non-scaling-stroke"
                      />
                      {quadPoints.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={(8 / zoom).toString()} 
                          fill={draggingPointIdx === i ? "#ffffff" : "#4f46e5"} 
                          stroke="#ffffff" 
                          strokeWidth={(2 / zoom).toString()} 
                          className="pointer-events-auto cursor-move drop-shadow-md" 
                        />
                      ))}
                    </>
                  )}

                  {/* 绘制中状态：折线、动态橡皮筋直线、端点指示器、首尾相连指示 */}
                  {!isPolyClosed && quadPoints && quadPoints.length > 0 && (
                    <>
                      {/* 已落点的折线 */}
                      <polyline 
                        points={quadPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                        fill="none" 
                        stroke="#4f46e5" 
                        strokeWidth={(2 / zoom).toString()} 
                        vectorEffect="non-scaling-stroke"
                      />
                      {/* 鼠标移动的动态橡皮筋直线 */}
                      {polyMousePos && (
                        <line 
                          x1={quadPoints[quadPoints.length - 1].x} 
                          y1={quadPoints[quadPoints.length - 1].y} 
                          x2={polyMousePos.x} 
                          y2={polyMousePos.y} 
                          stroke="#4f46e5" 
                          strokeWidth={(2 / zoom).toString()} 
                          strokeDasharray="4 4" 
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      {/* 已落点的小圆圈 */}
                      {quadPoints.map((p, i) => (
                        <circle 
                          key={i} 
                          cx={p.x} 
                          cy={p.y} 
                          r={(5 / zoom).toString()} 
                          fill="#ffffff" 
                          stroke="#4f46e5" 
                          strokeWidth={(2 / zoom).toString()} 
                        />
                      ))}
                      {/* 悬停在起点准备首尾相连闭合时的靶心提示 */}
                      {polyHoverClose && (
                        <g>
                          <circle 
                            cx={quadPoints[0].x} 
                            cy={quadPoints[0].y} 
                            r={(12 / zoom).toString()} 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth={(2.5 / zoom).toString()} 
                            strokeDasharray="3 3"
                          />
                          <circle 
                            cx={quadPoints[0].x} 
                            cy={quadPoints[0].y} 
                            r={(6 / zoom).toString()} 
                            fill="#10b981" 
                            stroke="#ffffff" 
                            strokeWidth={(1.5 / zoom).toString()} 
                          />
                        </g>
                      )}
                    </>
                  )}
                </svg>
              )}

              {/* 加载动画 */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px]">
                  <Loader2 size={32} className="text-blue-600 animate-spin" />
                </div>
              )}
            </div>

            {/* 稀疏高清 8 点控制框 (位于 overflow-hidden 外部，放大拖拽不被裁切) */}
            {activeTool === 'hd' && hdBox && imageRef.current && (() => {
              const nw = imageRef.current.naturalWidth;
              const nh = imageRef.current.naturalHeight;
              if (!nw || !nh) return null;

              // 未处于手柄拖拽阶段时，外框 100% 绝对紧贴当前图片边界，彻底杜绝任何多重缩放放大一圈的问题
              const isDragging = !!hdDragHandle;
              const leftPct = isDragging ? (hdBox.x / nw) * 100 : 0;
              const topPct = isDragging ? (hdBox.y / nh) * 100 : 0;
              const widthPct = isDragging ? (hdBox.w / nw) * 100 : 100;
              const heightPct = isDragging ? (hdBox.h / nh) * 100 : 100;

              const handles = [
                { id: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize' },
                { id: 'n', x: '50%', y: '0%', cursor: 'ns-resize' },
                { id: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize' },
                { id: 'e', x: '100%', y: '50%', cursor: 'ew-resize' },
                { id: 'se', x: '100%', y: '100%', cursor: 'nwse-resize' },
                { id: 's', x: '50%', y: '100%', cursor: 'ns-resize' },
                { id: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize' },
                { id: 'w', x: '0%', y: '50%', cursor: 'ew-resize' },
              ];

              return (
                <div 
                  className="absolute pointer-events-none z-30"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                >
                  {/* 高清外框边框 */}
                  <div className="absolute inset-0 border-2 border-dashed border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.25)]" />

                  {/* 8 个控制手柄 */}
                  {handles.map(h => (
                    <div
                      key={h.id}
                      data-hd-handle={h.id}
                      className="absolute w-3.5 h-3.5 bg-white border-2 border-amber-600 rounded-sm shadow-md pointer-events-auto transition-transform hover:scale-125"
                      style={{
                        left: h.x,
                        top: h.y,
                        cursor: h.cursor,
                        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                      }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        ) : (
          <label className="w-full max-w-md mx-auto py-14 px-8 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl bg-white shadow-xl flex flex-col items-center justify-center text-center transition-all duration-200 group cursor-pointer hover:shadow-2xl">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Upload size={28} strokeWidth={2} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">点击或拖拽图片至此</h3>
            <p className="text-xs text-slate-400 mb-5">支持 JPG、PNG、WebP、SVG 或 PDF 格式文件</p>
            <span className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow cursor-pointer group-hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-1.5">
              <Upload size={14} />
              <span>选择本地文件</span>
            </span>
            <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
          </label>
        )}
      </div>

      {/* 坐标浮动层：固定显示选框左上和右下两个点的物理坐标，只要选框存在即保持显示，并智能规避视口遮挡 */}
      {selectionRegion && selectionRegion.type === 'rect' && imageRef.current && workspaceRef.current && (() => {
        const r = selectionRegion.data;
        if (!r) return null;
        const minX = Math.min(r.x, r.x + r.w);
        const maxX = Math.max(r.x, r.x + r.w);
        const minY = Math.min(r.y, r.y + r.h);
        const maxY = Math.max(r.y, r.y + r.h);
        if (maxX - minX <= 0 || maxY - minY <= 0) return null;

        const wsRect = workspaceRef.current.getBoundingClientRect();
        const imgRect = imageRef.current.getBoundingClientRect();
        const nw = imageRef.current.naturalWidth;
        const nh = imageRef.current.naturalHeight;
        const viewportW = wsRect.width;
        const viewportH = wsRect.height;
        if (!nw || !nh || !viewportW || !viewportH) return null;

        // 左上角与右下角在工作区容器内的绝对像素位置
        const tlPosX = imgRect.left + (minX / nw) * imgRect.width - wsRect.left;
        const tlPosY = imgRect.top + (minY / nh) * imgRect.height - wsRect.top;

        const brPosX = imgRect.left + (maxX / nw) * imgRect.width - wsRect.left;
        const brPosY = imgRect.top + (maxY / nh) * imgRect.height - wsRect.top;

        const badgeW = 92; // 坐标胶囊估算宽度 (px)
        const badgeH = 26; // 坐标胶囊估算高度 (px)
        const offset = 8;

        let tlTargetX = tlPosX - badgeW - offset;
        let tlTargetY = tlPosY - badgeH - offset;
        if (tlTargetX < 8) tlTargetX = tlPosX + offset;
        if (tlTargetY < 8) tlTargetY = tlPosY + offset;

        let brTargetX = brPosX + offset;
        let brTargetY = brPosY + offset;
        if (brTargetX + badgeW > viewportW - 8) brTargetX = brPosX - badgeW - offset;
        if (brTargetY + badgeH > viewportH - 8) brTargetY = brPosY - badgeH - offset;

        // 视口边界碰撞钳制：
        // 1. 如果拖拽鼠标 x + 坐标w 大于 视口w，则显示位置为 x = 视口w - 坐标w
        // 2. 如果拖拽鼠标 y + 坐标h 大于 视口h，则显示位置为 y = 视口h - 坐标h
        const clampToViewport = (x: number, y: number) => {
          let resX = x;
          let resY = y;
          const padding = 8; // 安全防溢出边距

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

        // 如果在极小选区或极端边缘碰撞时两个标签发生重叠，微调位置以保持两者均清晰可读
        if (Math.abs(tlPos.x - brPos.x) < badgeW && Math.abs(tlPos.y - brPos.y) < badgeH) {
          if (tlPos.y - badgeH - 6 >= 8) {
            tlPos.y = brPos.y - badgeH - 6;
          } else {
            brPos.y = tlPos.y + badgeH + 6;
          }
        }

        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            {/* 左上角物理坐标 */}
            <div 
              className="absolute pointer-events-none whitespace-nowrap bg-slate-950/95 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md shadow-2xl border border-blue-400 backdrop-blur-md flex items-center gap-1.5 select-none"
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
    </div>
  );
};
