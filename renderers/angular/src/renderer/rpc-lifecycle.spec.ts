import { describe, it, expect } from 'vite-plus/test';
import { A2UIRendererService } from './index.js';
import { ComponentBinder } from './component-binder.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeRenderer() {
  const renderer = new A2UIRendererService();
  const calls: Array<{ functionCallId: string; callFunction: { '@call': string } }> = [];
  const errors: Array<{ code: string; message: string; surfaceId?: string; functionCallId?: string }> = [];
  renderer.setCallAgentFunctionSender((call) => {
    calls.push(call as never);
  });
  renderer.setErrorSender((error) => {
    errors.push(error);
  });
  const sm = renderer.surfaceManager;
  sm.handleCreateSurface('s1');
  sm.handleUpdateComponents('s1', [
    {
      id: 'stats',
      component: 'StatsSummary',
      action: {
        functionCall: {
          '@call': 'refreshData',
          args: { monitoringType: 'landslide', responsePath: '/refreshed' },
        },
      },
    },
  ]);
  const surface = sm.surfaces().get('s1')!;
  return { renderer, sm, surface, calls, errors };
}

describe('A2UIRendererService — RPC 生命周期', () => {
  it('callAgentFunction 登记 pending，agentFunctionResponse 关联并写回 responsePath', async () => {
    const { renderer, sm, surface, calls } = makeRenderer();
    await renderer.handleComponentAction(surface.components[0], surface);

    expect(calls).toHaveLength(1);
    const functionCallId = calls[0].functionCallId;
    expect(renderer.rpcHandler.pendingCount).toBe(1);

    renderer.processMessage({
      version: '1.0',
      agentFunctionResponse: { functionCallId, value: { ok: true } },
    } as never);
    await flush();

    expect(renderer.rpcHandler.pendingCount).toBe(0);
    expect(sm.surfaces().get('s1')?.dataModel['refreshed']).toEqual({ ok: true });
  });

  it('超时后发出 TIMEOUT 错误，迟到响应被忽略', async () => {
    const { renderer, surface, calls, errors } = makeRenderer();
    await renderer.handleComponentAction(surface.components[0], surface);
    const functionCallId = calls[0].functionCallId;

    renderer.rpcHandler.expire(functionCallId);
    await flush();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'TIMEOUT', functionCallId });
    expect(renderer.rpcHandler.pendingCount).toBe(0);

    renderer.processMessage({
      version: '1.0',
      agentFunctionResponse: { functionCallId, value: 1 },
    } as never);
    expect(errors).toHaveLength(1);
  });

  it('deleteSurface 取消该 surface 的 pending 调用', async () => {
    const { renderer, surface, errors } = makeRenderer();
    await renderer.handleComponentAction(surface.components[0], surface);
    expect(renderer.rpcHandler.pendingCount).toBe(1);

    renderer.processMessage({ version: '1.0', deleteSurface: { surfaceId: 's1' } } as never);
    await flush();

    expect(renderer.rpcHandler.pendingCount).toBe(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'CANCELLED' });
  });

  it('本地 Action 函数执行失败发出 EXECUTION_ERROR，surface 保持挂载', async () => {
    const renderer = new A2UIRendererService();
    const errors: Array<{ code: string; message: string; surfaceId?: string }> = [];
    renderer.setErrorSender((error) => errors.push(error));
    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'btn',
        component: 'Button',
        action: { functionCall: { '@call': 'openUrl', args: { url: 'javascript:alert(1)' } } },
      },
    ]);
    const surface = sm.surfaces().get('s1')!;
    await renderer.handleComponentAction(surface.components[0], surface);
    await flush();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].surfaceId).toBe('s1');
    expect(sm.surfaces().has('s1')).toBe(true);
  });
});

describe('A2UIRendererService — UI 失败恢复（#3856 / #3579）', () => {
  it('绑定求值失败 → EXPRESSION_ERROR，组件与 surface 保持挂载', () => {
    const renderer = new A2UIRendererService();
    const sm = renderer.surfaceManager;
    const errors: Array<{ code: string; surfaceId?: string }> = [];
    sm.core.onError((error) => errors.push(error));
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      { id: 't', component: 'Text', text: { '@call': 'missingFunction', catalogId: 'missing-catalog' } },
    ]);
    const surface = sm.surfaces().get('s1')!;

    const binder = new ComponentBinder();
    const bound = binder.bind(surface.components[0], 's1', sm);

    expect(bound['text'].value()).toBeUndefined();
    expect(errors[0]).toMatchObject({ code: 'EXPRESSION_ERROR', surfaceId: 's1' });
    expect(sm.surfaces().has('s1')).toBe(true);
    expect(sm.surfaces().get('s1')?.components).toHaveLength(1);
  });

  it('@checks 条件求值失败 → 校验失败但不影响兄弟属性', () => {
    const renderer = new A2UIRendererService();
    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'tf',
        component: 'TextField',
        label: 'x',
        value: { '@path': '/x' },
        '@checks': [{ condition: { '@call': 'missingFunction', catalogId: 'missing-catalog' } }],
      },
    ]);
    const surface = sm.surfaces().get('s1')!;

    const binder = new ComponentBinder();
    const bound = binder.bind(surface.components[0], 's1', sm);
    expect(bound['isValid'].value()).toBe(false);
    expect(bound['value'].value()).toBeUndefined();
  });
});
