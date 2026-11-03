import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useImageEditorCore, CoreOptions } from '../core/useImageEditorCore';
import { Toolbar } from '../components/Toolbar';
import { CanvasWorkspace } from '../components/CanvasWorkspace';
import { ConfirmModal } from '../components/ConfirmModal';
import { ToolbarToolId } from '../types/toolbar';

export interface DistributedEditorProps extends CoreOptions {
  toolbarContainer: HTMLElement | string;
  canvasContainer: HTMLElement | string;
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  showComplete?: boolean;
  showCancel?: boolean;
  onFinish?: () => void;
  onCancel?: () => void;
}

export const DistributedEditor: React.FC<DistributedEditorProps> = (props) => {
  const { toolbarContainer, canvasContainer } = props;
  const core = useImageEditorCore(props);

  const resolvedToolbarNode = useMemo(() => {
    if (typeof toolbarContainer === 'string') {
      return document.querySelector(toolbarContainer) as HTMLElement | null;
    }
    return toolbarContainer;
  }, [toolbarContainer]);

  const resolvedCanvasNode = useMemo(() => {
    if (typeof canvasContainer === 'string') {
      return document.querySelector(canvasContainer) as HTMLElement | null;
    }
    return canvasContainer;
  }, [canvasContainer]);

  if (!resolvedToolbarNode || !resolvedCanvasNode) {
    console.error('[TiamoImageEditor Distributed] 找不到指定的 toolbarContainer 或 canvasContainer 容器节点', {
      toolbarContainer,
      canvasContainer,
      resolvedToolbarNode,
      resolvedCanvasNode,
    });
    return null;
  }

  return (
    <>
      {/* 挂载工具栏到指定槽位 */}
      {createPortal(
        <div className="w-full font-sans select-none">
          <Toolbar 
            core={core} 
            mode="distributed" 
            showComplete={props.showComplete !== undefined ? props.showComplete : true} 
            showCancel={props.showCancel !== undefined ? props.showCancel : true} 
            tools={props.tools}
            visibleTools={props.visibleTools}
            hiddenTools={props.hiddenTools}
            onFinish={props.onFinish} 
            onCancel={props.onCancel} 
          />
        </div>,
        resolvedToolbarNode
      )}

      {/* 挂载画布到指定槽位 */}
      {createPortal(
        <div className="w-full h-full min-h-[300px] flex flex-col font-sans select-none bg-[#f1f5f9] rounded-xl overflow-hidden relative">
          <CanvasWorkspace core={core} showZoomControls={true} className="w-full h-full" />
          <ConfirmModal core={core} />
        </div>,
        resolvedCanvasNode
      )}
    </>
  );
};
