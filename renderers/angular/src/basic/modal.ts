import { Component, computed, inject, signal } from '@angular/core';
import { A2UI_EXPORT_MODE } from '../export-mode.js';
import { CatalogComponent } from '../catalog/catalog-component.js';
import { A2UIComponent } from '../component.js';

@Component({
  selector: 'a2ui-modal',
  imports: [A2UIComponent],
  template: `
    @if (exportMode) {
      <!-- 导出模式：跳过 trigger/overlay 交互，直接渲染模态内容 -->
      @if (contentComponent(); as content) {
        <div class="a2ui-modal-content-export">
          <a2ui-component [component]="content" [surface]="surface()" />
        </div>
      }
    } @else {
      <div
        class="a2ui-modal-wrapper"
        [style.flex-grow]="weight()"
        [attr.aria-label]="accessibilityAttrs()['aria-label']"
        [attr.aria-description]="accessibilityAttrs()['aria-description']"
        [attr.aria-live]="accessibilityAttrs()['aria-live']"
        [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
      >
        @if (triggerComponent(); as trigger) {
          <div class="a2ui-modal-trigger" (click)="open()" (keydown.enter)="open()" tabindex="0" role="button">
            <a2ui-component [component]="trigger" [surface]="surface()" />
          </div>
        }
        @if (isOpen()) {
          <div class="a2ui-modal-overlay" (click)="close()" tabindex="0" (keydown.escape)="close()">
            <div class="a2ui-modal-content" (click)="$event.stopPropagation()">
              @if (contentComponent(); as content) {
                <a2ui-component [component]="content" [surface]="surface()" />
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .a2ui-modal-wrapper {
      display: inline-block;
    }
    .a2ui-modal-trigger {
      display: inline-block;
      cursor: pointer;
    }
    .a2ui-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .a2ui-modal-content {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      min-width: 300px;
      max-width: 80vw;
      max-height: 80vh;
      overflow: auto;
    }
  `,
})
export class A2UIModal extends CatalogComponent {
  protected exportMode = inject(A2UI_EXPORT_MODE);
  protected isOpen = signal(false);

  protected triggerComponent = computed(() => {
    const triggerId = this.component()['trigger'];
    return this.findChild(triggerId);
  });

  protected contentComponent = computed(() => {
    const contentId = this.component()['content'];
    return this.findChild(contentId);
  });

  protected open(): void {
    this.isOpen.set(true);
  }

  protected close(): void {
    this.isOpen.set(false);
  }
}
