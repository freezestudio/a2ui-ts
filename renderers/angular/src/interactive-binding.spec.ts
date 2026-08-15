import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { TestBed } from '@angular/core/testing';
import { A2UICheckBox } from './basic/check-box.js';
import { A2UISlider } from './basic/slider.js';
import { A2UITextField } from './basic/textfield.js';
import { A2UIRendererService } from './renderer/index.js';
import { CatalogRegistry } from './catalog-registry.js';
import type { A2UIDescriptor, Surface } from './renderer/index.js';

const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/** 交互组件双向绑定：交互后值写回 DataModel（Phase 1 收敛回归） */
describe('交互组件双向绑定', () => {
  let renderer: A2UIRendererService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [A2UICheckBox, A2UISlider, A2UITextField],
      providers: [A2UIRendererService, CatalogRegistry],
    }).compileComponents();
    renderer = TestBed.inject(A2UIRendererService);
    renderer.restore([buildSurface()]);
  });

  function buildSurface(): Surface {
    const components: A2UIDescriptor[] = [
      { id: 'cb', component: 'CheckBox', label: '启用', value: { path: '/settings/enabled' } },
      { id: 'slider', component: 'Slider', label: '阈值', min: 0, max: 100, value: { path: '/settings/threshold' } },
      { id: 'tf', component: 'TextField', label: '备注', value: { path: '/settings/note' } },
    ];
    return {
      surfaceId: 's1',
      catalogId: BASIC_CATALOG_ID,
      components,
      dataModel: { settings: { enabled: false, threshold: 50, note: '' } },
    };
  }

  function comp(id: string): A2UIDescriptor {
    return buildSurface().components.find((c) => c.id === id)!;
  }

  it('CheckBox 交互写回 DataModel', () => {
    const fixture = TestBed.createComponent(A2UICheckBox);
    fixture.componentRef.setInput('component', comp('cb'));
    fixture.componentRef.setInput('surface', buildSurface());
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    input.click();
    fixture.detectChanges();
    const data = renderer.surfaces().get('s1')!.dataModel;
    expect((data['settings'] as Record<string, unknown>)['enabled']).toBe(true);
  });

  it('Slider 交互写回 DataModel', () => {
    const fixture = TestBed.createComponent(A2UISlider);
    fixture.componentRef.setInput('component', comp('slider'));
    fixture.componentRef.setInput('surface', buildSurface());
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="range"]') as HTMLInputElement;
    input.value = '75';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const data = renderer.surfaces().get('s1')!.dataModel;
    expect((data['settings'] as Record<string, unknown>)['threshold']).toBe(75);
  });

  it('TextField 输入写回 DataModel', () => {
    const fixture = TestBed.createComponent(A2UITextField);
    fixture.componentRef.setInput('component', comp('tf'));
    fixture.componentRef.setInput('surface', buildSurface());
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const data = renderer.surfaces().get('s1')!.dataModel;
    expect((data['settings'] as Record<string, unknown>)['note']).toBe('hello');
  });
});
