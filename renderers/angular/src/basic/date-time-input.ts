import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-date-time-input',
  template: `
    <div
      class="a2ui-datetime"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      @if (label()) {
        <label class="a2ui-datetime-label">{{ label() }}</label>
      }
      <div class="a2ui-datetime-inputs">
        @if (enableDate()) {
          <input
            class="a2ui-datetime-input"
            type="date"
            [value]="dateValue()"
            [min]="minStr()"
            [max]="maxStr()"
            (change)="onDateChange($event)"
          />
        }
        @if (enableTime()) {
          <input
            class="a2ui-datetime-input"
            type="time"
            [value]="timeValue()"
            [min]="enableDate() ? undefined : minStr()"
            [max]="enableDate() ? undefined : maxStr()"
            (change)="onTimeChange($event)"
          />
        }
      </div>
    </div>
  `,
})
export class A2UIDateTimeInput extends CatalogComponent {
  protected label = computed(() => this.resolveString(this.component()['label']));
  protected value = computed(() => this.resolveString(this.component()['value']));
  protected enableDate = computed(() => Boolean(this.component()['enableDate']));
  protected enableTime = computed(() => Boolean(this.component()['enableTime']));
  protected minStr = computed(() => this.resolveString(this.component()['min']));
  protected maxStr = computed(() => this.resolveString(this.component()['max']));

  protected dateValue = computed(() => {
    const v = this.value();
    if (!v) return '';
    return v.split('T')[0] || v;
  });

  protected timeValue = computed(() => {
    const v = this.value();
    if (!v) return '';
    const parts = v.split('T');
    return parts[1] ? parts[1].split('+')[0].split('Z')[0] : '';
  });

  onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const date = target.value;
    const val = this.enableTime() ? `${date}T${this.timeValue() || '00:00'}` : date;
    this.writeValue(val);
  }

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const time = target.value;
    const val = this.enableDate() ? `${this.dateValue() || '0000-00-00'}T${time}` : time;
    this.writeValue(val);
  }

  private writeValue(val: string): void {
    const path = this.valuePath();
    if (path) this.writeDataModel(path, val);
  }
}
