import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-image',
  template: `
    <img
      [src]="src()"
      [alt]="alt()"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
      class="a2ui-image"
      [class.a2ui-image-fill]="resolvedFit() === 'fill'"
      [class.a2ui-image-contain]="resolvedFit() === 'contain'"
      [class.a2ui-image-cover]="resolvedFit() === 'cover'"
      [class.a2ui-image-none]="resolvedFit() === 'none'"
      [class.a2ui-image-scaleDown]="resolvedFit() === 'scaleDown'"
      [class.a2ui-image-icon]="resolvedVariant() === 'icon'"
      [class.a2ui-image-avatar]="resolvedVariant() === 'avatar'"
      [class.a2ui-image-smallFeature]="resolvedVariant() === 'smallFeature'"
      [class.a2ui-image-mediumFeature]="resolvedVariant() === 'mediumFeature'"
      [class.a2ui-image-largeFeature]="resolvedVariant() === 'largeFeature'"
      [class.a2ui-image-header]="resolvedVariant() === 'header'"
      [attr.data-a2ui-component]="'Image'"
      [style.flex-grow]="weight()"
    />
  `,
  host: {
    '[attr.data-a2ui-component-type]': '"Image"',
  },
  styles: `
    .a2ui-image {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    .a2ui-image-fill {
      object-fit: fill;
    }
    .a2ui-image-contain {
      object-fit: contain;
      width: 100%;
      height: 100%;
    }
    .a2ui-image-cover {
      object-fit: cover;
      width: 100%;
      height: 100%;
    }
    .a2ui-image-none {
      object-fit: none;
    }
    .a2ui-image-scaleDown {
      object-fit: scale-down;
    }

    .a2ui-image-icon {
      width: 24px;
      height: 24px;
    }
    .a2ui-image-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    .a2ui-image-smallFeature {
      width: 120px;
      height: 90px;
    }
    .a2ui-image-mediumFeature {
      width: 240px;
      height: 180px;
    }
    .a2ui-image-largeFeature {
      width: 480px;
      height: 320px;
    }
    .a2ui-image-header {
      width: 100%;
      height: 200px;
    }
  `,
})
export class A2UIImage extends CatalogComponent {
  protected src = computed(() => {
    const s = this.prop('url');
    return s === undefined || s === null ? '' : String(s as string | number | bigint | symbol);
  });

  protected alt = computed(() => {
    const a = this.prop('description');
    return a === undefined || a === null ? '' : String(a as string | number | bigint | symbol);
  });

  protected resolvedFit = computed(() => {
    const f = this.prop('fit');
    const valid = ['contain', 'cover', 'fill', 'none', 'scaleDown'];
    return typeof f === 'string' && valid.includes(f) ? f : 'fill';
  });

  protected resolvedVariant = computed(() => {
    const v = this.prop('variant');
    const valid = ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'];
    return typeof v === 'string' && valid.includes(v) ? v : 'mediumFeature';
  });
}
