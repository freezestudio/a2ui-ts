# @freezestudio/a2ui-angular

A2UI v1.0 **Angular 渲染器**：basic catalog 组件（Text/Button/Column/Row/Tabs/...）、渲染适配层（`A2UIRendererService`）、目录注册与组件分发（`CatalogRegistry`）。

## 安装

```bash
npm install @freezestudio/a2ui-angular
```

## 快速使用

```ts
import { Component, inject } from '@angular/core';
import {
  A2UIRendererService,
  A2UISurface,
  CatalogRegistry,
  getBasicComponentRegistrations,
} from '@freezestudio/a2ui-angular';

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

@Component({
  selector: 'app-demo',
  imports: [A2UISurface],
  template: `@for (s of renderer.surfaces().values(); track s.surfaceId) {
    <a2ui-surface [surface]="s" />
  }`,
})
export class DemoComponent {
  renderer = inject(A2UIRendererService);
  registry = inject(CatalogRegistry);

  constructor() {
    this.registry.register(BASIC_CATALOG_ID, getBasicComponentRegistrations());
    this.renderer.processMessages([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'demo',
          catalogId: BASIC_CATALOG_ID,
          components: [
            { id: 'root', component: 'Column', children: ['t1'] },
            { id: 't1', component: 'Text', text: 'Hello A2UI' },
          ],
        },
      },
    ]);
  }
}
```

## 能力

- basic catalog 组件全量注册（`getBasicComponentRegistrations`）
- `A2UIRendererService` — 消息处理、Surface 管理、renderer→agent 事件上报（action/callAgentFunction）
- `CatalogRegistry` — 组件类型动态发现与注册（支持自定义 catalog 扩展）
- 导出模式（`A2UI_EXPORT_MODE`）与快照渲染（报告导出）

## 许可证

Apache-2.0
