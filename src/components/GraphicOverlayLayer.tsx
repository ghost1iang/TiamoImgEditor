import React from 'react';
import {
  EIGHT_POINT_HANDLES,
  ImportedGraphic,
  SnapGuideLines,
} from '../core/algorithms/graphicLayer';

interface GraphicCanvasItemsProps {
  graphics: ImportedGraphic[];
  selectedId: string | null;
  naturalWidth: number;
  naturalHeight: number;
  snapLines: SnapGuideLines;
  interactive: boolean;
  zIndexClass?: string;
  showSnapLines?: boolean;
}

/**
 * 画布内层渲染：已导入的图形图层与实时对齐吸附辅助线
 */
export const GraphicCanvasItems: React.FC<GraphicCanvasItemsProps> = ({
  graphics,
  selectedId,
  naturalWidth,
  naturalHeight,
  snapLines,
  interactive,
  zIndexClass = 'z-20',
  showSnapLines = true,
}) => {
  const hasSnapLines = showSnapLines && (snapLines.x !== null || snapLines.y !== null);
  if (!naturalWidth || !naturalHeight || (graphics.length === 0 && !hasSnapLines)) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none ${zIndexClass}`}>
      {graphics.map((g) => {
        const isLocked = !!g.locked;
        const isSelected = !isLocked && g.id === selectedId;
        return (
          <img
            key={g.id}
            src={g.url}
            alt={g.name}
            draggable={false}
            data-graphic-id={isLocked ? undefined : g.id}
            data-graphic-locked={isLocked ? 'true' : undefined}
            className={`absolute max-w-none select-none ${
              isLocked || !interactive
                ? 'pointer-events-none'
                : isSelected
                  ? 'pointer-events-auto cursor-move'
                  : 'pointer-events-auto cursor-pointer'
            }`}
            style={{
              left: `${(g.x / naturalWidth) * 100}%`,
              top: `${(g.y / naturalHeight) * 100}%`,
              width: `${(g.w / naturalWidth) * 100}%`,
              height: `${(g.h / naturalHeight) * 100}%`,
            }}
          />
        );
      })}

      {/* 垂直对齐吸附辅助线 */}
      {showSnapLines && snapLines.x !== null && (
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.85)] pointer-events-none z-30"
          style={{ left: `${(snapLines.x / naturalWidth) * 100}%` }}
        />
      )}

      {/* 水平对齐吸附辅助线 */}
      {showSnapLines && snapLines.y !== null && (
        <div
          className="absolute left-0 right-0 h-px border-t border-dashed border-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.85)] pointer-events-none z-30"
          style={{ top: `${(snapLines.y / naturalHeight) * 100}%` }}
        />
      )}
    </div>
  );
};

interface GraphicControlFrameProps {
  graphic: ImportedGraphic | null;
  naturalWidth: number;
  naturalHeight: number;
  zoom?: number;
}

/**
 * 8 点触控操作框：四角方形把手固定比例缩放，左右圆形把手调宽度，上下圆形把手调高度
 */
export const GraphicControlFrame: React.FC<GraphicControlFrameProps> = ({
  graphic,
  naturalWidth,
  naturalHeight,
  zoom = 1,
}) => {
  if (!graphic || graphic.locked || !naturalWidth || !naturalHeight) return null;

  return (
    <div
      className="absolute pointer-events-none z-30"
      style={{
        left: `${(graphic.x / naturalWidth) * 100}%`,
        top: `${(graphic.y / naturalHeight) * 100}%`,
        width: `${(graphic.w / naturalWidth) * 100}%`,
        height: `${(graphic.h / naturalHeight) * 100}%`,
      }}
    >
      {/* 选中高亮外框 */}
      <div className="absolute inset-0 border-2 border-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]" />

      {/* 8 个标准触控把手 */}
      {EIGHT_POINT_HANDLES.map((h) => (
        <div
          key={h.id}
          data-graphic-handle={h.id}
          title={
            h.isCorner
              ? '等比缩放 (固定宽高比例)'
              : h.id === 'e' || h.id === 'w'
                ? '增加/调整宽度'
                : '增加/调整高度'
          }
          className={`absolute w-3.5 h-3.5 bg-white border-2 border-indigo-600 shadow-md pointer-events-auto transition-transform hover:scale-125 ${
            h.isCorner ? 'rounded-[2px]' : 'rounded-full'
          }`}
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
};
