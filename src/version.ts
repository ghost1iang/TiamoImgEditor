declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.2';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-04 11:05:00';
export const SDK_DESCRIPTION = '新增矩形物品正交化校正工具（支持四角顶点对齐、实时高保真放大镜、单应性透视映射与正交平面校正）与工具栏设置按需定制联动';
