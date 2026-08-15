import { Component, input } from '@angular/core';

@Component({
  selector: 'a2ui-fallback',
  template: `
    <div class="a2ui-unknown" title="未知组件: {{ type() }}">
      <span class="a2ui-unknown-type">{{ type() }}</span>
      <span class="a2ui-unknown-id">{{ id() }}</span>
    </div>
  `,
})
export class A2UIFallback {
  type = input.required<string>();
  id = input.required<string>();
}
