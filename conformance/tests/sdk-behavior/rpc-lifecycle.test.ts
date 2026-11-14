import { describe, it, expect } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  A2uiRpcError,
  RpcErrorCode,
  RpcHandler,
  SurfaceManager,
  mapErrorToRendererMessage,
  processMessagesWithErrors,
} from '@freezestudio/a2ui-web-core';
import type { CallAgentFunctionEnvelope } from '@freezestudio/a2ui-web-core';

/**
 * RPC 生命周期一致性（对齐上游 conformance/core/rpc_functions.yaml，
 * #3856：correlate pending / cancelled / disposed / no_listener /
 * late response after timeout / late response after dispose）。
 */

const call = { '@call': 'refreshData', catalogId: 'geo', args: {} };

function setup(options?: { maxPendingCalls?: number; timeoutMs?: number }) {
  const sent: CallAgentFunctionEnvelope[] = [];
  const rpc = new RpcHandler({
    outboundListener: (message) => {
      sent.push(message);
    },
    ...(options?.maxPendingCalls !== undefined ? { maxPendingCalls: options.maxPendingCalls } : {}),
    ...(options?.timeoutMs !== undefined ? { defaultTimeoutMs: options.timeoutMs } : {}),
  });
  const manager = new SurfaceManager({ rpcHandler: rpc });
  manager.handleCreateSurface('s1');
  return { rpc, manager, sent };
}

describe('RPC 生命周期一致性（上游 #3856）', () => {
  it('test_rpc_agent_function_response_correlates_pending_call', async () => {
    const { rpc, manager } = setup();
    const pending = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    expect(rpc.pendingCount).toBe(1);
    expect(manager.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 7 } })).toBe(
      true,
    );
    assert.equal(await pending, 7);
  });

  it('test_rpc_call_agent_function_cancelled', async () => {
    const { rpc, manager } = setup();
    const pending = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    expect(manager.handleDeleteSurface('s1')).toBe(true);
    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
    expect(rpc.pendingCount).toBe(0);
  });

  it('test_rpc_call_agent_function_disposed', async () => {
    const { rpc, manager } = setup();
    const pending = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    rpc.dispose('test');
    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
    await assert.rejects(manager.callAgentFunction('s1', call), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.DISPOSED);
      return true;
    });
  });

  it('test_rpc_call_agent_function_no_listener', async () => {
    const handler = new RpcHandler();
    await assert.rejects(handler.callAgentFunction('s1', call), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.NO_LISTENER);
      return true;
    });
  });

  it('test_rpc_call_agent_function_late_response_after_timeout_ignored', async () => {
    const { rpc } = setup({ timeoutMs: 5 });
    const pending = rpc.callAgentFunction('s1', call, { functionCallId: 'c1' });
    await assert.rejects(pending);
    expect(rpc.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(false);
  });

  it('test_rpc_call_agent_function_late_response_after_dispose_ignored', () => {
    const { rpc, manager } = setup();
    void manager.callAgentFunction('s1', call, { functionCallId: 'c1' }).catch(() => {});
    rpc.dispose();
    expect(manager.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(
      false,
    );
  });

  it('test_rpc_call_agent_function_too_many_pending', async () => {
    const { rpc } = setup({ maxPendingCalls: 1 });
    const first = rpc.callAgentFunction('s1', call, { functionCallId: 'c1' });
    await assert.rejects(rpc.callAgentFunction('s1', call, { functionCallId: 'c2' }), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.TOO_MANY_PENDING);
      return true;
    });
    rpc.cancelAll();
    await assert.rejects(first);
  });

  it('test_renderer_error_mapping_json_pointer', () => {
    const mapped = mapErrorToRendererMessage(new A2uiRpcError('bad call', RpcErrorCode.INVALID_FUNCTION_CALL, 'c1'), {
      actionType: 'callRendererFunction',
    });
    expect(mapped).toEqual({
      version: '1.0',
      error: { code: 'INVALID_FUNCTION_CALL', functionCallId: 'c1', message: 'bad call' },
    });
  });

  it('test_process_messages_with_errors_does_not_throw', () => {
    const { manager } = setup();
    manager.handleCreateSurface = () => {
      throw new Error('boom');
    };
    const errors = processMessagesWithErrors([{ version: '1.0', createSurface: { surfaceId: 's2' } }], manager);
    expect(errors).toHaveLength(1);
    expect(errors[0].error.error.code).toBe('INTERNAL_ERROR');
  });
});
