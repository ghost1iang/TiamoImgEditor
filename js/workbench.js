    // ----------------------------------------------------
    // 1. 内置默认高品质测试素材 (矢量风景插画，供测试魔棒抠图与选区)
    // ----------------------------------------------------
    const DEFAULT_SAMPLE_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><defs><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='%23e0f2fe'/><stop offset='100%' stop-color='%23bae6fd'/></linearGradient><linearGradient id='lake' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='%2338bdf8'/><stop offset='100%' stop-color='%230284c7'/></linearGradient></defs><rect width='800' height='500' fill='url(%23sky)'/><circle cx='620' cy='140' r='55' fill='%23fbbf24'/><polygon points='160,110 320,340 0,340' fill='%2394a3b8'/><polygon points='380,150 560,340 200,340' fill='%2364748b'/><polygon points='260,200 440,360 80,360' fill='%23475569'/><polygon points='540,180 720,350 360,350' fill='%23334155'/><rect x='0' y='340' width='800' height='160' fill='url(%23lake)'/><polygon points='680,260 720,350 640,350' fill='%23047857'/><polygon points='690,290 735,360 645,360' fill='%23065f46'/><polygon points='100,280 135,355 65,355' fill='%23047857'/></svg>";

    // 全局日志记录
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
            showComplete: true,
            showCancel: false,
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
    // 3. 顶栏主动作事件监听
    // ----------------------------------------------------
    // 载入示例素材
    document.getElementById('btn-load-sample').addEventListener('click', () => {
      mountMainWorkspace(DEFAULT_SAMPLE_IMAGE);
      showToast('已载入精选示例素材！');
      addLog('[主工作区]', '重新载入内置示例图片');
    });

    // 清空画布
    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      mountMainWorkspace(null);
      showToast('已清空画布，可拖入或粘贴新图片！');
      addLog('[主工作区]', '已重置为空白画布状态');
    });

    // 打开本地图片
    const mainFileInput = document.getElementById('main-file-input');
    mainFileInput.addEventListener('change', (e) => {
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

    // 强制刷新
    document.getElementById('btn-force-refresh').addEventListener('click', () => {
      try {
        sessionStorage.clear();
        localStorage.clear();
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(n => caches.delete(n)));
        }
      } catch (_) {}
      window.location.reload();
    });

    // ----------------------------------------------------
    // 4. 获取 SDK 模态弹窗系统交互
    // ----------------------------------------------------
    const sdkModal = document.getElementById('sdk-modal-overlay');
    const btnOpenSdkModal = document.getElementById('btn-open-sdk-modal');
    const btnCloseSdkModal = document.getElementById('btn-close-sdk-modal');

    btnOpenSdkModal.addEventListener('click', () => {
      sdkModal.classList.add('active');
      addLog('[开发者中心]', '打开 SDK 获取与演示中心');
      generateVisibleToolsCode();
    });

    btnCloseSdkModal.addEventListener('click', () => {
      sdkModal.classList.remove('active');
    });

    sdkModal.addEventListener('click', (e) => {
      if (e.target === sdkModal) {
        sdkModal.classList.remove('active');
      }
    });

    // 复制引入代码
    document.getElementById('btn-copy-script-tag').addEventListener('click', async () => {
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
    document.getElementById('btn-demo-modal').addEventListener('click', async () => {
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
    document.getElementById('btn-demo-modal-empty').addEventListener('click', async () => {
      const editor = getEditor();
      if (!editor) return;
      addLog('[模式一: 空白]', '打开空白模态弹窗...');
      try {
        const res = await editor.modal(null, { rejectOnCancel: false });
        if (res) {
          const img = document.getElementById('demo-modal-img');
          img.src = res instanceof Blob ? URL.createObjectURL(res) : res;
          addLog('[模式一: 完成]', '新导入/编辑的图片已更新至卡片预览！', true);
          showToast('空白弹窗导入完成！');
        }
      } catch (e) {
        addLog('[模式一: 异常]', e.message, false, true);
      }
    });

    // 模式二：原地吸附
    const demoInplaceImg = document.getElementById('demo-inplace-img');
    const originalDemoInplaceSrc = demoInplaceImg.src;

    document.getElementById('btn-demo-inplace').addEventListener('click', async () => {
      const editor = getEditor();
      if (!editor) return;
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

    document.getElementById('btn-demo-inplace-reset').addEventListener('click', () => {
      demoInplaceImg.src = originalDemoInplaceSrc;
      addLog('[模式二: 重置]', '已还原模式二原图');
    });

    // 模式三：分布式测试槽位
    document.getElementById('btn-demo-dist-mount').addEventListener('click', async () => {
      const editor = getEditor();
      if (!editor) return;
      addLog('[模式三: 分布式]', '正在挂载至测试槽位...');
      try {
        await editor.distributed(
          '#demo-slot-toolbar',
          '#demo-slot-canvas',
          demoInplaceImg.src,
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

    document.getElementById('btn-demo-dist-unmount').addEventListener('click', () => {
      const tb = document.getElementById('demo-slot-toolbar');
      const cv = document.getElementById('demo-slot-canvas');
      if (tb) tb.innerHTML = '[宿主工具栏槽位 #demo-slot-toolbar]';
      if (cv) cv.innerHTML = '[宿主画布槽位 #demo-slot-canvas]';
      addLog('[模式三: 卸载]', '已卸载测试槽位');
    });

    // ----------------------------------------------------
    // 6. 工具栏预设与代码生成器
    // ----------------------------------------------------
    const ALL_TOOLS = [
      'rect', 'cropAuto', 'lasso', 'quad', 'invert', 'clear',
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'erase',
      'colorPicker', 'pipette', 'crop', 'fill', 'hd',
      'flipH', 'flipV', 'rotateCcw', 'rotateCw', 'rotateAny',
      'download', 'upload', 'settings'
    ];
    const RECOMMEND_TOOLS = [
      'rect', 'cropAuto', 'wand', 'tolerance', 'erase', 
      'colorPicker', 'pipette', 'crop', 'rotateCw', 'rotateAny', 
      'download', 'settings'
    ];
    const CUTOUT_TOOLS = [
      'alphaMask', 'wand', 'wandMode', 'tolerance', 'erase', 
      'crop', 'download', 'settings'
    ];
    const TRANSFORM_TOOLS = [
      'rect', 'cropAuto', 'quad', 'flipH', 'flipV', 'rotateCcw', 
      'rotateCw', 'rotateAny', 'settings'
    ];

    function applyModalPresets(toolList) {
      const set = new Set(toolList);
      document.querySelectorAll('.modal-tool-cb').forEach(cb => {
        cb.checked = set.has(cb.value);
      });
      generateVisibleToolsCode();
    }

    function generateVisibleToolsCode() {
      const checked = Array.from(document.querySelectorAll('.modal-tool-cb:checked')).map(cb => cb.value);
      const codeBox = document.getElementById('generated-code-box');
      if (!codeBox) return;

      const codeStr = `// 引入 SDK 后唤起配置：\nconst result = await TiamoImageEditor.edit(targetImage, {\n  mode: 'modal', // 'modal' | 'toolbar' | 'distributed'\n  outputType: 'blob', // 'blob' | 'base64' | 'canvas'\n  visibleTools: ${JSON.stringify(checked, null, 2)}\n});`;
      codeBox.textContent = codeStr;
    }

    document.getElementById('modal-preset-all').addEventListener('click', () => applyModalPresets(ALL_TOOLS));
    document.getElementById('modal-preset-recommend').addEventListener('click', () => applyModalPresets(RECOMMEND_TOOLS));
    document.getElementById('modal-preset-cutout').addEventListener('click', () => applyModalPresets(CUTOUT_TOOLS));
    document.getElementById('modal-preset-transform').addEventListener('click', () => applyModalPresets(TRANSFORM_TOOLS));
    document.getElementById('modal-preset-clear').addEventListener('click', () => applyModalPresets(['settings']));

    document.querySelectorAll('.modal-tool-cb').forEach(cb => {
      cb.addEventListener('change', generateVisibleToolsCode);
    });

    document.getElementById('btn-copy-generated-code').addEventListener('click', async () => {
      const codeBox = document.getElementById('generated-code-box');
      if (codeBox) {
        const ok = await copyText(codeBox.textContent);
        if (ok) showToast('已成功复制配置调用代码！');
      }
    });

    // 复制发布指令
    document.getElementById('btn-copy-publish-cmd').addEventListener('click', async () => {
      const ok = await copyText('npm run publish:sdk');
      if (ok) showToast('已复制发布脚本指令：npm run publish:sdk');
    });

    // 清空日志
    document.getElementById('btn-modal-clear-log').addEventListener('click', () => {
      modalLogTerminal.innerHTML = '<div class="log-item"><span class="log-time">[' + new Date().toTimeString().split(' ')[0] + ']</span><span class="log-tag">[清空]</span><span class="log-msg">日志已清空</span></div>';
    });

    // ----------------------------------------------------
    // 7. 页面启动自检与主工作区初始化
    // ----------------------------------------------------
    function initApp() {
      syncVersionUI();
      mountMainWorkspace(null);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
