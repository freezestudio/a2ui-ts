import { Component, computed, inject, input } from '@angular/core';
import { Surface, A2UIRendererService, findRootComponent } from './renderer/index.js';
import { A2UIComponent } from './component.js';

@Component({
  selector: 'a2ui-surface',
  imports: [A2UIComponent],
  template: `
    @if (surface(); as s) {
      <div class="a2ui-surface" [attr.data-surface-id]="s.surfaceId">
        @for (comp of rootComponent(); track comp.id) {
          <a2ui-component [component]="comp" [surface]="s" [snapshotSurface]="snapshot() ? s : null" />
        }
      </div>
    }
  `,
})
export class A2UISurface {
  surface = input<Surface | null>(null);
  /** 快照模式：直接渲染传入的 surface 对象（如导出报告的历史轮次快照），
   *  不再回查实时 renderer 状态，避免所有快照都渲染成最终态 */
  snapshot = input<boolean>(false);

  private renderer = inject(A2UIRendererService);

  protected rootComponent = computed(() => {
    const s = this.surface();
    if (!s) return [];
    // 快照模式：使用传入的 surface 本身（已深拷贝）
    const surface = this.snapshot() ? s : this.renderer.surfaces().get(s.surfaceId);
    const root = findRootComponent(surface?.components ?? []);
    return root ? [root] : [];
  });
}
