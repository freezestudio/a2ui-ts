import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-divider',
  template: `
    @if (axis() === 'vertical') {
      <div
        class="a2ui-divider a2ui-divider-vertical"
        [style.flex-grow]="weight()"
        [attr.aria-label]="accessibilityAttrs()['aria-label']"
        [attr.aria-description]="accessibilityAttrs()['aria-description']"
        [attr.aria-live]="accessibilityAttrs()['aria-live']"
        [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
      ></div>
    } @else {
      <hr class="a2ui-divider" [style.flex-grow]="weight()" />
    }
  `,
  styles: `
    .a2ui-divider {
      border: none;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      margin: 8px 0;
    }
    .a2ui-divider-vertical {
      border-top: none;
      border-left: 1px solid var(--divider-color, #e0e0e0);
      margin: 0 8px;
      min-height: 24px;
      align-self: stretch;
    }
  `,
})
export class A2UIDivider extends CatalogComponent {
  protected axis = computed(() => {
    const a = this.component()['axis'];
    return typeof a === 'string' ? a : 'horizontal';
  });
}
