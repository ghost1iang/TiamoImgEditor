declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.3';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-04 20:00:00';
export const SDK_DESCRIPTION = '新增非AI智能寻角工具（基于经典计算机视觉自动识别矩形物体4个推荐顶点并进入正交模式）、矩形正交化校正与工具栏设置按需定制联动';
