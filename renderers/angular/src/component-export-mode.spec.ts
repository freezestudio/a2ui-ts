import { describe, it, expect } from 'vite-plus/test';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { A2UIComponent } from './component.js';
import { A2UIRendererService } from './renderer/index.js';
import { A2UI_EXPORT_MODE } from './export-mode.js';
import { CatalogRegistry } from './catalog-registry.js';
import { getBasicComponentRegistrations } from './component-type-map.js';
import type { A2UIDescriptor, Surface } from './renderer/index.js';

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/** 测试 surface：Tabs（3 面板）+ Modal（trigger + content） */
function buildSurface(): Surface {
  const components: A2UIDescriptor[] = [
    {
      id: 'tabs',
      component: 'Tabs',
      tabs: [
        { title: '风险预测', child: 'panel-1' },
        { title: '倾角预测', child: 'panel-2' },
        { title: '加速度预测', child: 'panel-3' },
      ],
    },
    { id: 'panel-1', component: 'Text', text: '面板一内容' },
    { id: 'panel-2', component: 'Text', text: '面板二内容' },
    { id: 'panel-3', component: 'Text', text: '面板三内容' },
    { id: 'modal', component: 'Modal', trigger: 'modal-trigger', content: 'modal-content' },
    { id: 'modal-trigger', component: 'Button', child: 'modal-trigger-text' },
    { id: 'modal-trigger-text', component: 'Text', text: '打开弹窗' },
    { id: 'modal-content', component: 'Text', text: '模态内容正文' },
  ];
  return { surfaceId: 'surface-1', catalogId: BASIC_CATALOG_ID, components, dataModel: {} };
}

async function createFixture(componentId: string, exportMode: boolean): Promise<ComponentFixture<A2UIComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [A2UIComponent],
    providers: [A2UIRendererService, CatalogRegistry, { provide: A2UI_EXPORT_MODE, useValue: exportMode }],
  }).compileComponents();
  const registry = TestBed.inject(CatalogRegistry);
  registry.register(BASIC_CATALOG_ID, getBasicComponentRegistrations());
  const renderer = TestBed.inject(A2UIRendererService);
  renderer.restore([buildSurface()]);
  const fixture = TestBed.createComponent(A2UIComponent);
  fixture.componentRef.setInput(
    'component',
    buildSurface().components.find((c) => c.id === componentId),
  );
  fixture.componentRef.setInput('surface', buildSurface());
  fixture.detectChanges();
  return fixture;
}

describe('A2UIComponent 导出模式（A2UI_EXPORT_MODE）', () => {
  describe('Tabs', () => {
    it('默认模式：只渲染激活面板（tabs[0]），有 tab 头按钮', async () => {
      const fixture = await createFixture('tabs', false);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('.a2ui-tab-button').length).toBe(3);
      expect(el.textContent).toContain('面板一内容');
      expect(el.textContent).not.toContain('面板二内容');
      expect(el.textContent).not.toContain('面板三内容');
    });

    it('导出模式：无 tab 头，顺序展开全部面板', async () => {
      const fixture = await createFixture('tabs', true);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('.a2ui-tab-button').length).toBe(0);
      expect(el.textContent).toContain('面板一内容');
      expect(el.textContent).toContain('面板二内容');
      expect(el.textContent).toContain('面板三内容');
    });
  });

  describe('Modal', () => {
    it('默认模式：不渲染模态内容（关闭态），有 trigger', async () => {
      const fixture = await createFixture('modal', false);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).not.toContain('模态内容正文');
      expect(el.querySelector('.a2ui-modal-trigger')).toBeTruthy();
    });

    it('导出模式：跳过 trigger/overlay，直接渲染模态内容', async () => {
      const fixture = await createFixture('modal', true);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('模态内容正文');
      expect(el.querySelector('.a2ui-modal-trigger')).toBeNull();
      expect(el.querySelector('.a2ui-modal-overlay')).toBeNull();
      expect(el.querySelector('.a2ui-modal-content-export')).toBeTruthy();
    });
  });
});
