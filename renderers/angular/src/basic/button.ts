import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';
import { A2UIComponent } from '../component.js';
import type { A2UIDescriptor } from '../renderer/index.js';

@Component({
  selector: 'a2ui-button',
  imports: [A2UIComponent],
  template: `
    <button
      class="a2ui-button"
      [class.a2ui-button-primary]="variant() === 'primary'"
      [class.a2ui-button-borderless]="variant() === 'borderless'"
      [class.a2ui-button-default]="variant() === 'default'"
      [attr.data-a2ui-component]="'Button'"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
      [style.flex-grow]="weight()"
      [disabled]="isDisabled()"
      (click)="handleAction()"
    >
      @if (resolvedChild(); as child) {
        <a2ui-component [component]="child" [surface]="surface()" />
      }
    </button>
  `,
  styles: `
    .a2ui-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.2s,
        opacity 0.2s;
    }
    .a2ui-button-default {
      background: var(--button-bg, #f0f0f0);
      color: var(--button-text, #333);
    }
    .a2ui-button-primary {
      background: var(--color-primary, #0066cc);
      color: white;
    }
    .a2ui-button-borderless {
      background: transparent;
      color: var(--color-primary, #0066cc);
      padding-left: 8px;
      padding-right: 8px;
    }
  `,
})
export class A2UIButton extends CatalogComponent {
  protected variant = computed(() => {
    const v = this.component()['variant'];
    if (typeof v === 'string' && ['default', 'primary', 'borderless'].includes(v)) {
      return v;
    }
    return 'default';
  });

  protected resolvedChild = computed<A2UIDescriptor | null>(() => {
    const childId = this.component()['child'];
    return this.findChild(childId);
  });

  protected isDisabled = computed(() => {
    const comp = this.component();
    const checks = comp['checks'];
    if (!Array.isArray(checks) || checks.length === 0) return false;
    for (const check of checks) {
      const condition = check['condition'];
      if (condition !== undefined) {
        const result = this.resolveValue(condition);
        // v1.0 #2220：condition 求值为 ValidationResult 对象（{valid}）或布尔
        const valid = result && typeof result === 'object' && 'valid' in result ? result['valid'] : Boolean(result);
        if (!valid) return true;
      }
    }
    return false;
  });
}
