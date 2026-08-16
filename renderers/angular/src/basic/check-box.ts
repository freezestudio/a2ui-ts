import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-check-box',
  template: `
    <label
      class="a2ui-checkbox"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      <input type="checkbox" [checked]="checked()" (change)="onChange($event)" />
      <span class="a2ui-checkbox-label">{{ label() }}</span>
    </label>
  `,
})
export class A2UICheckBox extends CatalogComponent {
  protected checked = computed(() => this.propBool('value'));

  protected label = computed(() => this.resolveString(this.component()['label']));

  onChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const path = this.valuePath();
    if (path) this.writeDataModel(path, target.checked);
  }
}
