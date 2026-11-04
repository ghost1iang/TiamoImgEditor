declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.6';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-04 23:28:37';
export const SDK_DESCRIPTION = '新增白化去影净化工具（基于光照估计背景除法消除拍摄纸张不均匀阴影与暗角，平底白化并保留彩色文字与印章）、非AI智能寻角4顶点检测与矩形正交化校正联动，自测工作台25个工具全选默认就绪';
