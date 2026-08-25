import { describe, it, expect } from 'vite-plus/test';
import { Component, input, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { createBoundProperty, setA2uiInputs } from '../testing/test-utils.js';
import type { A2UIDescriptor, Surface } from './public-api.js';

@Component({ template: '' })
class StubCatalogComponent {
  component = input.required<A2UIDescriptor>();
  surface = input.required<Surface>();
  snapshotSurface = input<Surface | null>(null);
}

describe('testing/test-utils（@freezestudio/a2ui-angular/testing）', () => {
  it('createBoundProperty 构造与 ComponentBinder 同构的 mock 绑定', () => {
    const bp = createBoundProperty('hello');
    expect(bp.value()).toBe('hello');
    expect(bp.raw).toBe('hello');
    expect(bp.onUpdate).toBeUndefined();
  });

  it('createBoundProperty 可挂 onUpdate 回写 spy', () => {
    const calls: unknown[] = [];
    const bp = createBoundProperty(42, (v) => calls.push(v));
    bp.onUpdate?.('x');
    expect(calls).toEqual(['x']);
  });

  it('setA2uiInputs 接受真实 A2UIDescriptor/Surface 并设置 inputs', () => {
    const fixture: ComponentFixture<StubCatalogComponent> = TestBed.createComponent(StubCatalogComponent);
    const descriptor: A2UIDescriptor = { id: 't1', component: 'Text', text: '你好' };
    const surface: Surface = { surfaceId: 's1', components: [descriptor], dataModel: {} };
    setA2uiInputs(fixture, descriptor, surface, surface);

    expect(fixture.componentInstance.component().id).toBe('t1');
    expect(fixture.componentInstance.surface().surfaceId).toBe('s1');
    expect(fixture.componentInstance.snapshotSurface()?.surfaceId).toBe('s1');
  });

  it('setA2uiInputs 不传 snapshotSurface 时保持默认（null）', () => {
    const fixture = TestBed.createComponent(StubCatalogComponent);
    const descriptor: A2UIDescriptor = { id: 't1', component: 'Text' };
    const surface: Surface = { surfaceId: 's1', components: [], dataModel: {} };
    setA2uiInputs(fixture, descriptor, surface);

    expect(fixture.componentInstance.snapshotSurface()).toBeNull();
  });

  it('signal 基础可用性冒烟（与工具集同栈）', () => {
    const s = signal(1);
    s.set(2);
    expect(s()).toBe(2);
  });
});
