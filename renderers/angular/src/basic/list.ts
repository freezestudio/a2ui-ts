import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';
import { A2UIComponent } from '../component.js';
import type { A2UIDescriptor } from '../renderer/index.js';

@Component({
  selector: 'a2ui-list',
  imports: [A2UIComponent],
  template: `
    <div
      class="a2ui-list"
      [class.a2ui-list-vertical]="direction() === 'vertical' || !direction()"
      [class.a2ui-list-horizontal]="direction() === 'horizontal'"
      [class.a2ui-list-align-start]="align() === 'start'"
      [class.a2ui-list-align-end]="align() === 'end'"
      [style.flex-grow]="weight()"
    >
      @for (child of children(); track child.id) {
        <a2ui-component [component]="child" [surface]="surface()" />
      }
    </div>
  `,
  styles: `
    .a2ui-list {
      display: flex;
    }
    .a2ui-list-vertical {
      flex-direction: column;
    }
    .a2ui-list-horizontal {
      flex-direction: row;
    }
    /* align: 交叉轴对齐（start/end），仅在有富余空间时生效 */
    .a2ui-list-align-start {
      align-items: flex-start;
    }
    .a2ui-list-align-end {
      align-items: flex-end;
    }
  `,
})
export class A2UIList extends CatalogComponent {
  protected direction = computed(() => {
    const d = this.component()['direction'];
    return typeof d === 'string' ? d : 'vertical';
  });

  // 上游 v1.0 新增：交叉轴对齐（start/end），默认不设置（stretch）
  protected align = computed(() => {
    const a = this.component()['align'];
    return typeof a === 'string' && (a === 'start' || a === 'end') ? a : '';
  });

  protected children = computed(() => {
    const raw = this.component()['children'];
    if (!raw) return [];

    const surface = this.renderer.surfaces().get(this.surface().surfaceId);
    const result: A2UIDescriptor[] = [];

    if (Array.isArray(raw)) {
      const prefix = this.component()['_dataPathPrefix'] as string | undefined;
      for (const childId of raw) {
        if (typeof childId === 'string') {
          const child = surface?.components.find((c) => c.id === childId) ?? null;
          if (child) {
            result.push(prefix ? { ...child, _dataPathPrefix: prefix } : child);
          } else {
            result.push({ id: childId, component: 'placeholder' } as A2UIDescriptor);
          }
        }
      }
    } else if (typeof raw === 'object' && raw !== null) {
      const childList = raw as Record<string, unknown>;
      const templateId = childList['componentId'] as string;
      const dataPath = childList['path'] as string;
      if (templateId && dataPath) {
        const template = surface?.components.find((c) => c.id === templateId) ?? null;
        const data = this.renderer.resolveDynamicValue({ path: dataPath }, this.surface());
        if (Array.isArray(data) && template) {
          for (let i = 0; i < data.length; i++) {
            const item = data[i] as Record<string, unknown>;
            const itemId = item['id'] || item['name'] || i;
            const itemDataPath = `${dataPath}/${i}`;
            const instance = this.cloneWithPrefix(template, itemDataPath);
            (instance as Record<string, unknown>)['@index'] = i;
            instance.id = `${templateId}:${String(itemId as string | number | bigint | symbol)}`;
            result.push(instance);
          }
        }
      }
    }

    return result;
  });

  private cloneWithPrefix(template: A2UIDescriptor, dataPathPrefix: string): A2UIDescriptor {
    const clone: A2UIDescriptor = { ...template, _dataPathPrefix: dataPathPrefix };
    for (const [key, value] of Object.entries(template)) {
      if (key === 'id' || key === 'component') continue;
      clone[key] = this.deepCloneWithPrefix(value, dataPathPrefix);
    }
    return clone;
  }

  private deepCloneWithPrefix(value: unknown, prefix: string): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.deepCloneWithPrefix(item, prefix));
    }
    const obj = value as Record<string, unknown>;
    if ('path' in obj && typeof obj['path'] === 'string' && !(obj['path'] as string).startsWith('/')) {
      return { ...obj, path: `${prefix}/${obj['path']}` };
    }
    if ('call' in obj && 'args' in obj && obj['args'] && typeof obj['args'] === 'object') {
      return { ...obj, args: this.deepCloneWithPrefix(obj['args'], prefix) };
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = this.deepCloneWithPrefix(v, prefix);
    }
    return result;
  }
}
