import { Component } from '@angular/core';
import { LayoutContainer } from '../catalog/layout-container.js';
import { A2UIComponent } from '../component.js';

@Component({
  selector: 'a2ui-column',
  imports: [A2UIComponent],
  template: `
    <div
      class="a2ui-column"
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
        <div class="a2ui-column-empty"></div>
      }
    </div>
  `,
  styles: `
    .a2ui-column {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 8px 0;
      margin: 0;
    }
    .a2ui-column[data-justify='center'] {
      justify-content: center;
    }
    .a2ui-column[data-justify='end'] {
      justify-content: flex-end;
    }
    .a2ui-column[data-justify='spaceAround'] {
      justify-content: space-around;
    }
    .a2ui-column[data-justify='spaceBetween'] {
      justify-content: space-between;
    }
    .a2ui-column[data-justify='spaceEvenly'] {
      justify-content: space-evenly;
    }
    .a2ui-column[data-justify='stretch'] {
      justify-content: stretch;
    }
    .a2ui-column[data-align='start'] {
      align-items: flex-start;
    }
    .a2ui-column[data-align='end'] {
      align-items: flex-end;
    }
  `,
})
export class A2UIColumn extends LayoutContainer {}
