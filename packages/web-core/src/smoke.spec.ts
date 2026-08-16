import { describe, expect, it } from 'vite-plus/test';
import { SurfaceManager, findRootComponent } from './state/surface-manager.js';
import { resolveDynamicValue, callFunction } from './processing/function-call.js';
import { setAtPath, deleteAtPath } from './processing/data-binding.js';

describe('SurfaceManager 生命周期', () => {
  it('创建 → 更新组件 → 更新数据 → 删除 全链路', () => {
    const manager = new SurfaceManager();

    expect(manager.handleCreateSurface('s1', 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json')).toBe(
      true,
    );
    // 重复 surfaceId 应拒绝
    expect(manager.handleCreateSurface('s1')).toBe(false);

    manager.handleUpdateComponents('s1', [{ id: 'root', component: 'Column', children: ['t1'] }]);
    manager.handleUpdateComponents('s1', [
      { id: 'root', component: 'Column', children: ['t1'] },
      { id: 't1', component: 'Text', value: '你好' },
    ]);

    manager.handleUpdateDataModel('s1', '/risk/level', 3);
    manager.handleUpdateDataModel('s1', '/risk/score', 87.5);

    const surface = manager.surfaces.value.get('s1')!;
    expect(surface.components).toHaveLength(2);
    expect(findRootComponent(surface.components)?.id).toBe('root');
    expect(surface.dataModel['risk']).toEqual({ level: 3, score: 87.5 });

    // 删除不存在的 surface 不应抛错
    manager.handleDeleteSurface('nope');
    manager.handleDeleteSurface('s1');
    expect(manager.surfaces.value.size).toBe(0);
  });

  it('snapshot / restore 深拷贝隔离', () => {
    const manager = new SurfaceManager();
    manager.handleCreateSurface('s1');
    manager.handleUpdateComponents('s1', [{ id: 'root', component: 'Column' }]);
    manager.handleUpdateDataModel('s1', '/x', { a: 1 });

    const snap = manager.snapshot();
    snap[0]!.dataModel['x'] = { hacked: true };

    const restored = new SurfaceManager();
    restored.restore(snap);
    expect(restored.surfaces.value.get('s1')!.dataModel['x']).toEqual({ hacked: true });
    // 原 manager 不受影响
    expect(manager.surfaces.value.get('s1')!.dataModel['x']).toEqual({ a: 1 });
  });
});

describe('数据绑定与函数调用', () => {
  it('resolveDynamicValue 解析嵌套 data binding + function call', () => {
    const dataModel = { sensor: { displacement: 12.345 } };
    expect(resolveDynamicValue({ path: 'sensor/displacement' }, dataModel)).toBe(12.345);
    expect(
      resolveDynamicValue(
        { call: 'formatNumber', args: { value: { path: 'sensor/displacement' }, decimals: 2 } },
        dataModel,
      ),
    ).toBe('12.35');
  });

  it('setAtPath / deleteAtPath 安全操作数据模型', () => {
    const dataModel: Record<string, unknown> = {};
    setAtPath(dataModel, '/a/b', 1);
    expect(dataModel['a']).toEqual({ b: 1 });
    deleteAtPath(dataModel, '/a/b');
    expect(dataModel['a']).toEqual({});
  });

  it('rendererOnly 函数不允许 agent 远程调用', () => {
    expect(() => callFunction({ call: '@index', args: {} }, {}, 0, { caller: 'agent' })).toThrow('不允许 agent 调用');
  });

  it('handleCallRendererFunction 对 rendererOnly 函数返回 INVALID_FUNCTION_CALL', () => {
    const manager = new SurfaceManager();
    const responses: Array<{ error?: { code?: string } }> = [];
    manager.handleCallRendererFunction(
      {
        functionCallId: 'f1',
        call: 'capitalize',
        catalogId: 'https://freezestudio.dev/a2ui/v1.0/catalogs/extended.json',
        args: { value: 'abc' },
      },
      (r) => responses.push(r),
    );
    expect(responses[0]?.error?.code).toBe('INVALID_FUNCTION_CALL');
  });
});
