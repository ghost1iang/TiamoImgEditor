    // ----------------------------------------------------
    // 1. 全局日志与提示工具
    // ----------------------------------------------------
    const modalLogTerminal = document.getElementById('modal-log-terminal');
    function addLog(tag, msg, isSuccess = false, isWarn = false) {
      if (!modalLogTerminal) return;
      const now = new Date().toTimeString().split(' ')[0];
      const div = document.createElement('div');
      div.className = 'log-item';
      div.innerHTML = `
        <span class="log-time">[${now}]</span>
        <span class="log-tag">${tag}</span>
        <span class="log-msg ${isSuccess ? 'log-success' : ''} ${isWarn ? 'log-warn' : ''}">${msg}</span>
      `;
      modalLogTerminal.appendChild(div);
      modalLogTerminal.scrollTop = modalLogTerminal.scrollHeight;
    }

    // 吐司提示
    let toastTimer = null;
    function showToast(text) {
      const box = document.getElementById('toast-box');
      const textEl = document.getElementById('toast-text');
      if (!box || !textEl) return;
      textEl.textContent = text;
      box.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        box.classList.remove('show');
      }, 2600);
    }

    // 结果自动下载
    function downloadResult(res, filename = 'edited-image.png') {
      if (!res) return;
      const link = document.createElement('a');
      link.download = filename;
      if (res instanceof Blob) {
        link.href = URL.createObjectURL(res);
      } else if (typeof res === 'string') {
        link.href = res;
      } else if (res instanceof HTMLCanvasElement) {
        link.href = res.toDataURL('image/png');
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // 导出并下载独立分层状态 JSON 文件（图片之外另存一份图层数据，便于下次继承恢复）
    function downloadJsonFile(dataObj, filename = 'tiamo-layers.json') {
      if (!dataObj) return;
      const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 剪贴板复制通用工具
    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        console.warn('[workbench] navigator.clipboard.writeText 失败，尝试降级选区复制:', err);
      }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) return true;
      } catch (err) {
        console.warn('[workbench] execCommand copy 失败:', err);
      }
      return false;
    }

    function safeStorageSet(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        console.warn(`[workbench] 写入 localStorage(${key}) 失败:`, err);
      }
    }

    // 获取全局 SDK 实例
    function getEditor() {
      const w = window.TiamoImageEditor;
      if (!w) return null;
      if (typeof w.distributed === 'function') return w;
      if (w.TiamoImageEditor && typeof w.TiamoImageEditor.distributed === 'function') return w.TiamoImageEditor;
      if (w.default && typeof w.default.distributed === 'function') return w.default;
      return w;
    }

    // ----------------------------------------------------
    // 2. 主工作区大画布挂载与维护
    // ----------------------------------------------------
    let currentMainImage = null;
    let currentLayerState = null;

    async function mountMainWorkspace(sourceImg, initialState = null) {
      const editor = getEditor();
      if (!editor || typeof editor.distributed !== 'function') {
        setTimeout(() => mountMainWorkspace(sourceImg, initialState), 120);
        return;
      }

      currentMainImage = (initialState && initialState.baseImage) ? initialState.baseImage : sourceImg;
      currentLayerState = initialState || null;

      // 先经由活跃核心优雅卸载旧 React Root，杜绝 window 监听器泄漏
      const prevCore = window.__TIAMO_ACTIVE_CORE__;
      if (prevCore && typeof prevCore.handleCancel === 'function') {
        try {
          prevCore.handleCancel();
        } catch (err) {
          console.warn('[mountMainWorkspace handleCancel]', err);
        }
      }

      // 清理历史残留宿主节点
      document.querySelectorAll('[data-sdk-image-editor-host]').forEach(el => el.remove());
      const tbSlot = document.getElementById('main-toolbar-container');
      const cvSlot = document.getElementById('main-canvas-container');
      if (tbSlot) tbSlot.innerHTML = '';
      if (cvSlot) cvSlot.innerHTML = '';

      try {
        addLog('[主工作区]', '正在挂载全功能大画布工作区...');
        await editor.distributed(
          '#main-toolbar-container',
          '#main-canvas-container',
          currentMainImage,
          {
            useShadowDOM: false,
            showComplete: false,
            showCancel: false,
            rejectOnCancel: false,
            initialState: currentLayerState,
            visibleTools: getSavedVisibleTools(),
            onSaveState: (st) => {
              currentLayerState = st;
            },
            onComplete: (res, state) => {
              downloadResult(res);
              const hasLayers = !!(state && Array.isArray(state.graphics) && state.graphics.length > 0);
              if (hasLayers) {
                downloadJsonFile(state, 'edited-image.layers.json');
              }
              showToast(hasLayers ? '编辑完成，已导出图片及独立分层状态数据！' : '编辑完成，图片已自动下载保存！');
              addLog('[主工作区: 保存]', hasLayers ? '已导出图片并另存 .layers.json 分层状态，下次编辑将自动继承。' : '图片已完成编辑并触发本地导出。', true);
              const nextImg = (state && state.baseImage)
                ? state.baseImage
                : (res instanceof Blob ? URL.createObjectURL(res) : (typeof res === 'string' ? res : currentMainImage));
              mountMainWorkspace(nextImg, state || null);
            }
          }
        );
      } catch (err) {
        console.error('[mountMainWorkspace]', err);
      }
    }

    // 检查并更新版本显示
    function syncVersionUI() {
      const editor = getEditor();
      const topVer = document.getElementById('top-version-text');
      const modalVer = document.getElementById('modal-ver-tag');
      if (editor && editor.version) {
        const v = String(editor.version).startsWith('v') ? editor.version : `v${editor.version}`;
        if (topVer) topVer.textContent = `${v}`;
        if (modalVer) modalVer.textContent = `版本: ${v}`;
      }
    }

    // ----------------------------------------------------
    // 3. 顶栏主动作事件监听 (打开本地、保存到本地、清空画布)
    // ----------------------------------------------------
    function safeOn(idOrEl, event, handler) {
      const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
      if (el) el.addEventListener(event, handler);
    }

    // 保存当前图片到本地（存在独立图形图层时不拍平破坏当前图层，同时在图片之外另存 .layers.json 状态文件）
    safeOn('btn-save-image', 'click', async () => {
      const activeCore = window.__TIAMO_ACTIVE_CORE__;
      const layerState = (activeCore && typeof activeCore.getLayerState === 'function')
        ? activeCore.getLayerState()
        : null;
      const hasLayers = !!(layerState && Array.isArray(layerState.graphics) && layerState.graphics.length > 0);

      let targetImg = (activeCore && activeCore.currentImage) ? activeCore.currentImage : currentMainImage;
      if (activeCore && activeCore.currentImage && typeof activeCore.exportResult === 'function') {
        try {
          targetImg = await activeCore.exportResult('base64');
        } catch (err) {
          console.error('[workbench save exportResult]', err);
          const errMsg = err?.message || String(err);
          showToast(`导出合成图片失败，已中止保存: ${errMsg}`);
          addLog('[主工作区: 导出异常]', `合成导出失败，已中止保存: ${errMsg}`, false, true);
          return;
        }
      }
      if (!targetImg) {
        showToast('当前画布无图片可保存，请先打开图片！');
        return;
      }

      const pad = (n) => String(n).padStart(2, '0');
      const d = new Date();
      const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      const filename = `tiamo-image-${timestamp}.png`;
      const stateFilename = `tiamo-image-${timestamp}.layers.json`;

      let sharedOk = false;
      try {
        if (navigator.share && navigator.canShare && typeof targetImg === 'string' && targetImg.startsWith('data:image')) {
          const res = await fetch(targetImg);
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            sharedOk = true;
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('[navigator.share]', err);
        addLog('[系统分享: 异常]', err ? err.message : String(err), false, true);
        showToast('系统分享异常: ' + (err ? err.message : '未知错误'));
      }

      if (!sharedOk) {
        downloadResult(targetImg, filename);
      }
      if (hasLayers) {
        downloadJsonFile(layerState, stateFilename);
      }

      showToast(
        hasLayers
          ? `已保存图片与分层数据 (${stateFilename})，下次打开可继承状态！`
          : (sharedOk ? '已调起系统分享与保存！' : '已成功保存当前图片到本地！')
      );
      addLog(
        '[主工作区: 导出]',
        hasLayers
          ? `已导出图片 ${filename} 并另存独立分层状态 ${stateFilename}`
          : `已导出图片到本地: ${filename}`,
        true
      );
    });

    // 清空画布
    safeOn('btn-clear-canvas', 'click', () => {
      mountMainWorkspace(null, null);
      showToast('已清空画布，可拖入或粘贴新图片！');
      addLog('[主工作区]', '已重置为空白画布状态');
    });

    // 打开本地图片或 .layers.json 分层状态文件（支持同时选中）
    safeOn('main-file-input', 'change', (e) => {
      const files = Array.from((e.target && e.target.files) || []);
      if (files.length === 0) return;

      const jsonFile = files.find(f => f.name.toLowerCase().endsWith('.json') || f.type === 'application/json');
      if (jsonFile) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            if (parsed && parsed.type === 'tiamo-image-editor-state' && parsed.baseImage) {
              mountMainWorkspace(parsed.baseImage, parsed);
              showToast(`已继承并恢复分层状态：${jsonFile.name}`);
              addLog('[主工作区: 图层恢复]', `已从 ${jsonFile.name} 恢复底图与 ${(parsed.graphics || []).length} 个独立图层`, true);
              return;
            }
          } catch (err) {
            console.error('[load layers json]', err);
          }
          showToast('图层状态文件格式无效！');
        };
        reader.onerror = () => {
          console.error('[load layers json error]', reader.error);
          showToast(`读取图层状态文件失败: ${jsonFile.name}`);
          addLog('[主工作区: 文件异常]', `读取图层状态文件 ${jsonFile.name} 失败`, false, true);
        };
        reader.readAsText(jsonFile);
        e.target.value = '';
        return;
      }

      const file = files[0];
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPDF) {
        const activeCore = window.__TIAMO_ACTIVE_CORE__;
        if (activeCore && typeof activeCore.processFile === 'function') {
          activeCore.processFile(file);
          showToast('正在解析 PDF 文档：' + file.name);
          addLog('[主工作区: PDF]', `已载入 PDF 文件: ${file.name} (${(file.size/1024).toFixed(1)} KB)`, true);
        } else {
          showToast('工作区尚未就绪，请稍后重试导入 PDF！');
          addLog('[主工作区: PDF 异常]', `工作区核心未就绪，无法解析 ${file.name}`, false, true);
        }
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        mountMainWorkspace(evt.target.result, null);
        showToast('已加载本地图片：' + file.name);
        addLog('[主工作区: 文件]', `已导入本地文件: ${file.name} (${(file.size/1024).toFixed(1)} KB)`, true);
      };
      reader.onerror = () => {
        console.error('[load local image error]', reader.error);
        showToast(`读取本地图片失败: ${file.name}`);
        addLog('[主工作区: 文件异常]', `读取本地图片 ${file.name} 失败`, false, true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    // 剪贴板粘贴直接加载进主画布
    window.addEventListener('paste', (e) => {
      const clipboardData = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
      const items = clipboardData && clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (evt) => {
              mountMainWorkspace(evt.target.result);
              showToast('已从剪贴板粘贴并载入截图！');
              addLog('[主工作区: 粘贴]', '已从剪贴板成功读取截图并载入画布', true);
            };
            reader.onerror = () => {
              console.error('[paste image error]', reader.error);
              showToast('读取剪贴板图片失败！');
              addLog('[主工作区: 粘贴异常]', '从剪贴板读取图片失败', false, true);
            };
            reader.readAsDataURL(blob);
            break;
          }
        }
      }
    });

    // ----------------------------------------------------
    // 4. 获取 SDK 模态弹窗系统交互
    // ----------------------------------------------------
    const sdkModal = document.getElementById('sdk-modal-overlay');

    safeOn('btn-open-sdk-modal', 'click', () => {
      if (sdkModal) sdkModal.classList.add('active');
      addLog('[开发者中心]', '打开 SDK 获取与演示中心');
      generateVisibleToolsCode();
    });

    safeOn('btn-close-sdk-modal', 'click', () => {
      if (sdkModal) sdkModal.classList.remove('active');
    });

    if (sdkModal) {
      sdkModal.addEventListener('click', (e) => {
        if (e.target === sdkModal) {
          sdkModal.classList.remove('active');
        }
      });
    }

    // 复制引入代码
    safeOn('btn-copy-script-tag', 'click', async () => {
      const scriptCode = '<script src="./dist/tiamo-image-editor.umd.js"><\/script>\n<script>\n  // 单行唤起原生图片编辑\n  TiamoImageEditor.edit(document.querySelector("#my-image"));\n<\/script>';
      const ok = await copyText(scriptCode);
      if (ok) showToast('已成功复制 SDK 引入代码！');
    });

    // Tab 选项卡切换
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const content = document.getElementById(tabId);
        if (content) content.classList.add('active');
      });
    });

    // ----------------------------------------------------
    // 5. 弹窗内的三大模式演示测试
    // ----------------------------------------------------
    // 模式一：带图弹窗
    safeOn('btn-demo-modal', 'click', async () => {
      const editor = getEditor();
      if (!editor) return;
      const targetImg = document.getElementById('demo-modal-img');
      addLog('[模式一: 弹窗]', '唤起带图模态窗口...');
      try {
        const res = await editor.modal(targetImg, {
          autoUpdateTarget: true,
          rejectOnCancel: false,
          visibleTools: getSavedVisibleTools(),
        });
        if (res) {
          addLog('[模式一: 完成]', '模态弹窗编辑已完成，目标图片已更新！', true);
          showToast('弹窗编辑完成！');
        } else {
          addLog('[模式一: 取消]', '用户关闭了弹窗');
        }
      } catch (e) {
        addLog('[模式一: 异常]', e.message, false, true);
      }
    });

    // 模式一：空白弹窗
    safeOn('btn-demo-modal-empty', 'click', async () => {
      const editor = getEditor();
      if (!editor) return;
      addLog('[模式一: 空白]', '打开空白模态弹窗...');
      try {
        const res = await editor.modal(null, {
          rejectOnCancel: false,
          visibleTools: getSavedVisibleTools(),
        });
        if (res) {
          const img = document.getElementById('demo-modal-img');
          if (img) img.src = res instanceof Blob ? URL.createObjectURL(res) : res;
          addLog('[模式一: 完成]', '新导入/编辑的图片已更新至卡片预览！', true);
          showToast('空白弹窗导入完成！');
        }
      } catch (e) {
        addLog('[模式一: 异常]', e.message, false, true);
      }
    });

    // 模式二：原地吸附
    const demoInplaceImg = document.getElementById('demo-inplace-img');
    const originalDemoInplaceSrc = demoInplaceImg ? demoInplaceImg.src : '';

    safeOn('btn-demo-inplace', 'click', async () => {
      const editor = getEditor();
      if (!editor || !demoInplaceImg) return;
      addLog('[模式二: 原地]', '弹出原地浮动工具栏修图...');
      try {
        const res = await editor.toolbar(demoInplaceImg, {
          autoUpdateTarget: true,
          rejectOnCancel: false,
          visibleTools: getSavedVisibleTools(),
        });
        if (res) {
          addLog('[模式二: 完成]', '原地编辑完成，目标节点已更新！', true);
          showToast('原地编辑完成！');
        }
      } catch (e) {
        addLog('[模式二: 异常]', e.message, false, true);
      }
    });

    safeOn('btn-demo-inplace-reset', 'click', () => {
      if (demoInplaceImg && originalDemoInplaceSrc) {
        demoInplaceImg.src = originalDemoInplaceSrc;
      }
      addLog('[模式二: 重置]', '已还原模式二原图');
    });

    // 模式三：分布式测试槽位（保存时继承分层状态）
    let demoDistLayerState = null;
    let isDemoDistMounted = false;
    safeOn('btn-demo-dist-mount', 'click', async () => {
      const editor = getEditor();
      if (!editor) return;
      addLog('[模式三: 分布式]', '正在挂载至测试槽位...');
      try {
        isDemoDistMounted = true;
        await editor.distributed(
          '#demo-slot-toolbar',
          '#demo-slot-canvas',
          (demoDistLayerState && demoDistLayerState.baseImage) ? demoDistLayerState.baseImage : (demoInplaceImg ? demoInplaceImg.src : null),
          {
            useShadowDOM: false,
            showComplete: true,
            showCancel: true,
            rejectOnCancel: false,
            initialState: demoDistLayerState,
            visibleTools: getSavedVisibleTools(),
            onSaveState: (st) => {
              demoDistLayerState = st;
            },
            onComplete: (res, st) => {
              isDemoDistMounted = false;
              if (st) demoDistLayerState = st;
              addLog('[模式三: 完成]', `测试槽位编辑完成${st && st.graphics && st.graphics.length ? `（已记录 ${st.graphics.length} 个独立图层状态）` : ''}！`, true);
              showToast('分布式插槽编辑完成！');
            }
          }
        );
      } catch (e) {
        isDemoDistMounted = false;
        addLog('[模式三: 异常]', e.message, false, true);
      }
    });

    safeOn('btn-demo-dist-unmount', 'click', () => {
      if (!isDemoDistMounted) {
        showToast('测试槽位当前尚未挂载');
        return;
      }
      isDemoDistMounted = false;
      const demoCore = window.__TIAMO_ACTIVE_CORE__;
      if (demoCore && typeof demoCore.handleCancel === 'function') {
        try {
          demoCore.handleCancel();
        } catch (err) {
          console.warn('[demo-dist unmount handleCancel]', err);
        }
      }
      const tb = document.getElementById('demo-slot-toolbar');
      const cv = document.getElementById('demo-slot-canvas');
      if (tb) tb.innerHTML = '[宿主工具栏槽位 #demo-slot-toolbar]';
      if (cv) cv.innerHTML = '[宿主画布槽位 #demo-slot-canvas]';
      addLog('[模式三: 卸载]', '已卸载测试槽位');
    });

    // ----------------------------------------------------
    // 6. 工具栏预设与导航栏右上角设置下拉交互
    // ----------------------------------------------------
    const ALL_TOOLS = [
      'rect', 'cropAuto', 'lasso', 'quad', 'invert', 'clear',
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'spillRadius', 'erase',
      'colorPicker', 'pipette', 'crop', 'fill', 'hd', 'importGraphic', 'expandCanvas', 'border',
      'flipH', 'flipV', 'rotateCcw', 'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow',
      'settings'
    ];
    const RECOMMEND_TOOLS = [
      'rect', 'cropAuto', 'wand', 'tolerance', 'spillRadius', 'erase', 
      'colorPicker', 'pipette', 'crop', 'importGraphic', 'expandCanvas', 'border', 'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow',
      'settings'
    ];
    const CUTOUT_TOOLS = [
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'spillRadius', 'erase', 
      'crop', 'settings'
    ];
    const TRANSFORM_TOOLS = [
      'rect', 'cropAuto', 'quad', 'flipH', 'flipV', 'rotateCcw', 
      'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow', 'settings'
    ];

    function getSavedVisibleTools() {
      try {
        const saved = localStorage.getItem('tiamo_active_toolbar_tools');
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr) && arr.length > 0) {
            return arr;
          }
        }
      } catch (err) {
        console.warn('[workbench] 读取工具栏显示配置失败:', err);
      }
      return [...ALL_TOOLS];
    }

    function saveAndApplyTools(toolList) {
      const set = new Set(toolList);
      document.querySelectorAll('.modal-tool-cb').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
      document.querySelectorAll('.ssd-tool-cb').forEach(cb => {
        cb.checked = set.has(cb.value);
        const chip = cb.closest('.ssd-tool-chip');
        if (chip) {
          if (cb.checked) chip.classList.add('active');
          else chip.classList.remove('active');
        }
      });
      const ssdCount = document.getElementById('ssd-selected-count');
      if (ssdCount) {
        ssdCount.textContent = `已选 ${toolList.length}/${ALL_TOOLS.length}`;
      }
      safeStorageSet('tiamo_active_toolbar_tools', JSON.stringify(toolList));
      window.dispatchEvent(new CustomEvent('tiamo-set-visible-tools', { detail: toolList }));
      generateVisibleToolsCode();
    }

    function generateVisibleToolsCode() {
      const checked = Array.from(document.querySelectorAll('.modal-tool-cb:checked')).map(cb => cb.value);
      const codeBox = document.getElementById('generated-code-box');
      if (!codeBox) return;

      const hasImportGraphic = checked.includes('importGraphic');
      const importHookSnippet = hasImportGraphic
        ? `,\n  // 可选：拦截工具栏【导入图形】按钮，改为打开宿主自有素材库\n  onRequestImportGraphic: async (importGraphic) => {\n    // const url = await openHostAssetPicker();\n    // return url ? { source: url, options: { w: 240, autoSelect: true } } : null;\n  }`
        : '';
      const directCallComment = hasImportGraphic
        ? `\n\n// 外部宿主素材库直接导入图形至当前活跃画布：\n// await TiamoImageEditor.importGraphic('/assets/stamp.png', { name: '印章', w: 220, autoSelect: true });\n// await TiamoImageEditor.expandCanvas();`
        : '';

      const codeStr = `// 引入 SDK 后唤起配置：\nconst result = await TiamoImageEditor.edit(targetImage, {\n  mode: 'modal', // 'modal' | 'toolbar' | 'distributed'\n  outputType: 'blob', // 'blob' | 'base64' | 'canvas'\n  visibleTools: ${JSON.stringify(checked, null, 2)}${importHookSnippet}\n});${directCallComment}`;
      codeBox.textContent = codeStr;
    }

    // ----------------------------------------------------
    // 6. 导航栏系统设置与 SDK 接入配置 (如何使用 SDK)
    // ----------------------------------------------------
    const btnSystemSettings = document.getElementById('btn-system-settings');
    const ssdDropdown = document.getElementById('system-settings-dropdown');

    if (btnSystemSettings && ssdDropdown) {
      btnSystemSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = ssdDropdown.classList.contains('active');
        if (isOpen) {
          ssdDropdown.classList.remove('active');
          btnSystemSettings.classList.remove('active');
        } else {
          ssdDropdown.classList.add('active');
          btnSystemSettings.classList.add('active');
        }
      });

      safeOn('btn-close-ssd', 'click', () => {
        ssdDropdown.classList.remove('active');
        btnSystemSettings.classList.remove('active');
      });

      window.addEventListener('click', (e) => {
        if (!ssdDropdown.contains(e.target) && !btnSystemSettings.contains(e.target)) {
          ssdDropdown.classList.remove('active');
          btnSystemSettings.classList.remove('active');
        }
      });

      // 模式切换单选
      const modeRadios = document.querySelectorAll('input[name="ssd-mode"]');
      modeRadios.forEach(r => {
        r.addEventListener('change', () => {
          document.querySelectorAll('.ssd-radio-card').forEach(card => card.classList.remove('active'));
          const parent = r.closest('.ssd-radio-card');
          if (parent) parent.classList.add('active');
          safeStorageSet('tiamo_sdk_pref_mode', r.value);
        });
      });

      // 恢复模式选择
      const savedMode = localStorage.getItem('tiamo_sdk_pref_mode');
      if (savedMode) {
        const targetRadio = document.querySelector(`input[name="ssd-mode"][value="${savedMode}"]`);
        if (targetRadio) {
          targetRadio.checked = true;
          document.querySelectorAll('.ssd-radio-card').forEach(card => card.classList.remove('active'));
          const parent = targetRadio.closest('.ssd-radio-card');
          if (parent) parent.classList.add('active');
        }
      }

      // 输出格式切换
      const fmtRadios = document.querySelectorAll('input[name="ssd-format"]');
      fmtRadios.forEach(r => {
        r.addEventListener('change', () => {
          document.querySelectorAll('.ssd-tag-radio').forEach(t => t.classList.remove('active'));
          const parent = r.closest('.ssd-tag-radio');
          if (parent) parent.classList.add('active');
          safeStorageSet('tiamo_sdk_pref_format', r.value);
        });
      });

      // 恢复格式选择
      const savedFormat = localStorage.getItem('tiamo_sdk_pref_format');
      if (savedFormat) {
        const targetFmt = document.querySelector(`input[name="ssd-format"][value="${savedFormat}"]`);
        if (targetFmt) {
          targetFmt.checked = true;
          document.querySelectorAll('.ssd-tag-radio').forEach(t => t.classList.remove('active'));
          const parent = targetFmt.closest('.ssd-tag-radio');
          if (parent) parent.classList.add('active');
        }
      }

      // Shadow DOM 开关
      const shadowCb = document.getElementById('ssd-use-shadow');
      if (shadowCb) {
        shadowCb.checked = localStorage.getItem('tiamo_sdk_pref_shadow') === 'true';
        shadowCb.addEventListener('change', () => {
          safeStorageSet('tiamo_sdk_pref_shadow', shadowCb.checked ? 'true' : 'false');
        });
      }

      // Gemini API Key
      const keyInput = document.getElementById('ssd-gemini-key');
      if (keyInput) {
        keyInput.value = localStorage.getItem('TIAMO_AI_API_KEY') || '';
        keyInput.addEventListener('input', () => {
          safeStorageSet('TIAMO_AI_API_KEY', keyInput.value.trim());
        });
      }

      // 切换 Key 明文/密文显示
      safeOn('btn-ssd-toggle-key-visibility', 'click', () => {
        if (!keyInput) return;
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      });

      // --------------------------------------------------
      // 按钮与功能按需带入 SDK 定制
      // --------------------------------------------------
      safeOn('ssd-preset-all', 'click', () => saveAndApplyTools(ALL_TOOLS));
      safeOn('ssd-preset-recommend', 'click', () => saveAndApplyTools(RECOMMEND_TOOLS));
      safeOn('ssd-preset-cutout', 'click', () => saveAndApplyTools(CUTOUT_TOOLS));
      safeOn('ssd-preset-transform', 'click', () => saveAndApplyTools(TRANSFORM_TOOLS));
      safeOn('ssd-preset-clear', 'click', () => saveAndApplyTools(['settings']));

      document.querySelectorAll('.ssd-tool-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const checked = Array.from(document.querySelectorAll('.ssd-tool-cb:checked')).map(c => c.value);
          saveAndApplyTools(checked);
        });
      });

      // 操作按钮（完成/取消）定制
      const cbComplete = document.getElementById('ssd-action-complete');
      const cbCancel = document.getElementById('ssd-action-cancel');
      if (cbComplete) {
        const savedComplete = localStorage.getItem('tiamo_sdk_pref_complete');
        cbComplete.checked = savedComplete !== 'false';
        const chip = cbComplete.closest('.ssd-tool-chip');
        if (chip) chip.classList.toggle('active', cbComplete.checked);
        cbComplete.addEventListener('change', () => {
          if (chip) chip.classList.toggle('active', cbComplete.checked);
          safeStorageSet('tiamo_sdk_pref_complete', cbComplete.checked ? 'true' : 'false');
        });
      }

      if (cbCancel) {
        const savedCancel = localStorage.getItem('tiamo_sdk_pref_cancel');
        cbCancel.checked = savedCancel !== 'false';
        const chip = cbCancel.closest('.ssd-tool-chip');
        if (chip) chip.classList.toggle('active', cbCancel.checked);
        cbCancel.addEventListener('change', () => {
          if (chip) chip.classList.toggle('active', cbCancel.checked);
          safeStorageSet('tiamo_sdk_pref_cancel', cbCancel.checked ? 'true' : 'false');
        });
      }

      // 复制接入代码片段 (动态携带当前勾选的按钮功能)
      safeOn('btn-ssd-copy-snippet', 'click', async () => {
        const selectedMode = (document.querySelector('input[name="ssd-mode"]:checked') || {}).value || 'distributed';
        const selectedFormat = (document.querySelector('input[name="ssd-format"]:checked') || {}).value || 'blob';
        const useShadow = (document.getElementById('ssd-use-shadow') || {}).checked || false;
        const selectedTools = Array.from(document.querySelectorAll('.ssd-tool-cb:checked')).map(cb => cb.value);
        const showComplete = cbComplete ? cbComplete.checked : true;
        const showCancel = cbCancel ? cbCancel.checked : true;

        const toolsCode = JSON.stringify(selectedTools, null, 4).replace(/\n/g, '\n    ');
        const hasImportGraphic = selectedTools.includes('importGraphic');
        const importHookLine = hasImportGraphic
          ? `,\n    // 可选：拦截【导入图形】按钮接管宿主素材库\n    onRequestImportGraphic: async (importGraphic) => {\n      // const url = await openHostAssetPicker();\n      // return url;\n    }`
          : '';
        const directImportTrailer = hasImportGraphic
          ? `\n\n// 外部点击宿主素材直接插入画布：\n// await TiamoImageEditor.importGraphic(assetUrl, { name: '素材', w: 240, autoSelect: true });`
          : '';

        let snippet = '';
        if (selectedMode === 'distributed') {
          snippet = `// 分布式工作台挂载模式 (宿主自定义布局)\nconst result = await TiamoImageEditor.distributed(\n  '#your-toolbar-container',\n  '#your-canvas-container',\n  imageSource,\n  {\n    outputType: '${selectedFormat}',\n    useShadowDOM: ${useShadow},\n    showComplete: ${showComplete},\n    showCancel: ${showCancel},\n    visibleTools: ${toolsCode}${importHookLine},\n    onComplete: (res) => console.log('编辑完成:', res)\n  }\n);${directImportTrailer}`;
        } else if (selectedMode === 'modal') {
          snippet = `// 全屏居中弹窗模式 (一键调起)\nconst result = await TiamoImageEditor.edit(imageSource, {\n  mode: 'modal',\n  outputType: '${selectedFormat}',\n  useShadowDOM: ${useShadow},\n  showComplete: ${showComplete},\n  showCancel: ${showCancel},\n  visibleTools: ${toolsCode}${importHookLine}\n});${directImportTrailer}`;
        } else {
          snippet = `// 原地浮动工具条模式 (传入目标 <img> / <canvas> DOM 节点)\nconst result = await TiamoImageEditor.toolbar(\n  document.querySelector('#your-target-image'),\n  {\n    outputType: '${selectedFormat}',\n    useShadowDOM: ${useShadow},\n    showComplete: ${showComplete},\n    showCancel: ${showCancel},\n    visibleTools: ${toolsCode}${importHookLine}\n  }\n);${directImportTrailer}`;
        }

        const ok = await copyText(snippet);
        if (ok) showToast('已成功复制携带自定义按钮的 SDK 接入调用代码！');
      });

      // 打开接入中心
      safeOn('btn-ssd-open-docs', 'click', () => {
        ssdDropdown.classList.remove('active');
        btnSystemSettings.classList.remove('active');
        const modal = document.getElementById('sdk-modal-overlay');
        if (modal) {
          modal.classList.add('active');
        }
      });
    }

    // 开发者中心 Modal 内预设与复选框
    safeOn('modal-preset-all', 'click', () => saveAndApplyTools(ALL_TOOLS));
    safeOn('modal-preset-recommend', 'click', () => saveAndApplyTools(RECOMMEND_TOOLS));
    safeOn('modal-preset-cutout', 'click', () => saveAndApplyTools(CUTOUT_TOOLS));
    safeOn('modal-preset-transform', 'click', () => saveAndApplyTools(TRANSFORM_TOOLS));
    safeOn('modal-preset-clear', 'click', () => saveAndApplyTools(['settings']));

    document.querySelectorAll('.modal-tool-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = Array.from(document.querySelectorAll('.modal-tool-cb:checked')).map(c => c.value);
        saveAndApplyTools(checked);
      });
    });

    safeOn('btn-copy-generated-code', 'click', async () => {
      const codeBox = document.getElementById('generated-code-box');
      if (codeBox) {
        const ok = await copyText(codeBox.textContent);
        if (ok) showToast('已成功复制配置调用代码！');
      }
    });

    // 复制构建指令
    safeOn('btn-copy-publish-cmd', 'click', async () => {
      const ok = await copyText('npm run build');
      if (ok) showToast('已复制构建指令：npm run build');
    });

    // 清空日志
    safeOn('btn-modal-clear-log', 'click', () => {
      if (modalLogTerminal) {
        modalLogTerminal.innerHTML = '<div class="log-item"><span class="log-time">[' + new Date().toTimeString().split(' ')[0] + ']</span><span class="log-tag">[清空]</span><span class="log-msg">日志已清空</span></div>';
      }
    });

    // ----------------------------------------------------
    // 7. 页面启动自检与主工作区初始化
    // ----------------------------------------------------
    function initApp() {
      syncVersionUI();
      // 默认全选所有工具按钮 (全部 29 个工具默认选上)
      const initialTools = [...ALL_TOOLS];
      saveAndApplyTools(initialTools);
      mountMainWorkspace(null);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
