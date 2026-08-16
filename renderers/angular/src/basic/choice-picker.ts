import { Component, computed, signal } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-choice-picker',
  template: `
    <div
      class="a2ui-choice-picker"
      [class.a2ui-choice-picker-chips]="displayStyle() === 'chips'"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      @if (label()) {
        <label class="a2ui-choice-picker-label">{{ label() }}</label>
      }
      @if (filterable()) {
        <input
          class="a2ui-choice-filter"
          type="text"
          placeholder="搜索选项..."
          [value]="filterText()"
          (input)="onFilterInput($event)"
        />
      }
      <div class="a2ui-choice-options">
        @for (option of filteredOptions(); track option.value) {
          <label
            class="a2ui-choice-option"
            [class.a2ui-choice-chip]="displayStyle() === 'chips'"
            [class.selected]="isSelected(option.value)"
          >
            @if (displayStyle() !== 'chips') {
              <input type="checkbox" [checked]="isSelected(option.value)" (change)="toggleOption(option.value)" />
            }
            @if (displayStyle() === 'chips') {
              <input
                type="checkbox"
                [checked]="isSelected(option.value)"
                (change)="toggleOption(option.value)"
                hidden
              />
            }
            <span>{{ option.label }}</span>
          </label>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .a2ui-choice-picker-label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
      }
      .a2ui-choice-options {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .a2ui-choice-picker-chips .a2ui-choice-options {
        flex-direction: row;
        flex-wrap: wrap;
      }
      .a2ui-choice-option {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 2px 0;
      }
      .a2ui-choice-chip {
        padding: 4px 10px;
        border: 1px solid #ccc;
        border-radius: 12px;
        font-size: 13px;
      }
      .a2ui-choice-chip.selected {
        background: #1976d2;
        color: #fff;
        border-color: #1976d2;
      }
      .a2ui-choice-filter {
        width: 100%;
        margin-bottom: 6px;
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
      }
    `,
  ],
})
export class A2UIChoicePicker extends CatalogComponent {
  protected label = computed(() => this.resolveString(this.component()['label']));

  protected options = computed(() => {
    const opts = this.component()['options'];
    if (!Array.isArray(opts)) return [];
    return opts
      .map((o) => {
        if (typeof o !== 'object' || o === null) return null;
        const label = this.resolveString((o as Record<string, unknown>)['label']);
        const value = String(((o as Record<string, unknown>)['value'] ?? '') as string | number | bigint | symbol);
        return { label, value };
      })
      .filter((o): o is { label: string; value: string } => o !== null);
  });

  protected selectedValues = computed(() => {
    const val = this.component()['value'];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
    if (typeof val === 'object' && val && ('path' in val || 'call' in val)) {
      const resolved = this.resolveValue(val);
      return Array.isArray(resolved) ? resolved.filter((v): v is string => typeof v === 'string') : [];
    }
    return [];
  });

  protected variant = computed(() => {
    const v = this.component()['variant'];
    return typeof v === 'string' ? v : 'mutuallyExclusive';
  });

  protected displayStyle = computed(() => {
    const s = this.component()['displayStyle'];
    return typeof s === 'string' ? s : 'checkbox';
  });

  protected filterable = computed(() => Boolean(this.component()['filterable']));

  protected filterText = signal('');

  protected filteredOptions = computed(() => {
    const filter = this.filterText().toLowerCase();
    if (!filter) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(filter));
  });

  protected isSelected(value: string): boolean {
    return this.selectedValues().includes(value);
  }

  onFilterInput(event: Event): void {
    this.filterText.set((event.target as HTMLInputElement).value);
  }

  toggleOption(value: string): void {
    const current = [...this.selectedValues()];
    const idx = current.indexOf(value);
    const next = this.variant() === 'mutuallyExclusive' ? (idx >= 0 ? [] : [value]) : undefined;
    let result = next;
    if (result === undefined) {
      if (idx >= 0) current.splice(idx, 1);
      else current.push(value);
      result = current;
    }
    const path = this.valuePath();
    if (path) this.writeDataModel(path, result);
  }
}
