# 任务契约 (TASK.md)

## 任务项 [2026-11-18 20:23:38] (状态: 待执行)
### 用户真实诉求 (User Intent)
启动3900review的监听

---

## 任务项 [2026-11-18 21:11:03] (状态: 待执行)
### 用户真实诉求 (User Intent)
SDK 导出层：
在使用魔棒选择并点击“擦除”后，SDK 内部将选区内的像素 Alpha 值直接置为 0；
宿主通过 core.exportResult('base64') 直接向 SDK 请求合成图像，SDK 内部固定以 toDataURL("image/png") 形式生成标准的 32 位 RGBA 无损透明 PNG Base64。
宿主存储层：
宿主直接将该 PNG Base64 原文发送给后台 /api/upload；
后台原样以二进制 Buffer 写入为 .png 物理文件，没有任何格式转码、没有压缩丢弃 Alpha，也没有填充任何底色。

你导出的数据信息里面没有透明信息？

---

## 任务项 [2026-11-18 21:21:10] (状态: 待执行)
### 用户真实诉求 (User Intent)
对纯底图魔棒擦除后直接导出保存（命中根因 B，需将 exportResult 与各编辑动作统一改为同步读写 currentImageRef.current，并同步发布最新 SDK 到宿主的 /sdk/tiamo-image-editor.umd.js）？

是这个情况

---

## 任务项 [2026-11-18 21:41:14] (状态: 待执行)
### 用户真实诉求 (User Intent)
阻断
Toolbar 缺失【完成】按钮导致 SDK 回调与 Promise 闭环断裂
src/components/Toolbar.tsx:1452
ToolbarProps 定义并解构了 showComplete=true 与 onFinish (L408, L413)，ModalEditor/DistributedEditor/ToolbarPopoverEditor 均传入 showComplete=true，但右侧动作区 (L1452-1483) 仅渲染了设置与取消按钮，未渲染任何触发 core.handleFinish 的【完成】按钮，导致 TiamoImageEditor.edit/modal/toolbar 模式无法从界面完成编辑并产出 onComplete(result, state)。
阻断
工作台保存导出异常时静默降级下载底图并误报成功（Fail Silent）
js/workbench.js:185
btn-save-image 点击处理中调用 activeCore.exportResult('base64') 时在 catch 中仅 console.error(err) (L188-190)，未中断或向用户报错，随后继续下载仅含原底图的 currentMainImage 并弹出成功 Toast 与日志 (L218-236)，属于虚假成功降级。
预警
扩展画布后底图再编辑未清理 baseElementRef 导致二次扩布覆盖丢失修改
src/core/useImageEditorCore.ts:1542
handleExpandCanvas 在 L1571 将扩布前旧底图 url 存入 baseElementRef.current，但后续对底图执行翻转/旋转/裁剪/擦除/着色/正交化/白化去影 (L1622-2353) 均未重置 baseElementRef.current，再次点击扩展画布时会优先使用旧 url 覆盖新编辑结果。此外 L1597 历史记录未存 layerState，Sidebar.tsx:80-84 切换无 layerState 的历史记录时未重置图形层。
预警
ToolbarPopoverEditor 原地模式扩布后坐标映射错位风险
src/modes/ToolbarPopoverEditor.tsx:166
原地编辑容器固定使用宿主元素的 targetRect 尺寸 (L134-140) 而 img 采用 object-contain (L171)；执行 expandCanvas 改变底图宽高比后 img 会缩在容器留白内，而外部 GraphicCanvasItems 按容器 100% 宽高定位，导致图形与底图视觉错位。
预警
index.ts 全局挂载漏绑 getLayerState / loadLayerState
src/index.ts:64
L12-13 导出了 getLayerState 与 loadLayerState，但 L64-72 向 globalObj.TiamoImageEditor 显式挂载绑定方法时遗漏了这两个方法（仅靠类静态属性兜底）。
预警
localStorage 缓存写入无效 blob URL 及超限静默丢失风险
src/sdk.tsx:134
outputType 非 base64 时 nextSrc 为刷新即失效的 blob: URL，L143 仍调用 saveLayerStateToCache 写入 localStorage 挤占 5 条配额；且 graphicLayer.ts:870-905 存储含全量 Base64 图层的快照易超 5MB 配额并在 catch 中静默裁剪丢弃。
预警
网页前端组件中残留 Unicode Emoji 文案
src/components/Toolbar.tsx:386
SpillRadiusPopover 提示文案使用了 '⚠️' 与 '✅' Emoji，违反网页前端严禁使用 Emoji 表达图形与状态的工程规范。

你认同这些审核意见吗？

---

## 任务项 [2026-11-18 21:59:13] (状态: 待执行)
### 用户真实诉求 (User Intent)
需要修改

---

## 任务项 [2026-11-18 22:07:51] (状态: 待执行)
### 用户真实诉求 (User Intent)
网页前端 UI 严禁使用 Unicode Emoji (AGENTS.md §5.6)
src/components/Toolbar.tsx:386
SpillRadiusPopover 组件 JSX 第 386-387 行直接在前端提示文本中渲染了 Unicode Emoji '⚠️' 和 '✅'，违反网页前端严禁使用 Emoji 表达图形与状态的硬性规定，须替换为 Lucide 矢量 SVG。
阻断
导出合成失败时静默回退底图并提示保存成功 (AGENTS.md §5.14)
js/workbench.js:188
btn-save-image 点击回调中 activeCore.exportResult('base64') 抛异常时 catch 仅 console.error，随后静默退回未合成导入图形的 currentImage 继续下载并弹出成功 Toast；同文件 L253-281 缺 FileReader.onerror、L498 存在空 catch。
阻断
多处空 catch 静默吞异常、容器缺失挂起与模式静默降级 (AGENTS.md §5.14)
src/core/algorithms/graphicLayer.ts:643
graphicLayer.ts L643/783/878/896/903/942 存在空 catch 吞掉跨域 toDataURL SecurityError、JSON.parse 及 localStorage 损坏异常；sdk.tsx L113/140/205 空 catch 且 L264-281 参数不全时静默降级至 Modal；DistributedEditor.tsx L39-47 缺失容器返回 null 令 Promise 永不 settle；vite.config.ts L46-208 吞掉 version.json 读取异常并存在以 '1.6.0' 覆写源文件风险；useImageEditorCore.ts L2432-2436 toBlob 返回 null 时静默无回调。
预警
跨目录读写平行工程与 Dev 终端脚本中间件 (AGENTS.md §4)
scripts/publish-sdk.mjs:64
scripts/publish-sdk.mjs L64-90 直接读写及删除平行目录 ../TiamoLogin/sdk/TiamoImgEditor，package.json:11-12 与 index.html:688 仍保留 publish:sdk；此外 vite.config.ts:138-177 挂载了调用 macOS osascript 的 /api/launch-terminal 中间件（未被前端调用）。
预警
静态资源缓存穿透未使用统一物理 mtime (AGENTS.md §5.8)
index.html:87
index.html L87 与 L707 使用 Date.now() 每次刷新强穿缓存，且使 vite.config.ts:179-199 匹配 '?t=\d+' 的 distTimestampPlugin 失效。
预警
backend.version 静态标识与大文件体量可维护性提示 (AGENTS.md §5.7, §1)
src/core/useImageEditorCore.ts:1
version.json:11 为纯静态工作台将 backend.version 标为 'static'；useImageEditorCore.ts（2600 行）与 Toolbar.tsx（1537 行）单体较庞大，建议解耦；README.md 含文档装饰性 Emoji（非网页 UI）。

这里有刚刚没有改到的问题吗？

---

## 任务项 [2026-11-18 22:30:46] (状态: 待执行)
### 用户真实诉求 (User Intent)
阻断

SMOKE-01-01 统一健康检测探针与版本号展示

css/workbench.css:120

version.json:4、src/version.ts:4 与 js/workbench.js:157 syncVersionUI 版本号均为 v1.7.5，但 css/workbench.css:120-122 对 .version-indicator 设置 display: none 导致顶栏 #top-version-badge 探针完全隐藏，且 #sdk-modal-overlay 因 .active/.open 失配无法打开查看 #modal-ver-tag。

预警

SMOKE-01-02 顶栏「打开本地图片」与剪贴板 Ctrl+V 粘贴截图

js/workbench.js:114

常规本地图片选择与 Ctrl+V 粘贴经 mountMainWorkspace (L103) 可正常加载画布、弹吐司并写日志；但 L114 直接移除 [data-sdk-image-editor-host] 未调用 reactRoot.unmount() 造成 window 监听器泄漏，且 #main-file-input 对 accept 中的 PDF 文件未走 processFile 解析。

预警

SMOKE-01-04 顶栏「清空画布」重置工作区状态

js/workbench.js:240

#btn-clear-canvas 调用 mountMainWorkspace(null, null) 并触发 clearGraphicsLayer() (useImageEditorCore.ts:245) 重置为空白上传引导状态及吐司日志；同 SMOKE-01-02 存在未 unmount React 根导致旧全局监听残留问题。

阻断

SMOKE-01-05 顶栏「获取 SDK」开发者中心弹窗与三大模式在线演示

src/components/Toolbar.tsx:1452

双重阻断：(1) js/workbench.js:311 给 #sdk-modal-overlay 添加 .active，但 css/workbench.css:804 仅识别 .modal-overlay.open，弹窗完全无法打开；(2) Toolbar.tsx:1452-1483 完全遗漏了 showComplete 按钮与 core.handleFinish 调用，三大在线演示模式均无法完成编辑回传结果。

预警

SMOKE-01-06 顶栏齿轮「SDK 接入与系统设置」下拉面板与工具预设切换

js/workbench.js:728

设置下拉面板可正常展开并通过 saveAndApplyTools (L502) -> tiamo-set-visible-tools 实时联动 Toolbar.tsx:524 更新工具按钮与复制代码；但 L728 生成的 TiamoImageEditor.toolbar('#your-container', imageSource, ...) 与 sdk.tsx:296 签名 (targetElement, options) 不符，且「打开接入中心」按钮因弹窗类名失配失效。

阻断

SMOKE-02-01 空白画布点击/拖拽上传图片、PDF 高清解析与 .layers.json 状态恢复

src/components/CanvasWorkspace.tsx:373

图片与 PDF (2x pdfjsLib) 上传解析正常，但从空白画布恢复 .layers.json 或缓存图层 (useImageEditorCore.ts:293 loadLayerState) 时，首帧 imageRef.current 尚未创建 (null)，而 CanvasWorkspace.tsx:373 (及 ToolbarPopoverEditor.tsx:166) 的 <img> 缺少 onLoad 触发重渲染，导致 L357/L576 跳过渲染 GraphicCanvasItems，恢复的图形图层首帧完全不可见。

阻断

SMOKE-06-01 「扩展画布」最大外框扩布、历史记录图层回溯、工具栏自定义与跨次编辑状态继承

src/core/useImageEditorCore.ts:1532

handleExpandCanvas 外框扩布与视觉不跳动逻辑有效，但存在三项阻断：(1) Toolbar.tsx 缺失「完成」按钮触发 handleFinish，导致 SDK 无法于完成时自动输出/缓存分层状态 (sdk.tsx:121)；(2) 跨次继承恢复时 CanvasWorkspace.tsx:373 <img> 缺少 onLoad 重绘驱动致图层首帧不可见；(3) handleExpandCanvas (L1597) 及初载/底图变换历史记录缺少 layerState，Sidebar.tsx:80 无法回溯图形图层快照（另扩布后修改底图未清理 baseElementRef 存在二次扩布覆盖隐患）。



这几点呢？之前处理过吗？你认同吗？认同就改，不认同的说出来

---

## 任务项 [2026-11-18 23:01:36] (状态: 待执行)
### 用户真实诉求 (User Intent)
刚刚的问题修改了吗？

---

## 任务项 [2026-11-18 23:13:15] (状态: 待执行)
### 用户真实诉求 (User Intent)
resolveEffectiveSource 硬编码 hadGraphics:false 导致 14 处死分支
src/core/useImageEditorCore.ts:1350
resolveEffectiveSource 在 1350 行固定返回 hadGraphics: false，但 lines 1648, 1678, 1708, 1748, 1825, 1878, 1915, 1947, 1986, 2031, 2073, 2147, 2206, 2321 仍残留 if (resolved.hadGraphics) clearGraphicsLayer(); 不可达死分支，建议移除 hadGraphics 字段与同步清理全部调用点。
预警
workbench.js 残留孤儿 DOM 选择器 (.tsd-*) 与未用变量
js/workbench.js:504
js/workbench.js:504-506 查询 .tsd-tool-cb、522-525 查询 #tsd-count-badge，但 index.html 中已不存在该类 DOM 节点（已更名为 .ssd-tool-cb / #ssd-selected-count）；此外 line 122 的 const result = await editor.distributed(...) 从未使用。
预警
3 处未使用的模块 Import
src/core/useImageEditorCore.ts:4
存在未使用的 import：src/core/useImageEditorCore.ts:4 的 calculateOrthoTargetDimensions、src/modes/ToolbarPopoverEditor.tsx:1 的 useRef、src/components/ToolbarSettingsPopover.tsx:36 的 ToolbarCategoryKey。
预警
未使用的解构变量与分流后过渡态条件文案
src/modes/ToolbarPopoverEditor.tsx:57
ToolbarPopoverEditor.tsx:57-58,65,77 解构的 isPanning/spacePressed/showAlphaMask/rectDragPoints 未使用；CanvasWorkspace.tsx:50 解构 rectDragPoints 未使用（108 行用了 core.rectDragPoints）；Toolbar.tsx:420-426,438-441,457-460 共 12 个解构变量未使用，且 Toolbar.tsx:1332,1342,1357,1367 残留 selectedGraphicId 三元文案分支。
预警
exportResult 与 handleFinish 合成逻辑重复及全局挂载重复
src/core/useImageEditorCore.ts:2361
useImageEditorCore.ts:2361-2400 (exportResult) 与 2403-2437 (handleFinish) 重复编写了图像加载、图层合成、saveLayerStateToCache、onSaveState 与 toBlob 转换；另 src/index.ts:64-73 与 src/sdk.tsx:368-379 存在重复的 window.TiamoImageEditor 属性赋绑定。

这些问题已经改了吗？你认同吗？如果没有改且你认同，那就修改，否则请说明情况

---

## 任务项 [2026-11-18 23:20:16] (状态: 待执行)
### 用户真实诉求 (User Intent)
增加一个功能组：边框，可以选择设置边框的宽度和颜色；边框沿着有效像素最外层添加，颜色复用铺色的色彩选择界面，宽度显示“xx PX”，点击后出现拉把

---

## 任务项 [2026-11-18 23:51:14] (状态: 待执行)
### 用户真实诉求 (User Intent)
边框算法可能有问题
1、左上角缺失
2、右侧缺失
3、左侧斜边没有按照垂线方向增加

我们的边缘保存除了索套，应该都是用定点描述边框，都可以用两点的垂线来计算吧？（索套有成熟的算法吗？）

---

## 任务项 [2026-11-19 00:11:40] (状态: 待执行)
### 用户真实诉求 (User Intent)
效果好一些了，但是还是解决得不够彻底，A和C还是宽度不够，B的三角形还是没有，从B的走向来看，左侧斜边计算边框宽度并不是垂直于那条边，而是直直的向下算的宽度，所以就显得窄了

---

## 任务项 [2026-11-19 00:22:18] (状态: 待执行)
### 用户真实诉求 (User Intent)
算法是不是应该是：
假设宽度为N，按两点往外N画一条平行线，连续三点ABC=AB和BC画的两条平行线的焦点就是B‘，BCD=BC和CD画的两条平行线的焦点就是C’，以此类推就能获得所有拓展后的轮廓？
