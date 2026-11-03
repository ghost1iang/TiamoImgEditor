import React from 'react';
import { useImageEditorCore, CoreOptions } from '../core/useImageEditorCore';
import { Toolbar } from '../components/Toolbar';
import { CanvasWorkspace } from '../components/CanvasWorkspace';
import { Sidebar } from '../components/Sidebar';
import { FooterPrompt } from '../components/FooterPrompt';
import { ConfirmModal } from '../components/ConfirmModal';

import { ToolbarToolId } from '../types/toolbar';

export interface ModalEditorProps extends CoreOptions {
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  showComplete?: boolean;
  showCancel?: boolean;
  onFinish?: () => void;
  onCancel?: () => void;
}

export const ModalEditor: React.FC<ModalEditorProps> = (props) => {
  const core = useImageEditorCore(props);

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full h-full max-w-[100vw] max-h-[100vh] bg-[#f8fafc] text-slate-800 font-sans flex overflow-hidden shadow-2xl relative">
        {/* 左侧历史边栏 */}
        <Sidebar core={core} />

        {/* 右侧主编辑工作区 */}
        <main className="flex-1 flex flex-col relative min-w-0 bg-[#f1f5f9]">
          {/* 顶部工具栏 */}
          <Toolbar 
            core={core} 
            mode="modal" 
            showComplete={props.showComplete !== undefined ? props.showComplete : true} 
            showCancel={props.showCancel !== undefined ? props.showCancel : true} 
            tools={props.tools}
            visibleTools={props.visibleTools}
            hiddenTools={props.hiddenTools}
            onFinish={props.onFinish} 
            onCancel={props.onCancel} 
          />

          {/* 画布视口 */}
          <CanvasWorkspace core={core} showZoomControls={true} />

          {/* 底部 AI 指令栏 */}
          <FooterPrompt core={core} />

          {/* 确认弹窗 */}
          <ConfirmModal core={core} />
        </main>
      </div>
    </div>
  );
};
