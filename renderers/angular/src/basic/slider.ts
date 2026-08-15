import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-slider',
  template: `
    <div class="a2ui-slider">
      @if (label()) {
        <span class="a2ui-slider-label">{{ label() }}</span>
      }
      <input
        type="range"
        class="a2ui-slider-input"
        [min]="min()"
        [max]="max()"
        [step]="steps()"
        [value]="value()"
        (input)="onInput($event)"
      />
      <span class="a2ui-slider-value">{{ value() }}</span>
    </div>
  `,
})
export class A2UISlider extends CatalogComponent {
  protected label = computed(() => this.resolveString(this.component()['label']));
  protected min = computed(() => this.propNum('min'));
  protected max = computed(() => this.propNum('max'));
  protected value = computed(() => this.propNum('value'));
  protected steps = computed<number | undefined>(() => {
    const s = this.component()['steps'];
    if (s === undefined || s === null) return undefined;
    const segments = Number(s);
    if (!Number.isFinite(segments) || segments <= 0) return undefined;
    const min = this.min();
    const max = this.max();
    // 上游 steps 为「离散分段数」（minimum:1），步长 = (max-min)/segments
    const span = max - min;
    return span > 0 ? span / segments : undefined;
  });

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const path = this.valuePath();
    if (path) this.writeDataModel(path, Number(target.value));
  }
}
