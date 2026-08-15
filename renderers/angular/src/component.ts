import { Component, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { type A2UIDescriptor, type Surface } from './renderer/index.js';
import { CatalogRegistry } from './catalog-registry.js';
import { A2UIFallback } from './fallback.js';

/** Basic Catalog（布局/基础组件），作为 surface catalog 解析失败的兜底 */
const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/**
 * A2UIComponent — A2UI 组件动态宿主
 *
 * 单一渲染路径：Catalog 解析（组件级 catalogId → surface 默认 catalogId → basic 兜底）→ NgComponentOutlet。
 * - placeholder 走模板占位分支（增量渲染骨架屏，不注册 Catalog）
 * - 解析不到 → a2ui-fallback 兜底
 *
 * v1.0 解析顺序：组件级 catalogId → surface 默认 catalogId → basic catalog 兜底。
 * basic 兜底支持 LLM 生成"geo surface + basic 布局（Column/Row/Tabs/Text 等）"混合场景：
 * geo 目录专注传感器图表，基础布局组件始终可用。
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

    // basic 兜底：布局/基础组件（Column/Row/Tabs/Text 等）跨目录可用，
    // 兼容 LLM 生成 geo surface + basic 布局的混合场景
    if (surfaceCatalogId !== BASIC_CATALOG_ID) {
      const resolved = this.catalogRegistry.resolve(BASIC_CATALOG_ID, comp.component);
      if (resolved) return resolved;
    }

    return null;
  });
}
