import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-video',
  template: `
    <div
      class="a2ui-video-wrapper"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      <video class="a2ui-video" [src]="url()" [poster]="posterUrl()" controls [style.width.%]="100">
        您的浏览器不支持视频播放
      </video>
    </div>
  `,
})
export class A2UIVideo extends CatalogComponent {
  protected url = computed(() => this.resolveString(this.component()['url']));
  protected posterUrl = computed(() => this.resolveString(this.component()['posterUrl']));
}
