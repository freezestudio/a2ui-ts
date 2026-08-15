import { Component } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';
import { A2UIComponent } from '../component.js';

@Component({
  selector: 'a2ui-card',
  imports: [A2UIComponent],
  template: `
    <div
      class="a2ui-card"
      [style.flex-grow]="weight()"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      @if (childComponent(); as child) {
        <a2ui-component [component]="child" [surface]="surface()" />
      }
    </div>
  `,
  styles: `
    .a2ui-card {
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e0e0e0);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  `,
})
export class A2UICard extends CatalogComponent {}
