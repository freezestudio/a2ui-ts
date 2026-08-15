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
  protected resolvedName = computed<unknown>(() => {
    const n = this.component()['name'];
    // name 可能是 DataBinding（{path}）→ 先解析为实际值再判断形态
    const resolved = n !== undefined && n !== null ? this.resolveString(n) : undefined;
    if (resolved !== undefined && resolved !== null && resolved !== '') return resolved;
    const svg = this.component()['svgPath'];
    return svg ?? '';
  });

  protected svgPath = computed(() => {
    const n = this.resolvedName();
    // 1. 内置图标名字面量（已解析）
    if (typeof n === 'string') {
      const resolved = this.resolveString(n);
      return ICON_PATHS[resolved] || null;
    }
    // 2. 自定义 SVG path 对象 { svgPath: "M12..." }（name 或 svgPath 字段）
    if (typeof n === 'object' && n && 'svgPath' in n) {
      return (n as Record<string, unknown>)['svgPath'] as string;
    }
    return null;
  });
}
