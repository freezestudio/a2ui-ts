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
          [innerHTML]="renderedText()"
        ></small>
      }
      @default {
        <p
          class="a2ui-text a2ui-text-body"
          [style.flex-grow]="weight()"
          [attr.aria-label]="accessibilityAttrs()['aria-label']"
          [attr.aria-description]="accessibilityAttrs()['aria-description']"
          [attr.aria-live]="accessibilityAttrs()['aria-live']"
          [attr.aria-hidden]="accessibilityAttrs()['aria-hidden']"
          [innerHTML]="renderedText()"
        ></p>
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

  /** 简单 Markdown 渲染（先转义 HTML，再应用粗体/斜体/标题/换行） */
  protected renderedText = computed(() => {
    const escapeHtml = (value: string): string =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = this.text().split(/\r?\n/);
    return lines
      .map((line) => {
        let rendered = escapeHtml(line);
        rendered = rendered.replace(/^######\s+(.*)$/, '<h6>$1</h6>');
        rendered = rendered.replace(/^#####\s+(.*)$/, '<h5>$1</h5>');
        rendered = rendered.replace(/^####\s+(.*)$/, '<h4>$1</h4>');
        rendered = rendered.replace(/^###\s+(.*)$/, '<h3>$1</h3>');
        rendered = rendered.replace(/^##\s+(.*)$/, '<h2>$1</h2>');
        rendered = rendered.replace(/^#\s+(.*)$/, '<h1>$1</h1>');
        rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        rendered = rendered.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return rendered;
      })
      .join('<br/>');
  });
}
