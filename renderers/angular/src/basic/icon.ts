import { Component, computed } from '@angular/core';
import { ICON_PATHS } from './icon.map';
import { CatalogComponent } from '../catalog/catalog-component.js';

/**
 * A2UI v1.0 Icon 组件
 *
 * name 属性支持三种形式（DynamicString）:
 * 1. 内置图标名称字面量 → 从 ICON_PATHS 查找 SVG 路径
 * 2. 自定义 SVG path 对象 → { svgPath: "M12..." }
 * 3. 数据绑定 → 由渲染器解析后传入
 */
@Component({
  selector: 'a2ui-icon',
  template: `
    <span
      class="a2ui-icon"
      [style.width.px]="24"
      [style.height.px]="24"
      [style.display]="'inline-flex'"
      aria-hidden="true"
    >
      @if (svgPath(); as path) {
        <svg viewBox="0 0 24 24" [style.width.px]="24" [style.height.px]="24" fill="currentColor">
          <path [attr.d]="path" />
        </svg>
      }
    </span>
  `,
  host: {
    '[attr.data-a2ui-component-type]': '"Icon"',
  },
})
export class A2UIIcon extends CatalogComponent {
  protected svgPath = computed(() => {
    const rawName = this.component()['name'];
    // 1. DataBinding/FunctionCall：保留动态值语义
    if (rawName && typeof rawName === 'object' && !Array.isArray(rawName)) {
      const record = rawName as Record<string, unknown>;
      if ('svgPath' in record && record['svgPath'] !== undefined) {
        return this.resolveString(record['svgPath']);
      }
      if ('path' in record || 'call' in record) {
        const resolved = this.resolveValue(rawName);
        if (typeof resolved === 'string') return ICON_PATHS[resolved] || resolved;
        if (resolved && typeof resolved === 'object' && 'svgPath' in resolved) {
          return this.resolveString((resolved as Record<string, unknown>)['svgPath']);
        }
      }
    }
    // 2. 内置图标名字面量
    const resolved = this.resolveString(rawName);
    if (resolved) return ICON_PATHS[resolved] || resolved;
    return null;
  });
}
