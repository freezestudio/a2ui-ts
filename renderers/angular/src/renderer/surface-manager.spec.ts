import { describe, it, expect } from 'vite-plus/test';
import { SurfaceManager, findRootComponent, type A2UIDescriptor } from './surface-manager.js';

describe('SurfaceManager', () => {
  it('创建 surface：默认 basic catalog + 可自定义', () => {
    const sm = new SurfaceManager();
    const ok = sm.handleCreateSurface('s1', 'https://custom/catalog');
    expect(ok).toBe(true);
    expect(sm.surfaces().size).toBe(1);
    expect(sm.surfaces().get('s1')?.catalogId).toBe('https://custom/catalog');
  });

  it('重复 surfaceId 不覆盖（返回 false）', () => {
    const sm = new SurfaceManager();
    sm.handleCreateSurface('s1', 'cat-a');
    sm.handleCreateSurface('s1', 'cat-b');
    const surface = sm.surfaces().get('s1')!;
    expect(surface.catalogId).toBe('cat-a');
  });

  describe('handleUpdateComponents 增量合并', () => {
    it('新增组件并保留未变化的组件', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      sm.handleUpdateComponents('s1', [{ id: 'a', component: 'Text' }]);
      sm.handleUpdateComponents('s1', [{ id: 'b', component: 'Button' }]);
      const surface = sm.surfaces().get('s1')!;
      expect(surface.components.map((c) => c.id).sort()).toEqual(['a', 'b']);
    });

    it('跳过未变化的组件（同 id 同属性不重复触发）', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      const comp: A2UIDescriptor = { id: 'a', component: 'Text', text: 'x' };
      sm.handleUpdateComponents('s1', [comp]);
      const first = sm.surfaces().get('s1')!.components[0];
      sm.handleUpdateComponents('s1', [{ ...comp }]);
      const second = sm.surfaces().get('s1')!.components[0];
      expect(first).toBe(second); // 未变化时保留原引用（signal 不重新 emit 相同值）
    });

    it('更新已变化组件的属性', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      sm.handleUpdateComponents('s1', [{ id: 'a', component: 'Text', text: 'x' }]);
      sm.handleUpdateComponents('s1', [{ id: 'a', component: 'Text', text: 'y' }]);
      const comp = sm
        .surfaces()
        .get('s1')!
        .components.find((c) => c.id === 'a')!;
      expect(comp['text']).toBe('y');
    });

    it('surface 不存在时静默忽略', () => {
      const sm = new SurfaceManager();
      expect(() => sm.handleUpdateComponents('nope', [{ id: 'a', component: 'Text' }])).not.toThrow();
      expect(sm.surfaces().size).toBe(0);
    });
  });

  describe('handleUpdateDataModel JSON Pointer', () => {
    it('写入嵌套路径（自动建层）', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      sm.handleUpdateDataModel('s1', '/a/b', 1);
      const model = sm.surfaces().get('s1')!.dataModel;
      expect((model['a'] as Record<string, unknown>)['b']).toBe(1);
    });

    it('value 为 null 时删除路径', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      sm.handleUpdateDataModel('s1', '/x', 5);
      sm.handleUpdateDataModel('s1', '/x', null);
      expect(sm.surfaces().get('s1')!.dataModel['x']).toBeUndefined();
    });

    it('省略 path + value 时整体替换 data model', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1');
      sm.handleUpdateDataModel('s1', '/a', 1);
      sm.handleUpdateDataModel('s1', undefined, { z: 9 });
      expect(sm.surfaces().get('s1')!.dataModel).toEqual({ z: 9 });
    });
  });

  describe('snapshot / restore', () => {
    it('snapshot 深拷贝，restore 重建', () => {
      const sm = new SurfaceManager();
      sm.handleCreateSurface('s1', 'cat-x');
      sm.handleUpdateComponents('s1', [{ id: 'a', component: 'Text' }]);
      sm.handleUpdateDataModel('s1', '/k', 'v');

      const snap = sm.snapshot();
      expect(snap).toHaveLength(1);

      const sm2 = new SurfaceManager();
      sm2.restore(snap);
      expect(sm2.surfaces().get('s1')?.components).toHaveLength(1);
      expect(sm2.surfaces().get('s1')?.dataModel['k']).toBe('v');

      // 快照与原对象隔离（修改新实例不影响旧）
      sm2.handleUpdateDataModel('s1', '/k', 'changed');
      expect(sm.surfaces().get('s1')!.dataModel['k']).toBe('v');
    });
  });

  describe('findRootComponent', () => {
    it('优先匹配 id=root', () => {
      const comps: A2UIDescriptor[] = [
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text' },
      ];
      expect(findRootComponent(comps)?.id).toBe('root');
    });

    it('回退到第一个带 children 的 Column（root id 漂移容错）', () => {
      const comps: A2UIDescriptor[] = [
        { id: 'main-col', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text' },
      ];
      expect(findRootComponent(comps)?.id).toBe('main-col');
    });

    it('找不到返回 null', () => {
      expect(findRootComponent([])).toBeNull();
      expect(findRootComponent([{ id: 'a', component: 'Text' }])).toBeNull();
    });
  });
});
