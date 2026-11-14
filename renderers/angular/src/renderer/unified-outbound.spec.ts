import { describe, it, expect } from 'vite-plus/test';
import { A2UIRendererService } from './index.js';
import { registerRendererFunction, type OutboundMessage } from '@freezestudio/a2ui-web-core';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('A2UIRendererService — unifiedOutbound（#4078）', () => {
  it('默认关闭：action 走旧版 sender', () => {
    const renderer = new A2UIRendererService();
    const legacy: unknown[] = [];
    renderer.setActionSender((action) => {
      legacy.push(action);
    });
    renderer.sendAction({
      name: 'submit',
      surfaceId: 's1',
      sourceComponentId: 'btn',
      context: {},
    });
    expect(legacy).toHaveLength(1);
  });

  it('开启后 action 走统一 outboundListener', () => {
    const renderer = new A2UIRendererService();
    const sent: OutboundMessage[] = [];
    const legacy: unknown[] = [];
    renderer.setActionSender((action) => {
      legacy.push(action);
    });
    renderer.setOutboundListener((message) => {
      sent.push(message);
    });
    renderer.setUnifiedOutbound(true);

    renderer.sendAction({
      name: 'submit',
      surfaceId: 's1',
      sourceComponentId: 'btn',
      context: { id: 1 },
    });

    expect(legacy).toHaveLength(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      version: '1.0',
      action: { name: 'submit', surfaceId: 's1', sourceComponentId: 'btn', context: { id: 1 } },
    });
  });

  it('错误统一出站（本地函数执行失败）', async () => {
    const renderer = new A2UIRendererService();
    const sent: OutboundMessage[] = [];
    renderer.setOutboundListener((message) => {
      sent.push(message);
    });
    renderer.setUnifiedOutbound(true);

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

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ version: '1.0', error: { surfaceId: 's1' } });
  });

  it('callAgentFunction 与 rendererFunctionResponse 统一出站', async () => {
    const renderer = new A2UIRendererService();
    const sent: OutboundMessage[] = [];
    renderer.setOutboundListener((message) => {
      sent.push(message);
    });
    renderer.setUnifiedOutbound(true);

    const sm = renderer.surfaceManager;
    sm.handleCreateSurface('s1');
    sm.handleUpdateComponents('s1', [
      {
        id: 'stats',
        component: 'StatsSummary',
        action: { functionCall: { '@call': 'refreshData', args: {} } },
      },
    ]);
    await renderer.handleComponentAction(sm.surfaces().get('s1')!.components[0], sm.surfaces().get('s1')!);
    expect(sent[0]).toMatchObject({ version: '1.0', callAgentFunction: { surfaceId: 's1' } });

    registerRendererFunction('test-unified-catalog', 'ping', {
      allowedCallers: 'rendererOrAgent',
      execute: () => 'pong',
    });
    renderer.processMessage({
      version: '1.0',
      callRendererFunction: {
        functionCallId: 'f1',
        callFunction: { '@call': 'ping', catalogId: 'test-unified-catalog' },
      },
    } as never);
    await flush();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      version: '1.0',
      rendererFunctionResponse: { functionCallId: 'f1', value: 'pong' },
    });
  });

  it('未注册 outboundListener 时开启 unifiedOutbound 抛错', () => {
    const renderer = new A2UIRendererService();
    expect(() => renderer.setUnifiedOutbound(true)).toThrow(/outboundListener/);
  });

  it('关闭统一出站后恢复旧版 sender', () => {
    const renderer = new A2UIRendererService();
    const sent: OutboundMessage[] = [];
    const legacy: unknown[] = [];
    renderer.setOutboundListener((message) => {
      sent.push(message);
    });
    renderer.setUnifiedOutbound(true);
    renderer.setActionSender((action) => {
      legacy.push(action);
    });

    renderer.setUnifiedOutbound(false);
    renderer.sendAction({ name: 'x', surfaceId: 's1', sourceComponentId: 'c', context: {} });

    expect(sent).toHaveLength(0);
    expect(legacy).toHaveLength(1);
  });
});
