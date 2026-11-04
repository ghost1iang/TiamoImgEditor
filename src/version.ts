declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.4';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-04 20:20:00';
export const SDK_DESCRIPTION = '新增白化去影净化工具（基于光照估计除法消除拍摄纸张不均匀阴影与暗角，平底白化并保留彩色文字与印章）、非AI智能寻角与矩形正交化校正联动';
