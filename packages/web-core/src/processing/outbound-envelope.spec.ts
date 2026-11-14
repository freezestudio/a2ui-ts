import { describe, it, expect } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { SurfaceManager } from '../state/surface-manager.js';
import { toOutboundActionMessage, toOutboundFunctionResponse, type OutboundMessage } from './outbound-envelope.js';
import { A2uiClientActionMessageSchema } from '../schema/schemas.js';

const action = {
  name: 'submit',
  surfaceId: 's1',
  sourceComponentId: 'btn',
  timestamp: '2026-11-14T00:00:00.000Z',
  context: { id: 1 },
};

describe('toOutboundActionMessage / toOutboundFunctionResponse', () => {
  it('action 信封符合 renderer_to_agent schema', () => {
    const message = toOutboundActionMessage(action);
    expect(message.version).toBe('1.0');
    assert.equal(A2uiClientActionMessageSchema.safeParse(message).success, true);
  });

  it('rendererFunctionResponse 信封结构', () => {
    expect(toOutboundFunctionResponse({ functionCallId: 'c1', value: 1 })).toEqual({
      version: '1.0',
      rendererFunctionResponse: { functionCallId: 'c1', value: 1 },
    });
  });
});

describe('SurfaceManager — unifiedOutbound（#4078）', () => {
  it('默认关闭：emitAction 返回 false 且不调用监听器', () => {
    const received: OutboundMessage[] = [];
    const manager = new SurfaceManager({
      outboundListener: (m) => {
        received.push(m);
      },
    });
    expect(manager.emitAction(action)).toBe(false);
    expect(received).toEqual([]);
  });

  it('开启后 action 与 error 统一出站', () => {
    const received: OutboundMessage[] = [];
    const manager = new SurfaceManager({
      outboundListener: (m) => {
        received.push(m);
      },
    });
    manager.setUnifiedOutbound(true);

    expect(manager.emitAction(action)).toBe(true);
    manager.emitError({ code: 'EXPRESSION_ERROR', surfaceId: 's1', message: 'boom' });

    expect(received).toEqual([
      { version: '1.0', action },
      { version: '1.0', error: { code: 'EXPRESSION_ERROR', surfaceId: 's1', message: 'boom' } },
    ]);
  });

  it('无监听器时开启 unifiedOutbound 抛错', () => {
    const manager = new SurfaceManager();
    expect(() => manager.setUnifiedOutbound(true)).toThrow(/outboundListener/);
  });

  it('dispose 后停止出站', () => {
    const received: OutboundMessage[] = [];
    const manager = new SurfaceManager({
      outboundListener: (m) => {
        received.push(m);
      },
      unifiedOutbound: true,
    });
    manager.dispose();
    expect(manager.emitAction(action)).toBe(false);
    manager.emitError({ code: 'INTERNAL_ERROR', message: 'x' });
    expect(received).toEqual([]);
  });

  it('监听器抛出异常时不影响 emitAction/emitError 返回值', () => {
    const manager = new SurfaceManager({
      outboundListener: () => {
        throw new Error('transport down');
      },
      unifiedOutbound: true,
    });
    expect(manager.emitAction(action)).toBe(true);
    expect(() => manager.emitError({ code: 'INTERNAL_ERROR', message: 'x' })).not.toThrow();
  });
});
