/**
 * @freezestudio/a2ui-angular — A2UI v1.0 Angular 渲染器公共入口
 *
 * 自 geo-scout（apps/web/src/app/a2ui 非 geo 部分）迁移：
 * 渲染适配层（renderer/）+ basic catalog 组件 + 目录注册/分发基础设施。
 * geo 行业组件不在此库（属宿主应用扩展，见 @geo/geo-catalog 与 geo-scout 应用层）。
 */
// 渲染核心适配（A2UIRendererService + Surface/A2UIDescriptor 等）
export * from './renderer/index.js';

// 目录注册与组件分发
export * from './catalog-registry.js';
export * from './component-type-map.js';
export * from './component.js';
export * from './catalog/catalog-component.js';
export * from './catalog/layout-container.js';

// 渲染基础设施
export * from './dynamic-binding.js';
export * from './export-mode.js';
export * from './fallback.js';
export * from './spacer.js';
export * from './surface.js';

// basic catalog 组件
export * from './basic/audio-player.js';
export * from './basic/button.js';
export * from './basic/card.js';
export * from './basic/check-box.js';
export * from './basic/choice-picker.js';
export * from './basic/column.js';
export * from './basic/date-time-input.js';
export * from './basic/divider.js';
export * from './basic/icon.js';
export * from './basic/image.js';
export * from './basic/list.js';
export * from './basic/modal.js';
export * from './basic/row.js';
export * from './basic/slider.js';
export * from './basic/tabs.js';
export * from './basic/text.js';
export * from './basic/textfield.js';
export * from './basic/video.js';
