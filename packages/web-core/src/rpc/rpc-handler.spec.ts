import { describe, it, expect } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { RpcHandler, type CallAgentFunctionEnvelope } from './rpc-handler.js';
import { A2uiRpcError, RpcErrorCode } from '../common/errors.js';

const call = { '@call': 'refreshData', catalogId: 'geo', args: { id: 1 } };

function makeHandler(options?: ConstructorParameters<typeof RpcHandler>[0]) {
  const sent: CallAgentFunctionEnvelope[] = [];
  const handler = new RpcHandler({
    outboundListener: (message) => {
      sent.push(message);
    },
    ...options,
  });
  return { handler, sent };
}

describe('RpcHandler — callAgentFunction 生命周期', () => {
  it('发送 v1.0 信封并登记 pending', async () => {
    const { handler, sent } = makeHandler();
    const promise = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    expect(handler.pendingCount).toBe(1);
    expect(sent).toEqual([
      {
        version: '1.0',
        callAgentFunction: { surfaceId: 's1', functionCallId: 'c1', callFunction: call },
      },
    ]);
    handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 42 } });
    assert.equal(await promise, 42);
  });

  it('agentFunctionResponse.error 拒绝并保留错误码', async () => {
    const { handler } = makeHandler();
    const promise = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    handler.handleAgentFunctionResponse({
      agentFunctionResponse: { functionCallId: 'c1', error: { code: 'FAILED', message: 'boom' } },
    });
    await assert.rejects(promise, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, 'FAILED');
      assert.equal(err.functionCallId, 'c1');
      return true;
    });
  });

  it('未知/迟到 functionCallId 被忽略', () => {
    const { handler } = makeHandler();
    expect(handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'ghost', value: 1 } })).toBe(
      false,
    );
  });

  it('重复 functionCallId 拒绝', async () => {
    const { handler } = makeHandler();
    const pending = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    await assert.rejects(handler.callAgentFunction('s1', call, { functionCallId: 'c1' }), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.DUPLICATE);
      return true;
    });
    handler.dispose();
    await assert.rejects(pending);
  });

  it('未设置 outboundListener 时 NO_LISTENER', async () => {
    const handler = new RpcHandler();
    await assert.rejects(handler.callAgentFunction('s1', call), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.NO_LISTENER);
      return true;
    });
  });

  it('cancelSurfaceCalls 只取消该 surface 的调用', async () => {
    const { handler } = makeHandler();
    const p1 = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    const p2 = handler.callAgentFunction('s2', call, { functionCallId: 'c2' });
    expect(handler.cancelSurfaceCalls('s1')).toBe(1);
    await assert.rejects(p1, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
    expect(handler.pendingCount).toBe(1);
    handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c2', value: 'ok' } });
    assert.equal(await p2, 'ok');
  });

  it('cancelSurfaceCalls 后迟到响应被忽略', async () => {
    const { handler } = makeHandler();
    const promise = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    handler.cancelSurfaceCalls('s1');
    await assert.rejects(promise);
    expect(handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(
      false,
    );
  });

  it('dispose 取消 pending，迟到响应与后续调用被拒绝', async () => {
    const { handler } = makeHandler();
    const promise = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    handler.dispose('test');
    await assert.rejects(promise, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
    expect(handler.disposed).toBe(true);
    expect(handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(
      false,
    );
    await assert.rejects(handler.callAgentFunction('s1', call), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.DISPOSED);
      return true;
    });
  });

  it('超时拒绝，迟到响应被忽略', async () => {
    const { handler } = makeHandler({ defaultTimeoutMs: 5 });
    const promise = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    await assert.rejects(promise, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.TIMEOUT);
      return true;
    });
    expect(handler.pendingCount).toBe(0);
    expect(handler.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(
      false,
    );
  });

  it('pending 数量上限 → TOO_MANY_PENDING', async () => {
    const { handler } = makeHandler({ maxPendingCalls: 1 });
    const pending = handler.callAgentFunction('s1', call, { functionCallId: 'c1' });
    await assert.rejects(handler.callAgentFunction('s1', call, { functionCallId: 'c2' }), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.TOO_MANY_PENDING);
      return true;
    });
    handler.dispose();
    await assert.rejects(pending);
  });

  it('outboundListener 同步抛错 → EXECUTION_ERROR 并清空 pending', async () => {
    const handler = new RpcHandler({
      outboundListener: () => {
        throw new Error('transport down');
      },
    });
    await assert.rejects(handler.callAgentFunction('s1', call, { functionCallId: 'c1' }), (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.EXECUTION_ERROR);
      assert.match(err.message, /transport down/);
      return true;
    });
    expect(handler.pendingCount).toBe(0);
  });
});
