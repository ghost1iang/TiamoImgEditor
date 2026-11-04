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

    // 剪贴板复制通用工具
    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) {}
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
      } catch (_) {}
      return false;
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

    async function mountMainWorkspace(sourceImg) {
      const editor = getEditor();
      if (!editor || typeof editor.distributed !== 'function') {
        setTimeout(() => mountMainWorkspace(sourceImg), 120);
        return;
      }

      currentMainImage = sourceImg;

      // 清理历史残留宿主节点
      document.querySelectorAll('[data-sdk-image-editor-host]').forEach(el => el.remove());
      const tbSlot = document.getElementById('main-toolbar-container');
      const cvSlot = document.getElementById('main-canvas-container');
      if (tbSlot) tbSlot.innerHTML = '';
      if (cvSlot) cvSlot.innerHTML = '';

      try {
        addLog('[主工作区]', '正在挂载全功能大画布工作区...');
        const result = await editor.distributed(
          '#main-toolbar-container',
          '#main-canvas-container',
          sourceImg,
          {
            useShadowDOM: false,
            showComplete: false,
            showCancel: false,
            visibleTools: getSavedVisibleTools(),
            rejectOnCancel: false,
            onComplete: (res) => {
              downloadResult(res);
              showToast('编辑完成，图片已自动下载保存！');
              addLog('[主工作区: 保存]', '图片已完成编辑并触发本地导出。', true);
              // 使用更新后的图片无缝重启工作区
              if (res instanceof Blob) {
                mountMainWorkspace(URL.createObjectURL(res));
              } else if (typeof res === 'string') {
                mountMainWorkspace(res);
              }
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

    // 保存当前图片到本地
    safeOn('btn-save-image', 'click', async () => {
      const activeCore = window.__TIAMO_ACTIVE_CORE__;
      const targetImg = (activeCore && activeCore.currentImage) ? activeCore.currentImage : currentMainImage;
      if (!targetImg) {
        showToast('当前画布无图片可保存，请先打开图片！');
        return;
      }

      const pad = (n) => String(n).padStart(2, '0');
      const d = new Date();
      const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      const filename = `tiamo-image-${timestamp}.png`;

      try {
        if (navigator.share && navigator.canShare && typeof targetImg === 'string' && targetImg.startsWith('data:image')) {
          const res = await fetch(targetImg);
          const blob = await res.blob();
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: filename });
            showToast('已调起系统分享与保存！');
            addLog('[主工作区: 导出]', `已调起系统分享: ${filename}`, true);
            return;
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }

      downloadResult(targetImg, filename);
      showToast('已成功保存当前图片到本地！');
      addLog('[主工作区: 导出]', `已导出图片到本地: ${filename}`, true);
    });

    // 清空画布
    safeOn('btn-clear-canvas', 'click', () => {
      mountMainWorkspace(null);
      showToast('已清空画布，可拖入或粘贴新图片！');
      addLog('[主工作区]', '已重置为空白画布状态');
    });

    // 打开本地图片
    safeOn('main-file-input', 'change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        mountMainWorkspace(evt.target.result);
        showToast('已加载本地图片：' + file.name);
        addLog('[主工作区: 文件]', `已导入本地文件: ${file.name} (${(file.size/1024).toFixed(1)} KB)`, true);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    // 剪贴板粘贴直接加载进主画布
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
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
      const scriptCode = '<script src="./libs/tiamo-image-editor.umd.js"><\/script>\n<script>\n  // 单行唤起原生图片编辑\n  TiamoImageEditor.edit(document.querySelector("#my-image"));\n<\/script>';
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
        const res = await editor.modal(null, { rejectOnCancel: false });
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

    // 模式三：分布式测试槽位
    safeOn('btn-demo-dist-mount', 'click', async () => {
      const editor = getEditor();
      if (!editor) return;
      addLog('[模式三: 分布式]', '正在挂载至测试槽位...');
      try {
        await editor.distributed(
          '#demo-slot-toolbar',
          '#demo-slot-canvas',
          demoInplaceImg ? demoInplaceImg.src : null,
          {
            useShadowDOM: false,
            showComplete: true,
            showCancel: true,
            rejectOnCancel: false,
            onComplete: (res) => {
              addLog('[模式三: 完成]', '测试槽位编辑完成！', true);
              showToast('分布式插槽编辑完成！');
            }
          }
        );
      } catch (e) {
        addLog('[模式三: 异常]', e.message, false, true);
      }
    });

    safeOn('btn-demo-dist-unmount', 'click', () => {
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
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'erase',
      'colorPicker', 'pipette', 'crop', 'fill', 'hd',
      'flipH', 'flipV', 'rotateCcw', 'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow',
      'settings'
    ];
    const RECOMMEND_TOOLS = [
      'rect', 'cropAuto', 'wand', 'tolerance', 'erase', 
      'colorPicker', 'pipette', 'crop', 'rotateCw', 'rotateAny', 'ortho', 'orthoAuto', 'deShadow',
      'settings'
    ];
    const CUTOUT_TOOLS = [
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'erase', 
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
          if (Array.isArray(arr) && arr.length === ALL_TOOLS.length) {
            return arr;
          }
        }
      } catch (_) {}
      // 自己的测试项目默认全选所有工具 (25/25)，并自动覆写矫正本地历史旧缓存
      try {
        localStorage.setItem('tiamo_active_toolbar_tools', JSON.stringify(ALL_TOOLS));
      } catch (_) {}
      return [...ALL_TOOLS];
    }

    function saveAndApplyTools(toolList) {
      const set = new Set(toolList);
      document.querySelectorAll('.tsd-tool-cb').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
      document.querySelectorAll('.modal-tool-cb').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
      const tsdBadge = document.getElementById('tsd-count-badge');
      if (tsdBadge) {
        tsdBadge.textContent = `已显示 ${toolList.length}/${ALL_TOOLS.length}`;
      }
      try {
        localStorage.setItem('tiamo_active_toolbar_tools', JSON.stringify(toolList));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('tiamo-set-visible-tools', { detail: toolList }));
      generateVisibleToolsCode();
    }

    function generateVisibleToolsCode() {
      const checked = Array.from(document.querySelectorAll('.modal-tool-cb:checked')).map(cb => cb.value);
      const codeBox = document.getElementById('generated-code-box');
      if (!codeBox) return;

      const codeStr = `// 引入 SDK 后唤起配置：\nconst result = await TiamoImageEditor.edit(targetImage, {\n  mode: 'modal', // 'modal' | 'toolbar' | 'distributed'\n  outputType: 'blob', // 'blob' | 'base64' | 'canvas'\n  visibleTools: ${JSON.stringify(checked, null, 2)}\n});`;
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
          try {
            localStorage.setItem('tiamo_sdk_pref_mode', r.value);
          } catch (_) {}
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
          try {
            localStorage.setItem('tiamo_sdk_pref_format', r.value);
          } catch (_) {}
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
          try {
            localStorage.setItem('tiamo_sdk_pref_shadow', shadowCb.checked ? 'true' : 'false');
          } catch (_) {}
        });
      }

      // Gemini API Key
      const keyInput = document.getElementById('ssd-gemini-key');
      if (keyInput) {
        keyInput.value = localStorage.getItem('TIAMO_AI_API_KEY') || '';
        keyInput.addEventListener('input', () => {
          try {
            localStorage.setItem('TIAMO_AI_API_KEY', keyInput.value.trim());
          } catch (_) {}
        });
      }

      // 切换 Key 明文/密文显示
      safeOn('btn-ssd-toggle-key-visibility', 'click', () => {
        if (!keyInput) return;
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      });

      // 复制接入代码片段
      safeOn('btn-ssd-copy-snippet', 'click', async () => {
        const selectedMode = (document.querySelector('input[name="ssd-mode"]:checked') || {}).value || 'distributed';
        const selectedFormat = (document.querySelector('input[name="ssd-format"]:checked') || {}).value || 'blob';
        const useShadow = (document.getElementById('ssd-use-shadow') || {}).checked || false;

        let snippet = '';
        if (selectedMode === 'distributed') {
          snippet = `// 分布式工作台挂载模式 (宿主自定义布局)\nconst result = await TiamoImageEditor.distributed(\n  '#your-toolbar-container',\n  '#your-canvas-container',\n  imageSource,\n  {\n    outputType: '${selectedFormat}',\n    useShadowDOM: ${useShadow},\n    onComplete: (res) => console.log('编辑完成:', res)\n  }\n);`;
        } else if (selectedMode === 'modal') {
          snippet = `// 全屏居中弹窗模式 (一键调起)\nconst result = await TiamoImageEditor.edit(imageSource, {\n  mode: 'modal',\n  outputType: '${selectedFormat}',\n  useShadowDOM: ${useShadow}\n});`;
        } else {
          snippet = `// 紧凑胶囊工具条模式 (悬浮胶囊)\nconst result = await TiamoImageEditor.toolbar(\n  '#your-container',\n  imageSource,\n  {\n    outputType: '${selectedFormat}',\n    useShadowDOM: ${useShadow}\n  }\n);`;
        }

        const ok = await copyText(snippet);
        if (ok) showToast('已成功复制当前配置的 SDK 接入调用代码！');
      });

      // 打开接入中心
      safeOn('btn-ssd-open-docs', 'click', () => {
        ssdDropdown.classList.remove('active');
        btnSystemSettings.classList.remove('active');
        const modal = document.getElementById('modal-developer-center');
        if (modal) {
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
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

    // 复制发布指令
    safeOn('btn-copy-publish-cmd', 'click', async () => {
      const ok = await copyText('npm run publish:sdk');
      if (ok) showToast('已复制发布脚本指令：npm run publish:sdk');
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
      // 自己的测试项目默认全选所有工具
      saveAndApplyTools(ALL_TOOLS);
      mountMainWorkspace(null);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
