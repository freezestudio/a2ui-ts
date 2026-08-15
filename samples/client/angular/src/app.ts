import { Component, inject } from '@angular/core';
import { A2UIRendererService, A2UISurface, CatalogRegistry, getBasicComponentRegistrations } from '@freezestudio/a2ui-angular';

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/**
 * A2UI v1.0 Angular 渲染器演示应用
 *
 * 演示：通过 A2UI createSurface 消息声明界面（Column/Text/Button），
 * 由 @freezestudio/a2ui-angular 渲染器 + basic catalog 组件渲染；按钮触发 renderer→agent action。
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [A2UISurface],
  template: `
    <div class="demo-shell">
      <h1>A2UI v1.0 Angular Renderer Demo</h1>
      <div class="demo-panel">
        @for (surface of surfaces().values(); track surface.surfaceId) {
          <a2ui-surface [surface]="surface" />
        }
      </div>
    </div>
  `,
})
export class DemoApp {
  private renderer = inject(A2UIRendererService);
  private registry = inject(CatalogRegistry);

  surfaces = this.renderer.surfaces;

  constructor() {
    // 注册 basic catalog 组件（Text/Button/Column/Row/...）
    this.registry.register(BASIC_CATALOG_ID, getBasicComponentRegistrations());

    // renderer→agent action 上报（演示：输出到控制台）
    this.renderer.setActionSender((action) => {
      console.log('[demo] renderer→agent action:', action.name, '| userMessage:', action.userMessage);
      return undefined;
    });

    // 声明式生成演示界面
    this.renderer.processMessages([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'demo',
          catalogId: BASIC_CATALOG_ID,
          components: [
            { id: 'root', component: 'Column', children: ['title', 'body', 'btn'] },
            { id: 'title', component: 'Text', text: 'A2UI v1.0 Angular 渲染器演示', variant: 'caption' },
            { id: 'body', component: 'Text', text: '本界面由 @freezestudio/a2ui-angular 渲染器驱动，组件由 A2UI 消息声明。' },
            {
              id: 'btn',
              component: 'Button',
              child: 'btn-label',
              action: { event: { name: 'demoAction', userMessage: '用户点击了演示按钮' } },
            },
            { id: 'btn-label', component: 'Text', text: '点我触发 renderer→agent action' },
          ],
        },
      },
    ]);
  }
}
