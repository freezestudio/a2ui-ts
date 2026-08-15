import { Component, inject } from '@angular/core';
import { LayoutContainer } from '../catalog/layout-container.js';
import { A2UIComponent } from '../component.js';
import { A2UI_EXPORT_MODE } from '../export-mode.js';

@Component({
  selector: 'a2ui-row',
  imports: [A2UIComponent],
  template: `
    <div
      class="a2ui-row"
      [class.a2ui-row-export]="exportMode"
      [attr.data-justify]="justify()"
      [attr.data-align]="align()"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      @for (child of children(); track child.id) {
        <a2ui-component [component]="child" [surface]="surface()" />
      } @empty {
        <div class="a2ui-row-empty"></div>
      }
    </div>
  `,
  styles: `
    .a2ui-row {
      display: flex;
      flex-direction: row;
      gap: 12px;
      padding: 0;
      margin: 0;
    }
    /* 导出模式（A4 窄宽）：多列组件自动换行，避免挤压重叠 */
    .a2ui-row-export {
      flex-wrap: wrap;
    }
    .a2ui-row-export > a2ui-component {
      flex: 1 1 calc(50% - 6px);
      min-width: 320px;
    }
    .a2ui-row-export > a2ui-component:only-child {
      flex: 1 1 100%;
    }
    .a2ui-row[data-justify='center'] {
      justify-content: center;
    }
    .a2ui-row[data-justify='end'] {
      justify-content: flex-end;
    }
    .a2ui-row[data-justify='spaceAround'] {
      justify-content: space-around;
    }
    .a2ui-row[data-justify='spaceBetween'] {
      justify-content: space-between;
    }
    .a2ui-row[data-justify='spaceEvenly'] {
      justify-content: space-evenly;
    }
    .a2ui-row[data-justify='stretch'] {
      justify-content: stretch;
    }
    .a2ui-row[data-align='start'] {
      align-items: flex-start;
    }
    .a2ui-row[data-align='end'] {
      align-items: flex-end;
    }
  `,
})
export class A2UIRow extends LayoutContainer {
  protected exportMode = inject(A2UI_EXPORT_MODE);
}
