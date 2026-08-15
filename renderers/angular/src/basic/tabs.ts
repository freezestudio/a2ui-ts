import { Component, computed, inject, signal } from '@angular/core';
import { A2UI_EXPORT_MODE } from '../export-mode.js';
import { CatalogComponent } from '../catalog/catalog-component.js';
import { A2UIComponent } from '../component.js';
import type { A2UIDescriptor } from '../renderer/index.js';

@Component({
  selector: 'a2ui-tabs',
  imports: [A2UIComponent],
  template: `
    @if (exportMode) {
      <!-- 导出模式：隐藏 tab 头，顺序展开所有 tab 面板 -->
      @for (tab of tabs(); track $index) {
        @if (tabChild(tab); as child) {
          <a2ui-component [component]="child" [surface]="surface()" />
        }
      }
    } @else {
      <div
        class="a2ui-tabs"
        [style.flex-grow]="weight()"
        [attr.aria-label]="accessibilityAttrs()['aria-label']"
        [attr.aria-description]="accessibilityAttrs()['aria-description']"
        [attr.aria-live]="accessibilityAttrs()['aria-live']"
        [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
      >
        <div class="a2ui-tabs-header">
          @for (tab of tabs(); track $index; let i = $index) {
            <button class="a2ui-tab-button" [class.active]="activeIndex() === i" (click)="activeIndex.set(i)">
              {{ tabTitle(tab) }}
            </button>
          }
        </div>
        <div class="a2ui-tab-content">
          @if (activeTabChild(); as child) {
            <a2ui-component [component]="child" [surface]="surface()" />
          }
        </div>
      </div>
    }
  `,
  styles: `
    .a2ui-tabs {
      display: flex;
      flex-direction: column;
    }
    .a2ui-tabs-header {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid #e0e0e0;
    }
    .a2ui-tab-button {
      padding: 8px 16px;
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .a2ui-tab-button.active {
      border-bottom: 2px solid var(--color-primary, #0066cc);
      font-weight: 600;
    }
    .a2ui-tab-content {
      padding: 16px 0;
    }
  `,
})
export class A2UITabs extends CatalogComponent {
  protected exportMode = inject(A2UI_EXPORT_MODE);
  protected activeIndex = signal(0);

  protected tabs = computed(() => {
    const items = this.component()['tabs'];
    return Array.isArray(items) ? items : [];
  });

  protected tabTitle(tab: unknown): string {
    const title = (tab as Record<string, unknown>)['title'];
    return this.resolveString(title);
  }

  /** 解析 tab 面板引用（tabs[i].child → surface 组件），导出模式与交互模式共用 */
  protected tabChild(tab: unknown): A2UIDescriptor | null {
    const childId = (tab as { child?: string } | undefined)?.child;
    return this.findChild(childId);
  }

  protected activeTabChild = computed(() => {
    const tab = this.tabs()[this.activeIndex()];
    return this.tabChild(tab);
  });
}
