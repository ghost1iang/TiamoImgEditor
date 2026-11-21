declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.7.15';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-19 06:56:08';
export const SDK_DESCRIPTION = '新增边框功能组，支持自定义颜色与拉把宽度调节，沿有效像素最外层轮廓平滑添加高品质抗锯齿边框';
