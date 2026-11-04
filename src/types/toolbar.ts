/**
 * 工具栏按钮定义与配置解析
 */

export type ToolbarToolId =
  // 选区工具组
  | 'rect'          // 矩形范围
  | 'cropAuto'      // 智能修边
  | 'lasso'         // 索套范围
  | 'quad'          // 多边范围 (顶点透视)
  | 'invert'        // 反选选区
  | 'clear'         // 清除选区
  // 魔棒与抠图
  | 'alphaMask'     // 透明检测
  | 'wand'          // 魔棒选色
  | 'wandMode'      // 选色模式(全屏/连通)
  | 'tolerance'     // 容差滑块
  | 'erase'         // 橡皮擦除
  // 色彩与吸管
  | 'colorPicker'   // 调色板
  | 'pipette'       // 吸管取色
  // 选区操作
  | 'crop'          // 按区剪裁
  | 'fill'          // 选区着色
  | 'hd'            // 稀疏高清重构
  // 旋转与镜像
  | 'flipH'         // 水平镜像
  | 'flipV'         // 垂直镜像
  | 'rotateCcw'     // 逆时针90°
  | 'rotateCw'      // 顺时针90°
  | 'rotateAny'     // 自由旋转
  | 'ortho'         // 矩形正交化校正
  | 'orthoAuto'     // 智能寻角 (自动识别4个推荐顶点)
  | 'deShadow'      // 白化去影 (光照除法平底净化)
  // 辅助与系统
  | 'settings';     // 工具栏设置

export type ToolbarCategoryKey = 'selection' | 'cutout' | 'color' | 'action' | 'transform' | 'system';

export interface ToolbarCategoryDef {
  key: ToolbarCategoryKey;
  name: string;
  icon?: string;
  desc: string;
}

export const TOOLBAR_CATEGORIES: ToolbarCategoryDef[] = [
  { key: 'selection', name: '选区工具', desc: '矩形、修边、套索、多边、反选与清除' },
  { key: 'cutout', name: '魔棒抠图', desc: '透明底纹、魔棒取色、模式切换与容差调节' },
  { key: 'color', name: '色彩吸管', desc: '目标着色色卡与屏幕像素吸管' },
  { key: 'action', name: '剪裁与擦除', desc: '按选区裁切画布、擦除选区内容为透明与选区着色' },
  { key: 'transform', name: '旋转校正', desc: '水平垂直翻转、正负90°旋转、自由角度校平与矩形正交化校正' },
  { key: 'system', name: '辅助功能', desc: '工具栏按钮显示自定义设置' },
];

export interface ToolbarToolDef {
  id: ToolbarToolId;
  name: string;
  shortName?: string;
  category: ToolbarCategoryKey;
  description: string;
  defaultVisible: boolean;
}

export const ALL_TOOLBAR_TOOLS: ToolbarToolDef[] = [
  // 1. 选区工具组
  { id: 'rect', name: '矩形范围', shortName: '矩形', category: 'selection', description: '在画布上框选矩形并支持四角二次拖拽', defaultVisible: true },
  { id: 'cropAuto', name: '智能修边', shortName: '修边', category: 'selection', description: '自动识别非透明像素的最小有效边界', defaultVisible: true },
  { id: 'lasso', name: '索套范围', shortName: '索套', category: 'selection', description: '手绘闭合不规则选区路径', defaultVisible: true },
  { id: 'quad', name: '多边范围', shortName: '多边', category: 'selection', description: '连线闭合多边形，支持顶点自由拉伸与透视剪裁', defaultVisible: true },
  { id: 'invert', name: '反选选区', shortName: '反选', category: 'selection', description: '一键将选区范围进行内外反转', defaultVisible: true },
  { id: 'clear', name: '清除选区', shortName: '清除', category: 'selection', description: '清除当前画布所有活动选区', defaultVisible: true },

  // 2. 魔棒与抠图组
  { id: 'alphaMask', name: '透明检测', shortName: '透明网格', category: 'cutout', description: '切换透明区域红白点阵检测底纹', defaultVisible: true },
  { id: 'wand', name: '魔棒选色', shortName: '魔棒', category: 'cutout', description: '点击图片自动智能分析并选中同类色块', defaultVisible: true },
  { id: 'wandMode', name: '选色模式', shortName: '全屏/连通', category: 'cutout', description: '切换魔棒为全屏颜色匹配或连续区域漫水', defaultVisible: true },
  { id: 'tolerance', name: '容差滑块', shortName: '容差调节', category: 'cutout', description: '1~255 范围内平滑调节魔棒选色容差度', defaultVisible: true },

  // 3. 色彩与吸管
  { id: 'colorPicker', name: '着色调色板', shortName: '调色板', category: 'color', description: '选取选区着色与画笔填充的目标颜色', defaultVisible: true },
  { id: 'pipette', name: '吸管取色', shortName: '吸管', category: 'color', description: '在画布上任意点击并实时拾取像素十六进制色', defaultVisible: true },

  // 4. 选区操作 (剪裁、着色、擦除与稀疏高清)
  { id: 'crop', name: '按区剪裁', shortName: '剪裁', category: 'action', description: '按当前活动选区直接裁剪整幅画面', defaultVisible: true },
  { id: 'fill', name: '选区着色', shortName: '着色', category: 'action', description: '将当前调色板颜色批量填充进选区', defaultVisible: true },
  { id: 'erase', name: '选区擦除', shortName: '擦除', category: 'action', description: '擦除魔棒、矩形、套索或多边形选区内容为透明区域', defaultVisible: true },
  { id: 'hd', name: '稀疏高清', shortName: '高清', category: 'action', description: '基于稀疏插值与超分重构无损放大图片分辨率', defaultVisible: true },

  // 5. 旋转与镜像
  { id: 'flipH', name: '水平镜像', shortName: '水平翻转', category: 'transform', description: '沿左右中心线对称翻转', defaultVisible: true },
  { id: 'flipV', name: '垂直镜像', shortName: '垂直翻转', category: 'transform', description: '沿上下中心线对称翻转', defaultVisible: true },
  { id: 'rotateCcw', name: '逆时针90°', shortName: '左旋90°', category: 'transform', description: '逆时针一键旋转 90 度', defaultVisible: true },
  { id: 'rotateCw', name: '顺时针90°', shortName: '右旋90°', category: 'transform', description: '顺时针一键旋转 90 度', defaultVisible: true },
  { id: 'rotateAny', name: '自由旋转', shortName: '任意角度', category: 'transform', description: '无级滑动、打字输入与微调步进自由角度旋转', defaultVisible: true },
  { id: 'ortho', name: '矩形正交化', shortName: '正交化', category: 'transform', description: '对四角倾斜或透视畸变的矩形物品进行正交平面校正', defaultVisible: true },
  { id: 'orthoAuto', name: '智能寻角', shortName: '寻角', category: 'transform', description: '自动识别画面矩形物体的4个推荐顶点并进入正交模式', defaultVisible: true },
  { id: 'deShadow', name: '白化去影', shortName: '去阴影', category: 'transform', description: '基于光照估计除法消除拍摄纸张的不均匀阴影与暗角，平底白化并保留彩色文字与印章', defaultVisible: true },

  // 6. 通用与系统
  { id: 'settings', name: '工具栏设置', shortName: '设置', category: 'system', description: '自适应浮窗勾选自定义工具栏按钮显示', defaultVisible: true },
];

/**
 * 所有可用工具 ID 的默认完整集合
 */
export const DEFAULT_VISIBLE_TOOL_IDS: ToolbarToolId[] = ALL_TOOLBAR_TOOLS.map(t => t.id);

/**
 * 根据传入配置解析出最终可见的工具 ID 集合
 * 支持三种传入格式：
 * 1. visibleTools: ['rect', 'wand', ...] - 白名单数组
 * 2. hiddenTools: ['quad', 'pipette', ...] - 黑名单数组
 * 3. tools: { rect: true, lasso: false } 或 ['rect', 'wand'] - 字典或数组
 */
export function resolveVisibleTools(options?: {
  tools?: ToolbarToolId[] | Record<string, boolean>;
  visibleTools?: ToolbarToolId[];
  hiddenTools?: ToolbarToolId[];
}): Set<ToolbarToolId> {
  const result = new Set<ToolbarToolId>(DEFAULT_VISIBLE_TOOL_IDS);

  if (!options) return result;

  // 1. 如果传入了白名单 visibleTools
  if (Array.isArray(options.visibleTools)) {
    const customSet = new Set<ToolbarToolId>(options.visibleTools as ToolbarToolId[]);
    // 保证设置按钮默认在（除非显式传空）
    return customSet;
  }

  // 2. 如果 tools 是数组（视为白名单）
  if (Array.isArray(options.tools)) {
    return new Set<ToolbarToolId>(options.tools as ToolbarToolId[]);
  }

  // 3. 如果 tools 是对象字典
  if (options.tools && typeof options.tools === 'object') {
    Object.entries(options.tools).forEach(([key, val]) => {
      const toolId = key as ToolbarToolId;
      if (val === false) {
        result.delete(toolId);
      } else if (val === true) {
        result.add(toolId);
      }
    });
  }

  // 4. 如果传入了黑名单 hiddenTools
  if (Array.isArray(options.hiddenTools)) {
    options.hiddenTools.forEach(toolId => {
      result.delete(toolId as ToolbarToolId);
    });
  }

  return result;
}
