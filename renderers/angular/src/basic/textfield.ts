import { Component, computed } from '@angular/core';
import { CatalogComponent } from '../catalog/catalog-component.js';

@Component({
  selector: 'a2ui-textfield',
  template: `
    <div
      class="a2ui-textfield"
      [style.flex-grow]="weight()"
      [attr.aria-label]="accessibilityAttrs()['aria-label']"
      [attr.aria-description]="accessibilityAttrs()['aria-description']"
      [attr.aria-live]="accessibilityAttrs()['aria-live']"
      [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
    >
      <label class="a2ui-textfield-label">{{ label() }}</label>
      @switch (variant()) {
        @case ('longText') {
          <textarea
            class="a2ui-textfield-input"
            [placeholder]="placeholder()"
            [value]="value()"
            (input)="onInput($event)"
          ></textarea>
        }
        @case ('number') {
          <input
            type="number"
            class="a2ui-textfield-input"
            [placeholder]="placeholder()"
            [value]="value()"
            (input)="onInput($event)"
          />
        }
        @case ('obscured') {
          <input
            type="password"
            class="a2ui-textfield-input"
            [placeholder]="placeholder()"
            [value]="value()"
            (input)="onInput($event)"
          />
        }
        @default {
          <input
            type="text"
            class="a2ui-textfield-input"
            [placeholder]="placeholder()"
            [value]="value()"
            (input)="onInput($event)"
          />
        }
      }
    </div>
    @if (validationErrors().length > 0) {
      <div class="a2ui-checks">
        @for (msg of validationErrors(); track msg) {
          <span class="a2ui-check-error">{{ msg }}</span>
        }
      </div>
    }
  `,
  styles: `
    .a2ui-textfield {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .a2ui-textfield-label {
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
    }
    .a2ui-textfield-input {
      padding: 8px 12px;
      border: 1px solid var(--input-border, #ccc);
      border-radius: 6px;
      font-size: 0.875rem;
      outline: none;
    }
    .a2ui-textfield-input:focus {
      border-color: var(--color-primary, #0066cc);
    }
    .a2ui-checks {
      margin-top: 2px;
    }
    .a2ui-check-error {
      font-size: 0.75rem;
      color: var(--color-error, #d32f2f);
    }
  `,
})
export class A2UITextField extends CatalogComponent {
  protected label = computed(() => this.resolveString(this.component()['label']));

  protected placeholder = computed(() => this.resolveString(this.component()['placeholder']));

  protected value = computed(() => this.resolveString(this.component()['value']));

  protected variant = computed(() => {
    const v = this.component()['variant'];
    return typeof v === 'string' ? v : 'shortText';
  });

  /** 响应式校验错误（与 Button 的 isValid 一致，来自 ComponentBinder 注入的 validationErrors） */
  protected validationErrors = computed(() => {
    const errors = this.prop<string[]>('validationErrors');
    return Array.isArray(errors) ? errors : [];
  });

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const path = this.valuePath();
    if (path) this.writeDataModel(path, target.value);
  }
}
