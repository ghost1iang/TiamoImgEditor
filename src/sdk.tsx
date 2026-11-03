import React from 'react';
import ReactDOM from 'react-dom/client';
import editorStyles from './styles/editor.css?inline';
import { ModalEditor } from './modes/ModalEditor';
import { ToolbarPopoverEditor } from './modes/ToolbarPopoverEditor';
import { DistributedEditor } from './modes/DistributedEditor';
import { SDK_VERSION, SDK_BUILD_TIME, SDK_DESCRIPTION } from './version';
import { ToolbarToolId } from './types/toolbar';

export type EditorMode = 'modal' | 'toolbar' | 'distributed';
export type OutputType = 'blob' | 'base64' | 'canvas';

export interface EditOptions {
  mode?: EditorMode;
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
  showComplete?: boolean;
  showCancel?: boolean;
  toolbarContainer?: HTMLElement | string;
  canvasContainer?: HTMLElement | string;
  apiKey?: string;
  outputType?: OutputType;
  autoUpdateTarget?: boolean;
  rejectOnCancel?: boolean;
  useShadowDOM?: boolean;
  onComplete?: (result: Blob | string | HTMLCanvasElement) => void;
  onCancel?: () => void;
}

export interface EditResult {
  blob: Blob;
  base64: string;
  canvas: HTMLCanvasElement;
}

export class TiamoImageEditor {
  static version = SDK_VERSION;
  static buildTime = SDK_BUILD_TIME;
  static description = SDK_DESCRIPTION;

  /**
   * 单行代码唤起图像编辑器，完成编辑后返回 Promise
   * @param targetOrSource 目标 <img> 节点、<canvas> 节点、图片 URL / Base64 / Blob，或者留空新开画布
   * @param options 配置项（模式、输出格式、挂载点等）
   */
  static async edit(
    targetOrSource?: HTMLElement | string | Blob | File | null,
    options: EditOptions = {}
  ): Promise<Blob | string | HTMLCanvasElement | null> {
    const {
      mode = (options.toolbarContainer && options.canvasContainer) 
        ? 'distributed' 
        : (options.mode || 'modal'),
      outputType = 'blob',
      autoUpdateTarget = true,
      rejectOnCancel = true,
      useShadowDOM = true,
      apiKey = "",
    } = options;

    return new Promise((resolve, reject) => {
      // 准备挂载宿主容器
      const hostContainer = document.createElement('div');
      hostContainer.setAttribute('data-sdk-image-editor-host', 'true');
      document.body.appendChild(hostContainer);

      let mountPoint: HTMLElement = hostContainer;

      // 如果启用样式隔离 (Shadow DOM)
      if (useShadowDOM && hostContainer.attachShadow) {
        const shadow = hostContainer.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style');
        styleEl.textContent = editorStyles;
        shadow.appendChild(styleEl);

        const appRoot = document.createElement('div');
        appRoot.style.width = '100%';
        appRoot.style.height = '100%';
        shadow.appendChild(appRoot);
        mountPoint = appRoot;
      } else {
        // 全局注入隔离样式标签（只注入一次）
        if (!document.getElementById('sdk-image-editor-global-styles')) {
          const styleEl = document.createElement('style');
          styleEl.id = 'sdk-image-editor-global-styles';
          styleEl.textContent = editorStyles;
          document.head.appendChild(styleEl);
        }
      }

      const reactRoot = ReactDOM.createRoot(mountPoint);

      const cleanup = () => {
        try {
          reactRoot.unmount();
        } catch (e) {
          // ignore
        }
        if (hostContainer.parentNode) {
          hostContainer.parentNode.removeChild(hostContainer);
        }
      };

      const handleDone = (result: EditResult) => {
        cleanup();

        // 自动更新宿主目标 <img>
        if (autoUpdateTarget && targetOrSource instanceof HTMLImageElement) {
          if (outputType === 'base64') {
            targetOrSource.src = result.base64;
          } else {
            targetOrSource.src = URL.createObjectURL(result.blob);
          }
        }

        // 根据请求格式返回
        let finalOutput: Blob | string | HTMLCanvasElement = result.blob;
        if (outputType === 'base64') finalOutput = result.base64;
        else if (outputType === 'canvas') finalOutput = result.canvas;

        if (options.onComplete) options.onComplete(finalOutput);
        resolve(finalOutput);
      };

      const handleCancel = () => {
        cleanup();
        if (options.onCancel) options.onCancel();
        if (rejectOnCancel) {
          reject(new Error('用户取消了图片编辑'));
        } else {
          resolve(null);
        }
      };

      // 解析初始图片输入
      let initialImage: any = null;
      let targetElement: HTMLElement | null = null;

      if (targetOrSource instanceof HTMLElement) {
        targetElement = targetOrSource;
        if (targetOrSource instanceof HTMLImageElement) {
          initialImage = targetOrSource.src;
        } else if (targetOrSource instanceof HTMLCanvasElement) {
          initialImage = targetOrSource.toDataURL('image/png');
        }
      } else if (typeof targetOrSource === 'string' || targetOrSource instanceof Blob) {
        initialImage = targetOrSource;
      }

      // 根据三种模式渲染对应视图
      if (mode === 'toolbar' && targetElement) {
        reactRoot.render(
          <ToolbarPopoverEditor
            targetElement={targetElement}
            initialImage={initialImage}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            onComplete={handleDone}
            onCancel={handleCancel}
          />
        );
      } else if (mode === 'distributed' && options.toolbarContainer && options.canvasContainer) {
        // 如果是分布式模式，确保目标容器也有对应样式
        if (!document.getElementById('sdk-image-editor-global-styles')) {
          const styleEl = document.createElement('style');
          styleEl.id = 'sdk-image-editor-global-styles';
          styleEl.textContent = editorStyles;
          document.head.appendChild(styleEl);
        }

        reactRoot.render(
          <DistributedEditor
            toolbarContainer={options.toolbarContainer}
            canvasContainer={options.canvasContainer}
            initialImage={initialImage}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            showComplete={options.showComplete}
            showCancel={options.showCancel}
            onComplete={handleDone}
            onCancel={handleCancel}
          />
        );
      } else {
        // 默认模态弹窗模式
        reactRoot.render(
          <ModalEditor
            initialImage={initialImage}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            showComplete={options.showComplete}
            showCancel={options.showCancel}
            onComplete={handleDone}
            onCancel={handleCancel}
          />
        );
      }
    });
  }

  /**
   * 快捷方式：新开窗口弹窗编辑
   */
  static modal(source?: HTMLElement | string | Blob | null, options: Omit<EditOptions, 'mode'> = {}) {
    return this.edit(source, { ...options, mode: 'modal' });
  }

  /**
   * 快捷方式：吸附在目标元素上原地编辑
   */
  static toolbar(targetElement: HTMLElement, options: Omit<EditOptions, 'mode'> = {}) {
    return this.edit(targetElement, { ...options, mode: 'toolbar' });
  }

  /**
   * 快捷方式：分布式槽位编辑
   */
  static distributed(
    toolbarContainer: HTMLElement | string, 
    canvasContainer: HTMLElement | string, 
    source?: HTMLElement | string | Blob | null, 
    options: Omit<EditOptions, 'mode' | 'toolbarContainer' | 'canvasContainer'> = {}
  ) {
    return this.edit(source, { ...options, mode: 'distributed', toolbarContainer, canvasContainer });
  }
}

// 挂载到全局 window 对象，供 script 标签直引
if (typeof window !== 'undefined') {
  const g = window as any;
  g.TiamoImageEditor = TiamoImageEditor;

  // 确保不管在任何时机，window.TiamoImageEditor.edit 都可以直接调用
  Object.assign(TiamoImageEditor, {
    edit: TiamoImageEditor.edit,
    modal: TiamoImageEditor.modal,
    toolbar: TiamoImageEditor.toolbar,
    distributed: TiamoImageEditor.distributed,
    version: SDK_VERSION,
    buildTime: SDK_BUILD_TIME,
  });
  g.TiamoImageEditor.version = SDK_VERSION;
  g.TiamoImageEditor.buildTime = SDK_BUILD_TIME;
}

export default TiamoImageEditor;
