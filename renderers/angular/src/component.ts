import { Component, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { type A2UIDescriptor, type Surface } from './renderer/index.js';
import { CatalogRegistry } from './catalog-registry.js';
import { A2UIFallback } from './fallback.js';

/**
 * A2UIComponent — A2UI 组件动态宿主
 *
 * v1.0 严格解析顺序：组件级 catalogId → surface 默认 catalogId；
 * 两者都缺失或未注册时不做 basic 兜底，渲染 a2ui-fallback。
 */
@Component({
  selector: 'a2ui-component',
  imports: [NgComponentOutlet, A2UIFallback],
  template: `
    @if (component().component === 'placeholder') {
      <div class="a2ui-placeholder"><div class="a2ui-placeholder-pulse"></div></div>
    } @else if (resolvedComponent(); as compClass) {
      <ng-container
        [ngComponentOutlet]="compClass"
        [ngComponentOutletInputs]="{
          component: component(),
          surface: surface(),
          snapshotSurface: snapshotSurface(),
        }"
      />
    } @else {
      <a2ui-fallback [type]="component().component" [id]="component().id" />
    }
  `,
})
export class A2UIComponent {
  component = input.required<A2UIDescriptor>();
  surface = input.required<Surface>();
  /** 快照模式透传：历史轮次深拷贝 surface，供子组件隔离解析数据绑定 */
  snapshotSurface = input<Surface | null>(null);

  private catalogRegistry = inject(CatalogRegistry);

  protected resolvedComponent = computed(() => {
    const comp = this.component();
    const componentCatalogId = comp['catalogId'] as string | undefined;

    if (componentCatalogId) {
      const resolved = this.catalogRegistry.resolve(componentCatalogId, comp.component);
      if (resolved) return resolved;
    }

    const surfaceCatalogId = this.surface().catalogId;
    if (surfaceCatalogId) {
      const resolved = this.catalogRegistry.resolve(surfaceCatalogId, comp.component);
      if (resolved) return resolved;
    }

    return null;
  });
}
