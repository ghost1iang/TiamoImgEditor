declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.1';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-03 23:58:32';
export const SDK_DESCRIPTION = '新增稀疏高清重构工具（等比8点控制放大、稀疏打散双向均值插值、视口防裁切智能贴顶、原图按住即时对比）与基于构建修改时间戳的自动化防缓存机制';
