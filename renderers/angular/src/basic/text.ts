import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-text',
  template: `
    @switch (variant()) {
      @case ('caption') {
        <small
          class="a2ui-text a2ui-text-caption"
          [style.flex-grow]="weight()"
          [attr.aria-label]="accessibilityAttrs()['aria-label']"
          [attr.aria-description]="accessibilityAttrs()['aria-description']"
          [attr.aria-live]="accessibilityAttrs()['aria-live']"
          [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
          >{{ text() }}</small
        >
      }
      @default {
        <p
          class="a2ui-text a2ui-text-body"
          [style.flex-grow]="weight()"
          [attr.aria-label]="accessibilityAttrs()['aria-label']"
          [attr.aria-description]="accessibilityAttrs()['aria-description']"
          [attr.aria-live]="accessibilityAttrs()['aria-live']"
          [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
        >
          {{ text() }}
        </p>
      }
    }
  `,
  host: {
    '[attr.data-a2ui-component-type]': '"Text"',
  },
  styles: `
    .a2ui-text {
      margin: 0;
    }
    .a2ui-text-body {
      font-size: 1rem;
      line-height: 1.5;
    }
    .a2ui-text-caption {
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--text-secondary, #666);
    }
  `,
})
export class A2UIText extends CatalogComponent {
  protected variant = computed(() => {
    const v = this.prop('variant');
    return v === 'caption' ? 'caption' : 'body';
  });

  protected text = computed(() => {
    const t = this.prop('text');
    return t === undefined || t === null ? '' : String(t as string | number | bigint | symbol);
  });
}
