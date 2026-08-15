import { InjectionToken } from '@angular/core';

/**
 * 导出模式标识
 *
 * 为 true 时，交互门控组件（Tabs / Modal）不再依赖用户交互，
 * 直接展开全部内容，供导出页（export-page）被 Puppeteer
 * 打印 / 截图时完整呈现。
 *
 * 主界面不提供该 token，默认 false 保持交互行为。
 */
export const A2UI_EXPORT_MODE = new InjectionToken<boolean>('A2UI_EXPORT_MODE', {
  providedIn: 'root',
  factory: () => false,
});
