import { computed } from '@angular/core';
import { CatalogComponent } from './catalog-component.js';
import { DataContext } from '../renderer/index.js';
import type { A2UIDescriptor } from '../renderer/index.js';

/**
 * LayoutContainer — 布局容器基类（Row/Column 共用）
 *
 * 抽取 children 解析公共逻辑：
 * - 数组 children：按 id 查找子组件，未就绪补 placeholder 占位
 * - 模板 children：{componentId, path} 按数据列表克隆实例（含 @index 与 _dataPathPrefix）
 * 子类仅需定义 flex-direction 等 CSS 差异。
 */
export abstract class LayoutContainer extends CatalogComponent {
  protected justify = computed(() => {
    const j = this.component()['justify'];
    return typeof j === 'string' ? j : 'start';
  });

  protected align = computed(() => {
    const a = this.component()['align'];
    return typeof a === 'string' ? a : 'stretch';
  });

  protected children = computed<A2UIDescriptor[]>(() => {
    return this.resolveChildren();
  });

  protected resolveChildren(): A2UIDescriptor[] {
    const raw = this.component()['children'];
    if (!raw) return [];

    const compMap = this.renderer.getComponentMap(this.surface());

    if (Array.isArray(raw)) {
      const prefix = this.component()['_dataPathPrefix'] as string | undefined;
      return raw.map((childId: string) => {
        const child = compMap.get(childId);
        if (child) {
          return prefix ? { ...child, _dataPathPrefix: prefix } : child;
        }
        return { id: childId, component: 'placeholder' } as A2UIDescriptor;
      });
    }

    if (typeof raw === 'object' && raw !== null) {
      const childList = raw as Record<string, unknown>;
      const templateId = childList['componentId'] as string;
      const dataPath = childList['path'] as string;
      if (templateId && dataPath) {
        const template = compMap.get(templateId);
        const ctx = new DataContext(this.renderer.surfaceManager, this.surface().surfaceId);
        const data = ctx.resolve<Record<string, unknown>[]>({ path: dataPath })();
        if (Array.isArray(data) && template) {
          return data.map((item: Record<string, unknown>, i: number) => {
            const itemId = item['id'] ?? item['name'] ?? i;
            const itemDataPath = `${dataPath}/${i}`;
            const instance: A2UIDescriptor = { ...template, _dataPathPrefix: itemDataPath, '@index': i };
            instance.id = `${templateId}:${String(itemId as string | number | bigint | symbol)}`;
            return instance;
          });
        }
      }
    }

    return [];
  }
}
