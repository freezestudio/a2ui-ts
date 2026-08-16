import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { A2UIComponent } from './component.js';
import { A2UIRendererService } from './renderer/index.js';
import { CatalogRegistry } from './catalog-registry.js';
import { getBasicComponentRegistrations } from './component-type-map.js';
import type { A2UIDescriptor, Surface } from './renderer/index.js';

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

describe('Catalog 渲染路径（Phase 1 收敛）', () => {
  let registry: CatalogRegistry;
  let renderer: A2UIRendererService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [A2UIComponent],
      providers: [A2UIRendererService, CatalogRegistry],
    }).compileComponents();
    registry = TestBed.inject(CatalogRegistry);
    renderer = TestBed.inject(A2UIRendererService);
    registry.register(BASIC_CATALOG_ID, getBasicComponentRegistrations());
  });

  function buildSurface(): Surface {
    const components: A2UIDescriptor[] = [
      { id: 'root', component: 'Column', children: ['text-1', 'image-1'] },
      { id: 'text-1', component: 'Text', text: '你好世界' },
      { id: 'image-1', component: 'Image', url: 'https://example.com/a.png', description: '示例图片' },
    ];
    return { surfaceId: 's1', catalogId: BASIC_CATALOG_ID, components, dataModel: {} };
  }

  async function renderComponent(id: string): Promise<ComponentFixture<A2UIComponent>> {
    renderer.restore([buildSurface()]);
    const fixture = TestBed.createComponent(A2UIComponent);
    fixture.componentRef.setInput(
      'component',
      buildSurface().components.find((c) => c.id === id),
    );
    fixture.componentRef.setInput('surface', buildSurface());
    fixture.detectChanges();
    return fixture;
  }

  it('Text 组件经 basic catalog 渲染正常（回归：NG0303）', async () => {
    const fixture = await renderComponent('text-1');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.a2ui-text-body')).toBeTruthy();
    expect(el.textContent).toContain('你好世界');
  });

  it('Image 组件经 basic catalog 渲染正常（回归：NG0303）', async () => {
    const fixture = await renderComponent('image-1');
    const el: HTMLElement = fixture.nativeElement;
    const img = el.querySelector('img.a2ui-image');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png');
    expect(img?.getAttribute('alt')).toBe('示例图片');
  });

  it('全部 18 个 basic 组件均已注册（CatalogRegistry）', () => {
    const registered = registry.getComponents(BASIC_CATALOG_ID).map((r) => r.type);
    const expected = [
      'Text',
      'Button',
      'Image',
      'Column',
      'Row',
      'Card',
      'TextField',
      'Divider',
      'Icon',
      'Video',
      'AudioPlayer',
      'CheckBox',
      'Slider',
      'List',
      'Tabs',
      'Modal',
      'ChoicePicker',
      'DateTimeInput',
    ];
    for (const type of expected) {
      expect(registered).toContain(type);
    }
  });

  it('未知组件渲染 fallback 而非崩溃', async () => {
    const surface = buildSurface();
    surface.components.push({ id: 'unknown-1', component: 'UnknownWidget' });
    renderer.restore([surface]);
    const fixture = TestBed.createComponent(A2UIComponent);
    fixture.componentRef.setInput('component', { id: 'unknown-1', component: 'UnknownWidget' });
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('a2ui-fallback')).toBeTruthy();
  });

  it('geo surface + basic 布局组件（Column）经 basic 兜底渲染', async () => {
    const GEO_CATALOG_ID = 'https://geo-system.com/a2ui/v1.0/geo-sensor-catalog';
    const components: A2UIDescriptor[] = [
      { id: 'root', component: 'Column', children: ['text-1'] },
      { id: 'text-1', component: 'Text', text: 'geo surface 内嵌 basic 布局' },
    ];
    const surface: Surface = { surfaceId: 'geo-s1', catalogId: GEO_CATALOG_ID, components, dataModel: {} };
    renderer.restore([surface]);
    const fixture = TestBed.createComponent(A2UIComponent);
    fixture.componentRef.setInput('component', components[0]);
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // v1.0 禁止 basic 兜底；geo catalog 未注册 Column，应渲染 fallback
    expect(el.querySelector('a2ui-fallback')).toBeTruthy();
  });
});
