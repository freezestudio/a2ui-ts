import { describe, it, expect } from 'vite-plus/test';
import {
  RpcHandler,
  SurfaceManager,
  registerRendererFunction,
  type OutboundMessage,
} from '@freezestudio/a2ui-web-core';

/**
 * 统一出站一致性（对齐上游 #4078 unifiedOutbound）：
 * action / error / callAgentFunction / rendererFunctionResponse 共用一个监听器；
 * 默认关闭；dispose 后停止转发。
 */

const action = {
  name: 'submit',
  surfaceId: 's1',
  sourceComponentId: 'btn',
  timestamp: '2026-11-14T00:00:00.000Z',
  context: { id: 1 },
};

function setup(unifiedOutbound = true) {
  const received: OutboundMessage[] = [];
  const rpc = new RpcHandler({
    outboundListener: (message) => {
      received.push(message);
    },
  });
  const manager = new SurfaceManager({
    rpcHandler: rpc,
    unifiedOutbound,
    outboundListener: (message) => {
      received.push(message);
    },
  });
  manager.handleCreateSurface('s1');
  return { manager, rpc, received };
}

describe('统一出站一致性（上游 #4078）', () => {
  it('test_unified_outbound_default_off', () => {
    const { manager, received } = setup(false);
    expect(manager.emitAction(action)).toBe(false);
    manager.emitError({ code: 'EXPRESSION_ERROR', surfaceId: 's1', message: 'boom' });
    expect(received).toEqual([]);
  });

  it('test_unified_outbound_action_envelope', () => {
    const { manager, received } = setup();
    expect(manager.emitAction(action)).toBe(true);
    expect(received[0]).toEqual({ version: '1.0', action });
  });

  it('test_unified_outbound_error_envelope', () => {
    const { manager, received } = setup();
    manager.emitError({ code: 'VALIDATION_FAILED', surfaceId: 's1', path: '/components/0', message: 'bad' });
    expect(received[0]).toEqual({
      version: '1.0',
      error: { code: 'VALIDATION_FAILED', surfaceId: 's1', path: '/components/0', message: 'bad' },
    });
  });

  it('test_unified_outbound_renderer_function_response', () => {
    const { manager, received } = setup();
    registerRendererFunction('unified-test-catalog', 'ping', {
      allowedCallers: 'rendererOrAgent',
      execute: () => 'pong',
    });
    manager.handleCallRendererFunction({
      functionCallId: 'f1',
      '@call': 'ping',
      catalogId: 'unified-test-catalog',
    });
    expect(received).toEqual([{ version: '1.0', rendererFunctionResponse: { functionCallId: 'f1', value: 'pong' } }]);
  });

  it('test_unified_outbound_dispose_stops_forwarding', () => {
    const { manager, received } = setup();
    manager.dispose();
    expect(manager.emitAction(action)).toBe(false);
    manager.emitError({ code: 'INTERNAL_ERROR', message: 'x' });
    expect(received).toEqual([]);
  });

  it('test_unified_requires_listener', () => {
    const manager = new SurfaceManager();
    expect(() => manager.setUnifiedOutbound(true)).toThrow(/outboundListener/);
  });
});
