import { describe, it, expect } from 'vite-plus/test';
import { resolvePath, setAtPath, deleteAtPath } from './data-binding';
import { getFunctionAllowedCallers, isKnownFunction } from './function-call';
import { A2UIRendererService, type A2UIDescriptor, type Surface } from './index';
import { ComponentBinder } from './component-binder';
import { SurfaceManager } from './surface-manager';

describe('resolvePath — @index 系统函数', () => {
  const dataModel = { list: ['a', 'b', 'c'] };

  it('@index 返回当前索引', () => {
    expect(resolvePath({ path: '@index' }, dataModel, { '@index': 2 })).toBe(2);
  });

  it('@index(offset) 位置参数兼容', () => {
    expect(resolvePath({ path: '@index(1)' }, dataModel, { '@index': 2 })).toBe(3);
  });

  it('@index(offset: 1) v1.0 命名参数语法', () => {
    expect(resolvePath({ path: '@index(offset: 1)' }, dataModel, { '@index': 2 })).toBe(3);
  });

  it('@index(offset: 0) 无偏移', () => {
    expect(resolvePath({ path: '@index(offset: 0)' }, dataModel, { '@index': 2 })).toBe(2);
  });

  it('模板外使用 @index 抛错', () => {
    expect(() => resolvePath({ path: '@index' }, dataModel)).toThrow('ChildList');
    expect(() => resolvePath({ path: '@index(offset: 1)' }, dataModel)).toThrow('ChildList');
  });
});

describe('resolvePath / setAtPath / deleteAtPath — 基础路径', () => {
  it('根路径返回整个数据模型', () => {
    expect(resolvePath({ path: '/' }, { a: 1 })).toEqual({ a: 1 });
  });

  it('嵌套路径查询与 ~1 转义', () => {
    const dm = { sensors: [{ value: 1 }], 'a/b': 2 };
    expect(resolvePath({ path: '/sensors/0/value' }, dm)).toBe(1);
    expect(resolvePath({ path: '/a~1b' }, dm)).toBe(2);
  });

  it('setAtPath 自动创建中间层级', () => {
    const dm: Record<string, unknown> = {};
    setAtPath(dm, '/a/0/b', 1);
    expect(dm).toEqual({ a: [{ b: 1 }] });
  });

  it('deleteAtPath 删除末级键', () => {
    const dm: Record<string, unknown> = { a: { b: 1, c: 2 } };
    deleteAtPath(dm, '/a/b');
    expect(dm).toEqual({ a: { c: 2 } });
  });

  it('禁止危险路径段', () => {
    expect(() => setAtPath({}, '/__proto__/x', 1)).toThrow('Forbidden');
    expect(() => deleteAtPath({}, '/constructor/x')).toThrow('Forbidden');
  });
});

describe('allowedCallers 边界（v1.0）', () => {
  it('openUrl 为 rendererOnly（未声明 allowedCallers，按规范缺省 rendererOnly）', () => {
    expect(getFunctionAllowedCallers('openUrl')).toBe('rendererOnly');
  });

  it('已注册函数默认 rendererOnly', () => {
    expect(getFunctionAllowedCallers('required')).toBe('rendererOnly');
    expect(getFunctionAllowedCallers('formatNumber')).toBe('rendererOnly');
  });

  it('@index 系统函数仅渲染端可用', () => {
    expect(getFunctionAllowedCallers('@index')).toBe('rendererOnly');
  });

  it('未注册函数返回 undefined', () => {
    expect(getFunctionAllowedCallers('notRegisteredFn')).toBeUndefined();
    expect(isKnownFunction('notRegisteredFn')).toBe(false);
    expect(isKnownFunction('email')).toBe(true);
  });
});

describe('resolveComponentProp — DataBinding 支持（v1.0 dataModel 外置）', () => {
  const renderer = new A2UIRendererService();
  const surface: Surface = {
    surfaceId: 'main',
    catalogId: 'basic',
    components: [],
    dataModel: { components: { 'chart-x': { series: [{ name: 'a', data: [1, 2] }] } } },
  };

  it('静态数组原样返回', () => {
    const comp: A2UIDescriptor = {
      id: 'chart-x',
      component: 'Chart',
      series: [{ name: 'a', data: [1] }],
    };
    expect(renderer.resolveComponentProp(comp, surface, 'series')).toEqual([{ name: 'a', data: [1] }]);
  });

  it('DataBinding 引用解析到 dataModel', () => {
    const comp: A2UIDescriptor = {
      id: 'chart-x',
      component: 'Chart',
      series: { path: '/components/chart-x/series' },
    };
    expect(renderer.resolveComponentProp(comp, surface, 'series')).toEqual([{ name: 'a', data: [1, 2] }]);
  });

  it('FunctionCall 属性解析', () => {
    const comp: A2UIDescriptor = {
      id: 'chart-x',
      component: 'Chart',
      title: {
        call: 'capitalize',
        catalogId: 'https://freezestudio.dev/a2ui/v1.0/catalogs/extended.json',
        args: { value: 'hello' },
      },
    };
    expect(renderer.resolveComponentProp(comp, surface, 'title')).toBe('Hello');
  });

  it('缺失字段返回 undefined', () => {
    const comp: A2UIDescriptor = { id: 'chart-x', component: 'Chart' };
    expect(renderer.resolveComponentProp(comp, surface, 'nope')).toBeUndefined();
  });
});

describe('响应式 dataModel 绑定（updateDataModel 驱动 UI 更新）', () => {
  const binder = new ComponentBinder();

  it('updateDataModel 到达后，DataBinding 绑定的值自动更新', () => {
    const sm = new SurfaceManager();
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [{ id: 'chart-x', component: 'MultiSensorChart', series: { path: '/series' } }]);
    sm.handleUpdateDataModel('s1', '/series', [{ name: 'a', data: [1, 2] }]);

    const surface = sm.surfaces().get('s1')!;
    const comp = surface.components[0];
    const bound = binder.bind(comp, 's1', sm);
    expect(bound['series'].value()).toEqual([{ name: 'a', data: [1, 2] }]);

    // 增量数据更新：updateDataModel 重写 dataModel → 绑定值随之更新
    sm.handleUpdateDataModel('s1', '/series', [{ name: 'a', data: [3, 4, 5] }]);
    expect(bound['series'].value()).toEqual([{ name: 'a', data: [3, 4, 5] }]);
  });

  it('静态内嵌属性经绑定原样返回（行为不变）', () => {
    const sm = new SurfaceManager();
    sm.handleCreateSurface('s2');
    sm.handleUpdateComponents('s2', [
      { id: 'chart-x', component: 'MultiSensorChart', series: [{ name: 'a', data: [1] }] },
    ]);
    const surface = sm.surfaces().get('s2')!;
    const comp = surface.components[0];
    const bound = binder.bind(comp, 's2', sm);
    expect(bound['series'].value()).toEqual([{ name: 'a', data: [1] }]);
  });

  it('updateDataModel 更新标量字段同样响应', () => {
    const sm = new SurfaceManager();
    sm.handleCreateSurface('s3');
    sm.handleUpdateComponents('s3', [{ id: 'g', component: 'GaugeChart', value: { path: '/value' } }]);
    sm.handleUpdateDataModel('s3', '/value', 42);

    const surface = sm.surfaces().get('s3')!;
    const comp = surface.components[0];
    const bound = binder.bind(comp, 's3', sm);
    expect(bound['value'].value()).toBe(42);

    sm.handleUpdateDataModel('s3', '/value', 77);
    expect(bound['value'].value()).toBe(77);
  });
});

describe('handleComponentAction（v1.0 #2210 callAgentFunction → agentFunctionResponse → dataModel 闭环）', () => {
  it('agent 端函数：发送 callAgentFunction，不自动写回 responsePath', async () => {
    const renderer = new A2UIRendererService();
    let sent: { callFunction?: { call?: string; catalogId?: string; args?: Record<string, unknown> } } | null = null;
    renderer.setCallAgentFunctionSender((call) => {
      sent = call;
      return undefined;
    });

    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'stats-summary',
        component: 'StatsSummary',
        stats: { path: '/components/stats-summary/stats' },
        action: {
          functionCall: {
            call: 'refreshData',
            args: { monitoringType: 'landslide' },
          },
        },
      },
    ]);
    sm.handleUpdateDataModel('s1', '/components/stats-summary', { stats: [] });

    const surface = sm.surfaces().get('s1')!;
    const comp = surface.components[0];
    await renderer.handleComponentAction(comp, surface);

    expect((sent as unknown as { callFunction?: { call?: string } }).callFunction?.call).toBe('refreshData');
    const dm = sm.surfaces().get('s1')!.dataModel;
    expect(dm['components']).toEqual({ 'stats-summary': { stats: [] } });
  });

  it('本地已注册函数：本地执行，不发送 callAgentFunction', async () => {
    const renderer = new A2UIRendererService();
    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'btn',
        component: 'Button',
        action: { functionCall: { call: 'capitalize', args: { value: 'abc' } } },
      },
    ]);
    const surface = sm.surfaces().get('s1')!;
    const comp = surface.components[0];
    // 本地函数不触发 callAgentFunction（无发送器报错即通过）
    await expect(renderer.handleComponentAction(comp, surface)).resolves.toBeUndefined();
  });

  it('action.event：userMessage 随 action 上报（v1.0 #2228）', async () => {
    const renderer = new A2UIRendererService();
    let sent: { name?: string; userMessage?: string; surfaceId?: string; context?: Record<string, unknown> } | null =
      null;
    renderer.setActionSender((action) => {
      sent = action;
      return undefined;
    });

    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'risk-panel',
        component: 'RiskPanel',
        action: {
          event: {
            name: 'requestDetailedAnalysis',
            userMessage: '用户请求对「滑坡」进行详细风险分析',
            context: { monitoringType: 'landslide' },
          },
        },
      },
    ]);
    const surface = sm.surfaces().get('s1')!;
    const comp = surface.components[0];
    await renderer.handleComponentAction(comp, surface);

    expect(sent).not.toBeNull();
    expect(sent!.name).toBe('requestDetailedAnalysis');
    expect(sent!.userMessage).toBe('用户请求对「滑坡」进行详细风险分析');
    expect(sent!.surfaceId).toBe('s1');
    expect(sent!.context).toEqual({ monitoringType: 'landslide' });
  });

  it('未声明 action 时静默返回', async () => {
    const renderer = new A2UIRendererService();
    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s2');
    sm.handleUpdateComponents('s2', [{ id: 'x', component: 'Text' }]);
    const surface = sm.surfaces().get('s2')!;
    await expect(renderer.handleComponentAction(surface.components[0], surface)).resolves.toBeUndefined();
  });
});
