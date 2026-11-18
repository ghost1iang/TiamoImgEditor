# TiamoImageEditor SDK

基于《AI图片编辑器.tsx》全量核心功能封装的**零框架依赖独立图片编辑 SDK**。
所有核心算法代码（魔棒 BFS 选色、顶点拉伸、套索、透明检测、智能修边裁切、取色涂色、旋转变换、PDF.js 高清导入、Gemini AI 重构）100% 完整保留。

宿主应用（原生 JS、Vue 2/3、React、Angular）只需引入一个打包后的 JS 文件，一行代码即可唤起并以 Promise 方式获取处理后的图片。

---

## 特性

1. **零框架依赖 (Zero Dependencies)**：
   SDK 将 React 运行时、图标库与 Tailwind CSS 全部打包进单一独立 JS 文件（UMD / ES 模块），宿主应用无需安装任何 npm 依赖即可直接运行。
2. **样式完全隔离 (Shadow DOM)**：
   默认挂载于 Shadow DOM 中，Tailwind 类名与自定义样式绝不污染原宿主应用的 CSS，也不受宿主已有 CSS 样式干扰。
3. **三大接入模式**：
   - **新开窗口（Modal 弹窗模式）**：SDK 提供完整窗口，包含编辑历史侧边栏、工具栏、缩放工作区与 AI 重构指令栏。
   - **原地编辑（Toolbar Popover 模式）**：直接传入页面中的 `<img>` 或 `<canvas>` 节点，SDK 自动计算坐标在其上方弹出浮动工具栏，在原图片上方原地编辑，完成后自动替换原图并返回。
   - **分布式（Distributed 模式）**：分别在宿主工程中指定工具栏放置容器 (`toolbarContainer`) 和画布容器 (`canvasContainer`)，两者分离挂载并实时同步联动。
4. **统一 Promise 异步返回**：
   用户点击【完成】后，Promise 自动 resolve 返回新处理后的图片（支持 `Blob` / `Base64` / `HTMLCanvasElement`）。
5. **全新自适应浅色毛玻璃旋转面板**：
   重构为自适应主题浮窗，支持 -180°~+180° 滑块无级微调、度数精准打字输入、`[-1°]` / `[+1°]` 极细粒度校平步进、常用快捷预设与画布实时旋转联动。
6. **全自动智能去色边 (Zero-Click De-spill)**：
   魔棒抠图擦除时内置全色相智能去溢色算法，擦除背景时全自动消除边缘杂色光，无需手动切换开关。
7. **工具栏动态定制与参数化配置**：
   - **运行时浮窗设置**：工具栏内置齿轮【设置】按钮，展开自适应毛玻璃面板实时勾选显示/隐藏 29 个按钮；
   - **接入前预设参数**：提供 `visibleTools` / `hiddenTools` / `tools` 参数，支持按业务场景自由裁剪工具栏按钮。
8. **图层导入图形、锁定保护、单层融合与独立分层状态继承 (v1.7.5)**：
   - **多种导入方式**：支持用户本地选图，也支持宿主通过 `onRequestImportGraphic` 拦截【导入图形】按钮对接自有素材库，或调用 `TiamoImageEditor.importGraphic(source, options)` 编程式直接向画布插入图形；
   - **固定工具栏专属控制（无浮窗遮挡）**：彻底移除画布浮窗，选中图形时顶部固定工具栏自动切换为专属工具组（左右/上下镜像、正负 90° 旋转、**最顶 / 上一层 / 下一层 / 最底**、扩展画布、导入图形、**锁定**、**融合**、删除、完成调整），失焦后恢复原始工具栏；
   - **图层锁定防遮挡**：点击【锁定】后图形不再响应鼠标点击、移动或缩放，便于定位顶层大图后无干扰编辑下方小物件；工具栏随时提供【解锁】入口恢复编辑；
   - **单层融合与无损分层继承**：【融合】仅将当前选中图形这一层融合进底图（合并后与底图成为最底一层，其余未融合图层继续保留）；导出与保存时不再强行拍平销毁所有图层，支持在图片之外保存/继承 `EditorLayerState`（或 `.layers.json`），下次重新打开编辑自动还原所有独立图形与锁定状态；
   - **全量 8 点触控与扩展画布**：四角方形等比缩放、左右圆形增宽、上下圆形增高，支持对齐吸附与【扩展画布】。

---

## 打包产物

执行构建后在 `dist/` 目录下生成：
- `dist/tiamo-image-editor.umd.js`：适合 `<script src="...">` 直接在浏览器中引入（挂载全局对象 `window.TiamoImageEditor`）。
- `dist/tiamo-image-editor.es.js`：适合现代前端工程 `import { TiamoImageEditor } from '...'`。
- `dist/types/`：TypeScript 完整类型声明定义。

---

## 快速上手

### 1. 原生 HTML / 浏览器直引

```html
<!-- 引入 SDK -->
<script src="./dist/tiamo-image-editor.umd.js"></script>

<img id="tiamo-avatar" src="avatar.png" />
<button id="edit-btn">编辑图片</button>

<script>
  document.getElementById('edit-btn').addEventListener('click', async () => {
    const imgEl = document.getElementById('tiamo-avatar');

    // 一行代码唤起原地编辑（或弹窗编辑）：
    const newBlob = await window.TiamoImageEditor.edit(imgEl, {
      mode: 'toolbar', // 'modal' | 'toolbar' | 'distributed'
      outputType: 'blob'
    });

    console.log('编辑完成，获得新图片 Blob:', newBlob);
  });
</script>
```

### 2. Vue / React 工程中使用

```javascript
import { TiamoImageEditor } from './dist/tiamo-image-editor.es.js';

// 在任何点击事件中调用：
const newImageBlob = await TiamoImageEditor.edit(targetImageElement, {
  mode: 'modal',       // 'modal'（弹窗编辑） 或 'toolbar'（直接吸附在目标图片旁弹出工具栏）
  outputType: 'blob',  // 'blob' | 'base64' | 'canvas'
  autoUpdateTarget: true, // 自动把新图赋值给 targetImageElement.src
});

// 或者手动更新：
targetImageElement.src = URL.createObjectURL(newImageBlob);
```

---

## 三大接入模式详解

### 模式一：新开窗口（Modal）
```javascript
const resultBlob = await TiamoImageEditor.edit(sourceImage, {
  mode: 'modal',
  outputType: 'blob'
});
```
- 打开一个全屏半透明遮罩的模态窗口。
- 包含左侧历史记录列表、顶部所有编辑工具、中央缩放平移画布、底部 AI 指令输入栏。
- 顶部右侧提供绿色的【完成】按钮与【取消】按钮。

### 模式二：原地编辑（Toolbar Popover）
```javascript
const resultBlob = await TiamoImageEditor.edit(document.getElementById('tiamo-image'), {
  mode: 'toolbar',
  autoUpdateTarget: true // 完成后原地自动将新图片赋值给 tiamo-image.src
});
```
- 工具栏以浮动卡片（Popover Toolbar）形式吸附在目标图片上方。
- 在目标图片上方覆盖轻量交互层，可直接进行魔棒选色、矩形修边、套索、吸管取色、涂色填充、四角拉伸与旋转。
- 点击工具栏【完成】后自动更新原图并 resolve 返回。

### 模式三：分布式（Distributed）
```javascript
const resultBlob = await TiamoImageEditor.edit(sourceImage, {
  mode: 'distributed',
  toolbarContainer: '#tiamo-toolbar-slot', // 宿主界面中工具栏挂载节点或选择器
  canvasContainer: '#tiamo-canvas-slot',   // 宿主界面中画布挂载节点或选择器
});
```
- SDK 将工具栏渲染到 `toolbarContainer`，画布渲染到 `canvasContainer`。
- 状态与操作完全同步联动。

---

## API 配置项 `EditOptions`

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `visibleTools` | `ToolbarToolId[]` | `undefined` (全显) | 按钮白名单：指定默认显示的按钮 ID 列表 |
| `hiddenTools` | `ToolbarToolId[]` | `undefined` | 按钮黑名单：指定默认隐藏的按钮 ID 列表 |
| `tools` | `ToolbarToolId[] \| Record<string, boolean>` | `undefined` | 灵活配置按钮显隐字典或数组 |
| `mode` | `'modal' \| 'toolbar' \| 'distributed'` | `'modal'` | 编辑器模式 |
| `outputType` | `'blob' \| 'base64' \| 'canvas'` | `'blob'` | 完成后的返回值类型 |
| `autoUpdateTarget` | `boolean` | `true` | 若传入目标为 `HTMLImageElement`，是否自动将新图写入其 `src` |
| `toolbarContainer` | `HTMLElement \| string` | `undefined` | 分布式模式：工具栏放置容器或选择器 |
| `canvasContainer` | `HTMLElement \| string` | `undefined` | 分布式模式：画布放置容器或选择器 |
| `apiKey` | `string` | `""` | 可选 Gemini API Key（支持 AI 图像重构） |
| `useShadowDOM` | `boolean` | `true` | 是否使用 Shadow DOM 进行样式隔离 |
| `rejectOnCancel` | `boolean` | `true` | 用户点击取消时是否 reject Promise |
| `initialState` | `EditorLayerState \| string` | `undefined` | 传入上次保存的独立分层状态，初始化时直接继承恢复底图、图形图层顺序与锁定状态 |
| `onRequestImportGraphic` | `OnRequestImportGraphicHandler` | `undefined` | **宿主素材库接管钩子**：配置后点击【导入图形】按钮不再弹出本地文件框，转为触发该回调由宿主素材库返回或调用 `importGraphic` |
| `onSaveState` | `(state: EditorLayerState) => void` | `undefined` | 导出/保存时输出图片之外的独立分层状态数据（未融合图形、层级与锁定状态） |
| `onComplete` | `(result, state: EditorLayerState) => void` | `undefined` | 完成编辑的回调函数，同时返回成片结果与独立分层状态 `state` |
| `onCancel` | `() => void` | `undefined` | 取消编辑的回调函数 |

---

## 宿主自有素材库接入与编程式导入图形 (`importGraphic` & `onRequestImportGraphic`)

当宿主应用拥有自己的素材库/贴纸库/印章库，不能或不想仅依赖浏览器本地选文件导入时，SDK 提供两种标准接入接口（`modal`、`toolbar`、`distributed` 三大模式全支持）：

### 方式一：通过 `onRequestImportGraphic` 拦截工具栏【导入图形】按钮

在 `edit` / `modal` / `toolbar` / `distributed` 的 `options` 中传入 `onRequestImportGraphic` 后，用户点击工具栏【导入图形】按钮将**不再弹出浏览器本地文件选择框**，而是触发宿主的自定义回调：

```javascript
await TiamoImageEditor.distributed('#toolbar-slot', '#canvas-slot', baseImage, {
  outputType: 'base64',
  // 拦截【导入图形】按钮：打开宿主素材库弹窗并导入选中素材
  onRequestImportGraphic: async (importGraphic) => {
    // 写法 1：等待宿主弹窗选图并直接 return（支持单个或数组）
    const picked = await openHostAssetModal();
    if (!picked) return null; // 用户取消
    return {
      source: picked.url, // 支持 URL / Base64 / Blob / File / HTMLImageElement / HTMLCanvasElement
      options: {
        name: picked.title,
        w: 240,
        autoSelect: true,
      },
    };

    // 写法 2：也可以在宿主素材弹窗内直接调用注入的 importGraphic(source, options) 后不返回内容
    // await importGraphic(picked.url, { name: picked.title, autoSelect: true });
  },
});
```

> **弹窗层级提示**：若在 `mode: 'modal'` 下弹出宿主自己的素材窗，由于全屏弹窗遮罩层为 `z-index: 999999`，建议将宿主素材窗的 `z-index` 设为 `>= 1000000`（或使用 `distributed` / `toolbar` 模式）。

### 方式二：宿主直接调用编程式接口 `TiamoImageEditor.importGraphic` / `expandCanvas`

若宿主界面侧边栏或工具箱本身展示了一组可点击素材，可在任意时机直接调用静态方法（或活动核心实例 `window.__TIAMO_ACTIVE_CORE__`）向当前活跃画布插入图形：

```javascript
// 1. 直接将宿主素材库图片导入当前画布（自动居中并选中出现 8 点触控）
const graphic = await TiamoImageEditor.importGraphic('/assets/seal.png', {
  name: '电子公章',
  x: 120,             // 可选：左上角 X（画布原图像素坐标，默认居中）
  y: 80,              // 可选：左上角 Y（画布原图像素坐标，默认居中）
  w: 220,             // 可选：指定宽度（仅传 w 时按原图宽高比自动推算 h）
  h: 220,             // 可选：指定高度（仅传 h 时按原图宽高比自动推算 w）
  maxScaleRatio: 0.6, // 可选：未指定 w/h 时限制最大占底图比例（默认 0.6；传 0 或 Infinity 不缩放）
  autoSelect: true,   // 可选：导入后自动选中并显示 8 点触控框（默认 true）
});

// 2. 如宿主有外部“扩展画布”按钮，也可直接编程式触发扩展画布
await TiamoImageEditor.expandCanvas();

// 3. 图片之外另存与继承分层状态（保存/导出不销毁未融合图层）
const layerState = TiamoImageEditor.getLayerState(); // 获取底图、图形列表、baseLayerIndex 与锁定状态
TiamoImageEditor.loadLayerState(savedState);        // 运行时随时恢复已保存的分层状态
```

#### `ImportGraphicOptions` 参数说明

| 参数 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `name` | `string` | 自动推断 | 图形名称标识 |
| `x` | `number` | 水平居中 | 画布原图像素坐标系下的初始左上角 X |
| `y` | `number` | 垂直居中 | 画布原图像素坐标系下的初始左上角 Y |
| `w` | `number` | 按原图/比例 | 初始宽度（仅传 `w` 时按原图宽高比自动推算 `h`） |
| `h` | `number` | 按原图/比例 | 初始高度（仅传 `h` 时按原图宽高比自动推算 `w`） |
| `maxScaleRatio` | `number` | `0.6` | 未指定 `w`/`h` 时限制图形不超过底图尺寸的最大比例（传 `0` 或 `Infinity` 禁用自动缩放） |
| `autoSelect` | `boolean` | `true` | 导入后是否立即选中该图形并显示 8 点触控框与顶部图形上下文工具栏 |

---

## 29 个可配置工具栏按钮 (`ToolbarToolId`) 与 8 点触控规范

| 分类 | 按钮 ID (`ToolbarToolId`) | 说明 |
| :--- | :--- | :--- |
| **选区工具** | `rect` / `cropAuto` / `lasso` / `quad` / `invert` / `clear` | 矩形范围、智能修边、索套范围、多边范围、反选、清除选区 |
| **魔棒抠图** | `alphaMask` / `wand` / `wandMode` / `tolerance` / `spillRadius` | 透明检测、魔棒选色、全屏/连通切换、容差滑块、去色边影响范围 (`1px`~`Max`) |
| **色彩吸管** | `colorPicker` / `pipette` | 着色调色板、吸管取色 |
| **选区操作** | `crop` / `fill` / `erase` / `hd` / `importGraphic` / `expandCanvas` / `border` | 按区剪裁、选区着色、选区擦除、稀疏高清、导入图形、扩展画布、有效边框 |
| **旋转校正** | `flipH` / `flipV` / `rotateCcw` / `rotateCw` / `rotateAny` / `ortho` / `orthoAuto` / `deShadow` | 左右/上下镜像、正负 90° 旋转（选中图形时作用于图形）、自由旋转、正交化、智能寻角、白化去影 |
| **辅助功能** | `settings` | 工具栏显示设置浮窗 |

- **8 点触控统一规范（适用于「导入图形」与「稀疏高清」）**：
  - **左上、左下、右上、右下四个角**：**方形把手**，固定缩放宽高比例；
  - **左右两个边中点**：**圆形把手**，仅调节/增加宽度；
  - **上下两个边中点**：**圆形把手**，仅调节/增加高度。

---

## 本地演示与构建

- **启动本地演示服务**：
  ```bash
  npm run dev
  ```
  然后在浏览器中打开 `http://localhost:5173` 体验演示页面。

- **重新构建 SDK 单文件**：
  ```bash
  npm run build
  ```

---

## 经典实战排错：分布式挂载 (Distributed Mode) 避坑指南

在宿主工程采用分布式挂载时，若遇到“工具栏加载成功但画布未显图”，通常由以下原因造成：

1. **异步时序与离线 Canvas 传递空数据**：
   若图片源来源于 PDF.js 异步解析，必须确保在 `await page.render().promise` 完成后再调用 `toDataURL()` 取图；若直接传递刚初始化的离线 Canvas，由于未绘制完毕会导致 SDK 读入全白数据。
2. **双重画布容器层叠遮挡与包含块隔离**：
   检查插槽容器物理尺寸（`getBoundingClientRect()`）。若高度塌陷为 0，或被宿主原生的工作区白板（如 `#edit-board`）通过高 `z-index` 覆盖，需要隐藏宿主原生白板，确保 SDK 插槽独占主视口。
3. **多图层数据源传参混淆**：
   在带标注图层的宿主中，切勿将未合并内容的空白涂鸦层当做底图传给 SDK。调用前先将 PDF 底图与上层标注合并绘制到同一 Canvas 再导出传递。

---

## 最近更新 (v1.7.8)
- **全面治理全栈异常处理、工作台探针弹窗与四端卫生对齐 (v1.7.8)**：
  - 使用 Lucide 矢量图标替代 `SpillRadiusPopover` 残留文本说明，清理 `Toolbar.tsx`、`CanvasWorkspace.tsx`、`ToolbarPopoverEditor.tsx`、`ToolbarSettingsPopover.tsx` 与 `useImageEditorCore.ts` 中的死分支（`resolved.hadGraphics`）及未使用导入/变量；
  - 修复 `CanvasWorkspace` 载入分层状态时首帧图形图层不渲染的问题（`<img>` 增加 `onLoad` 与 `imgNaturalSize` 驱动重绘），并修复 `css/workbench.css` 顶栏健康脉冲版本胶囊显示与 `#sdk-modal-overlay.active` 弹窗类名失配；
  - 完善 `sdk.tsx`、`DistributedEditor.tsx`、`graphicLayer.ts`、`useImageEditorCore.ts` 与 `js/workbench.js` 的显式 Fail-Loud 异常反馈（消除空 `catch` 与缺失容器导致的 Promise 永久挂起/静默降级至 Modal，补齐 `FileReader.onerror`、`handleFinish` `toBlob` 失败报错、工作台 PDF 解析、优雅 `handleCancel` 卸载与参数签名修正）；
  - 移除跨目录发布脚本并精简 `vite.config.ts`，同步更新 `index.html` 采用物理 `mtimeMs` 防缓存穿透策略，四处版本号（含 `version.json` `backend.version`）全部严格对齐 `1.7.8`。
- **修复 Toolbar 右侧【完成】按钮缺失并完善跨端闭环与工程规范 (v1.7.7)**：
  - 在 [Toolbar.tsx](src/components/Toolbar.tsx) 右侧动作区恢复 `showComplete` 对应的【完成】按钮（绑定 `onFinish || core.handleFinish`），确保 `modal` / `toolbar` / `distributed` 三大模式均可通过界面触发 `onComplete(result, state)`；并清理 `SpillRadiusPopover` 中的 Unicode Emoji 字符；
  - 修复工作台导出失败时静默降级下载旧底图的问题（[js/workbench.js](js/workbench.js)），导出异常时立即弹错、记日志并中止保存；
  - 完善 `handleExpandCanvas` 与底图编辑的历史记录 `layerState` 同步及 `Sidebar` 无图层历史项切换重置（`handleSelectHistoryRecord`）；
  - 修复 `ToolbarPopoverEditor` 原地模式在扩布或改变宽高比后因 `object-contain` 留白引发的坐标偏差，改为按底图实际比例贴合拟合舞台 `stageRect`；
  - 在 `src/index.ts` 补齐 `TiamoImageEditor.getLayerState` 与 `TiamoImageEditor.loadLayerState` 全局挂载，并优化 `localStorage` 分层缓存策略（禁止写入短暂 `blob:` URL 键并在超限/异常时输出 `console.warn`）。
- **同步读写 `currentImageRef.current` 修复导出滞后与 32 位透明 PNG 导出稳定性 (v1.7.6)**：
  - 将 `currentImage`、`maskCanvas`、`importedGraphics`、`baseLayerIndex`、`selectedGraphicId` 及选区状态改为同步 State/Ref/代理写入，`resolveEffectiveSource`、`handleEraseSelection`、`exportResult`、`handleFinish` 全面同步读取最新图像，确保魔棒擦除后立即 `exportResult('base64')` 完整保留 Alpha=0 透明通道。
- **移除多余浮窗工具栏并升级固定工具栏功能 (v1.7.5)**：
  - 彻底清理画布上残留的 `GraphicFloatingBar` 浮窗，所有图形操作全部统一收口至顶部固定工具栏；
  - 新增 **锁定 / 解锁** 功能：在选中导入图形的固定工具栏中点击【锁定】，该图形立刻取消选中并禁用所有鼠标点击/拖拽/缩放穿透事件（`pointer-events-none` + 命中检测跳过），顶层大图定好位置后不再遮挡下方小物件编辑；存在锁定图层时，固定工具栏提供【解锁(N)】按钮随时恢复编辑；
  - 升级 **融合** 为单层融合到底图：点击固定工具栏【融合】仅将当前选中的这一个图形与底图合并，合并后该图形丢失原独立层次并与底图一起变为“最底”一层（`baseLayerIndex = 0`），画布上其他未融合图形仍保留为独立可编辑图层；
  - **保存不强行拍平，分层状态独立存储与继承**：新增 `EditorLayerState`、`TiamoImageEditor.getLayerState()` / `loadLayerState()`、`EditOptions.initialState` / `onSaveState` 及 `onComplete(result, state)`；工作台【保存到本地】在保存 `.png` 成片时若存在未融合图层会同步另存一份 `.layers.json` 并缓存指纹，下次通过【打开本地图片】、拖拽或对宿主 `<img>` 再次唤起编辑时自动继承恢复全部图层状态。
- **选中导入图形上下文工具栏新增图层排序按钮（最顶 / 上一层 / 下一层 / 最底）(v1.7.4)**：
  - 在选中导入图形后的专属工具栏中新增【最顶】【上一层】【下一层】【最底】四个按钮，到达最顶或最底边界时自动置灰禁用；
  - 引入与底图统一的图层栈模型 (`baseLayerIndex`)：不仅支持多张导入图形之间的上下调整，也支持将导入图形移动到底图下方（当底图或扩布区域包含透明背景时清晰透出），且选中的 8 点触控操作框与吸附辅助线始终保持在最前层可交互；
  - 画布实时预览（Modal / 分布式工作区 / 原地浮动编辑）与像素合成导出（融合到底图、AI 修改提交、`exportResult`、`onComplete`）100% 严格按统一图层栈顺序渲染与合成。
- **选中导入图形上下文专属工具栏自动切换 (v1.7.3)**：
  - 当画布上选中任意导入图形时，顶部工具栏自动切换为仅对该选中图形生效的专属按钮组（已选图形尺寸标识、左右镜像、上下镜像、逆时针 90°、顺时针 90°、最顶、上一层、下一层、最底、扩展画布、继续导入图形、融合到底图、删除、完成调整），隐藏底图全局编辑工具防止误操作；
  - 当图形失去焦点（点击画布空白处、按 `Esc`、融合或删除图形）时，工具栏立即自动恢复原始全量工具栏；
  - 移除画布上方冗余的悬浮操作胶囊，保持画布视野纯净无遮挡。
- **新增宿主自有素材库导入图形接口 (`importGraphic` & `onRequestImportGraphic`) (v1.7.2)**：
  - 暴露 `TiamoImageEditor.importGraphic(source, options)` 与 `TiamoImageEditor.expandCanvas()` 静态方法及活动核心实例方法，支持宿主直接将图片 URL、Base64、`Blob`、`File`、`HTMLImageElement` 或 `HTMLCanvasElement` 叠加导入至当前画布并自动选中 8 点触控；
  - 新增 `EditOptions.onRequestImportGraphic` 拦截回调：配置后点击工具栏【导入图形】按钮不再弹出本地文件选择器，直接触发宿主自有素材库选图流程；
  - 将 `window.__TIAMO_ACTIVE_CORE__` 挂载下沉至 `useImageEditorCore` 统一维护（支持嵌套还原），`modal` / `toolbar` / `distributed` 三大模式全面支持外部编程式调用。
- **扩展画布 (`expandCanvas`) 与画布外图形完整可视 (v1.7.1)**：
  - 将已导入图形移出底图 `overflow-hidden` 容器，拖出原有画布边缘仍完整显示与可编辑；点击【扩展画布】自动计算所有元素外边框最大值生成新画布并补偿视口定位。
- **导入图形图层与全量 8 点触控规范统一 (v1.7.0)**：
  - 新增【导入图形】按钮，支持吸附移动、吸附缩放、左右/上下镜像、正负 90° 旋转、融合到底图与无缝导出；
  - 全矩阵所有 8 点触控统一规范为四角方形等比缩放、左右圆形增宽、上下圆形增高。
- **有效像素边框与 Miter Joint 多边形外扩算法 (v1.7.12)**：
  - 新增【有效边框 (`border`)】功能组，支持沿图像/图形的有效像素外边缘生成任意宽度与颜色的扩展边框；
  - 采用多边形外法线平移与 Miter Joint（两平行外法线交点求解）算法，完美保留锐利尖角，彻底杜绝三角形缺失与斜边宽度失真；
  - 自动扩展画布边缘包围盒，确保外扩尖角 100% 完整显示不被裁切；
  - 支持对底图及选中的导入图形独立加边框，历史记录与分层状态全链路持久化继承。
- **工具栏自定义与分布式排错指南 (v1.6.6+)**：
  - 支持 29 个工具按钮自定义配置、去色边【影响范围】调节以及跨应用分布式挂载标准范式。
