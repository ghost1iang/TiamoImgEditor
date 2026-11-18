import React from 'react';
import ReactDOM from 'react-dom/client';
import editorStyles from './styles/editor.css?inline';
import { ModalEditor } from './modes/ModalEditor';
import { ToolbarPopoverEditor } from './modes/ToolbarPopoverEditor';
import { DistributedEditor } from './modes/DistributedEditor';
import { SDK_VERSION, SDK_BUILD_TIME, SDK_DESCRIPTION } from './version';
import { ToolbarToolId } from './types/toolbar';
import {
  type EditorLayerState,
  type GraphicInputSource,
  type ImportGraphicOptions,
  type ImportedGraphic,
  type OnRequestImportGraphicHandler,
  parseEditorLayerState,
  saveLayerStateToCache,
  findCachedLayerState,
} from './core/algorithms/graphicLayer';

const ELEMENT_LAYER_STATE_MAP = new WeakMap<HTMLElement, EditorLayerState>();

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
  initialState?: EditorLayerState | string | null;
  onRequestImportGraphic?: OnRequestImportGraphicHandler;
  onSaveState?: (state: EditorLayerState) => void;
  onComplete?: (result: Blob | string | HTMLCanvasElement, state: EditorLayerState) => void;
  onCancel?: () => void;
}

export interface EditResult {
  blob: Blob;
  base64: string;
  canvas: HTMLCanvasElement;
  state: EditorLayerState;
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

      const resolveMountContainer = (target?: HTMLElement | string): HTMLElement | null => {
        if (!target) return null;
        if (typeof target === 'string') return document.querySelector(target) as HTMLElement | null;
        return target instanceof HTMLElement ? target : null;
      };

      // 解析初始图片输入及独立分层状态
      let initialImage: any = null;
      let targetElement: HTMLElement | null = null;
      let resolvedInitialState: EditorLayerState | string | null = options.initialState || null;

      if (targetOrSource instanceof HTMLElement) {
        targetElement = targetOrSource;
        if (targetOrSource instanceof HTMLImageElement) {
          initialImage = targetOrSource.src;
        } else if (targetOrSource instanceof HTMLCanvasElement) {
          initialImage = targetOrSource.toDataURL('image/png');
        }
        if (!resolvedInitialState) {
          resolvedInitialState =
            ELEMENT_LAYER_STATE_MAP.get(targetOrSource) ||
            parseEditorLayerState(targetOrSource.dataset?.tiamoLayerState) ||
            findCachedLayerState(
              targetOrSource instanceof HTMLImageElement ? targetOrSource.src : null
            ) ||
            null;
        }
      } else if (typeof targetOrSource === 'string' || targetOrSource instanceof Blob) {
        initialImage = targetOrSource;
        if (!resolvedInitialState && typeof targetOrSource === 'string') {
          resolvedInitialState = findCachedLayerState(targetOrSource);
        }
      }

      // 严格校验模式必需参数，严禁参数不全时静默降级或使 Promise 永不 settle
      if (mode === 'toolbar' && !targetElement) {
        if (hostContainer.parentNode) hostContainer.parentNode.removeChild(hostContainer);
        reject(new Error('TiamoImageEditor toolbar 模式必须传入有效的目标 DOM 元素 (<img> 或 <canvas>)'));
        return;
      }
      if (mode === 'distributed') {
        const tbNode = resolveMountContainer(options.toolbarContainer);
        const cvNode = resolveMountContainer(options.canvasContainer);
        if (!tbNode || !cvNode) {
          if (hostContainer.parentNode) hostContainer.parentNode.removeChild(hostContainer);
          reject(new Error('TiamoImageEditor distributed 模式未找到指定的 toolbarContainer 或 canvasContainer 容器节点'));
          return;
        }
      }

      const reactRoot = ReactDOM.createRoot(mountPoint);

      const cleanup = () => {
        try {
          reactRoot.unmount();
        } catch (e) {
          console.warn('[TiamoImageEditor SDK] reactRoot.unmount() 清理异常:', e);
        }
        if (hostContainer.parentNode) {
          hostContainer.parentNode.removeChild(hostContainer);
        }
      };

      const handleDone = (result: EditResult) => {
        cleanup();

        const layerState = result.state;
        const hasLayers = !!(layerState && layerState.graphics && layerState.graphics.length > 0);
        if (layerState) {
          saveLayerStateToCache(result.base64, layerState, [
            targetOrSource instanceof HTMLImageElement ? targetOrSource.src : null,
          ]);
        }

        // 自动更新宿主目标 <img>，并在图片节点之外记录分层状态以便下次编辑直接继承
        if (autoUpdateTarget && targetOrSource instanceof HTMLImageElement) {
          const nextSrc = outputType === 'base64' ? result.base64 : URL.createObjectURL(result.blob);
          targetOrSource.src = nextSrc;
          if (hasLayers) {
            ELEMENT_LAYER_STATE_MAP.set(targetOrSource, layerState);
            try {
              targetOrSource.dataset.tiamoLayerState = JSON.stringify(layerState);
            } catch (datasetErr) {
              console.warn('[TiamoImageEditor SDK] dataset.tiamoLayerState 写入失败，已仅保留 WeakMap 缓存:', datasetErr);
            }
            if (!nextSrc.startsWith('blob:')) {
              saveLayerStateToCache(nextSrc, layerState);
            }
          } else {
            ELEMENT_LAYER_STATE_MAP.delete(targetOrSource);
            if (targetOrSource.dataset) {
              delete targetOrSource.dataset.tiamoLayerState;
            }
          }
        }

        // 根据请求格式返回
        let finalOutput: Blob | string | HTMLCanvasElement = result.blob;
        if (outputType === 'base64') finalOutput = result.base64;
        else if (outputType === 'canvas') finalOutput = result.canvas;

        if (options.onComplete) options.onComplete(finalOutput, layerState);
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

      const handleSaveState = (st: EditorLayerState) => {
        if (targetElement) {
          if (st.graphics && st.graphics.length > 0) {
            ELEMENT_LAYER_STATE_MAP.set(targetElement, st);
            try {
              targetElement.dataset.tiamoLayerState = JSON.stringify(st);
            } catch (datasetErr) {
              console.warn('[TiamoImageEditor SDK] 保存状态写入 dataset.tiamoLayerState 失败:', datasetErr);
            }
          } else {
            ELEMENT_LAYER_STATE_MAP.delete(targetElement);
            if (targetElement.dataset) {
              delete targetElement.dataset.tiamoLayerState;
            }
          }
        }
        if (options.onSaveState) {
          options.onSaveState(st);
        }
      };

      // 根据三种模式渲染对应视图
      if (mode === 'toolbar' && targetElement) {
        reactRoot.render(
          <ToolbarPopoverEditor
            targetElement={targetElement}
            initialImage={initialImage}
            initialState={resolvedInitialState}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            onRequestImportGraphic={options.onRequestImportGraphic}
            onSaveState={handleSaveState}
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
            initialState={resolvedInitialState}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            showComplete={options.showComplete}
            showCancel={options.showCancel}
            onRequestImportGraphic={options.onRequestImportGraphic}
            onSaveState={handleSaveState}
            onComplete={handleDone}
            onCancel={handleCancel}
          />
        );
      } else {
        // 默认模态弹窗模式
        reactRoot.render(
          <ModalEditor
            initialImage={initialImage}
            initialState={resolvedInitialState}
            apiKey={apiKey}
            tools={options.tools}
            visibleTools={options.visibleTools}
            hiddenTools={options.hiddenTools}
            showComplete={options.showComplete}
            showCancel={options.showCancel}
            onRequestImportGraphic={options.onRequestImportGraphic}
            onSaveState={handleSaveState}
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

  /**
   * 编程式直接导入图形至当前活跃编辑器画布（供宿主自有素材库调用）
   * @param source 图片 URL、Base64、Blob、File、HTMLImageElement 或 HTMLCanvasElement
   * @param options 初始位置、宽高、比例限制及自动选中配置
   */
  static async importGraphic(
    source: GraphicInputSource,
    options?: ImportGraphicOptions
  ): Promise<ImportedGraphic | null> {
    const activeCore = typeof window !== 'undefined' ? (window as any).__TIAMO_ACTIVE_CORE__ : null;
    if (!activeCore || typeof activeCore.importGraphic !== 'function') {
      throw new Error('当前没有活跃的 TiamoImageEditor 编辑实例，无法导入图形');
    }
    return activeCore.importGraphic(source, options);
  }

  /**
   * 编程式触发当前活跃编辑器的【扩展画布】动作（取所有元素最大外边框生成新画布）
   */
  static async expandCanvas(): Promise<void> {
    const activeCore = typeof window !== 'undefined' ? (window as any).__TIAMO_ACTIVE_CORE__ : null;
    if (!activeCore || typeof activeCore.handleExpandCanvas !== 'function') {
      throw new Error('当前没有活跃的 TiamoImageEditor 编辑实例，无法扩展画布');
    }
    return activeCore.handleExpandCanvas();
  }

  /**
   * 获取当前活跃编辑器的独立分层状态快照（底图 + 所有未融合图形图层 + 层级与锁定状态）
   */
  static getLayerState(): EditorLayerState | null {
    const activeCore = typeof window !== 'undefined' ? (window as any).__TIAMO_ACTIVE_CORE__ : null;
    if (!activeCore || typeof activeCore.getLayerState !== 'function') {
      return null;
    }
    return activeCore.getLayerState();
  }

  /**
   * 向当前活跃编辑器恢复载入独立分层状态数据
   */
  static loadLayerState(state: EditorLayerState | string): boolean {
    const activeCore = typeof window !== 'undefined' ? (window as any).__TIAMO_ACTIVE_CORE__ : null;
    if (!activeCore || typeof activeCore.loadLayerState !== 'function') {
      throw new Error('当前没有活跃的 TiamoImageEditor 编辑实例，无法加载图层状态');
    }
    return activeCore.loadLayerState(state);
  }
}

export default TiamoImageEditor;
