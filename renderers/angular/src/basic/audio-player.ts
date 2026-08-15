import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-audio-player',
  template: `
    <div
      class="a2ui-audio-player"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      @if (description()) {
        <p class="a2ui-audio-description">{{ description() }}</p>
      }
      <audio [src]="url()" controls [style.width.%]="100">您的浏览器不支持音频播放</audio>
    </div>
  `,
})
export class A2UIAudioPlayer extends CatalogComponent {
  protected url = computed(() => this.resolveString(this.component()['url']));
  protected description = computed(() => this.resolveString(this.component()['description']));
}
