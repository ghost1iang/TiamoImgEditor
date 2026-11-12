declare const __SDK_VERSION__: string | undefined;
declare const __SDK_BUILD_TIME__: string | undefined;

export const SDK_VERSION = typeof __SDK_VERSION__ !== 'undefined' ? __SDK_VERSION__ : 'v1.6.9';
export const SDK_BUILD_TIME = typeof __SDK_BUILD_TIME__ !== 'undefined' ? __SDK_BUILD_TIME__ : '2026-11-13 09:17:00';
export const SDK_DESCRIPTION = '新增魔棒擦除边缘过渡带局域化去溢色（方案A），提供【影响范围】拉把调节控件（支持1px、3px推荐、Max全图快捷预设与数字精准输入），测试工作台26个工具全选默认就绪';
