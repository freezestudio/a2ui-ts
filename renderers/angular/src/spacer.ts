import { Component } from '@angular/core';
import { CatalogComponent } from './catalog/catalog-component.js';

@Component({
  selector: 'a2ui-spacer',
  template: `<div
    class="a2ui-spacer"
    [style.flex-grow]="weight() || '1'"
    [style.min-width.px]="0"
    [style.min-height.px]="0"
  ></div>`,
  styles: `
    .a2ui-spacer {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }
  `,
})
export class A2UISpacer extends CatalogComponent {}
