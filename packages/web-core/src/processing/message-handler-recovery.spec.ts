import { describe, it, expect } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { SurfaceManager } from '../state/surface-manager.js';
import { RpcHandler, type CallAgentFunctionEnvelope } from '../rpc/rpc-handler.js';
import { A2uiRpcError, RpcErrorCode } from '../common/errors.js';
import { processMessagesWithErrors, processMessageSafe } from './message-handler.js';

const call = { '@call': 'refreshData', catalogId: 'geo', args: {} };

function makeManager() {
  const sent: CallAgentFunctionEnvelope[] = [];
  const rpc = new RpcHandler({
    outboundListener: (m) => {
      sent.push(m);
    },
  });
  const manager = new SurfaceManager({ rpcHandler: rpc });
  return { manager, rpc, sent };
}

describe('SurfaceManager — RPC 生命周期集成', () => {
  it('callAgentFunction 登记 pending，agentFunctionResponse 关联', async () => {
    const { manager } = makeManager();
    const promise = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    expect(manager.getRpcHandler()?.pendingCount).toBe(1);
    expect(
      manager.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: { ok: true } } }),
    ).toBe(true);
    assert.deepEqual(await promise, { ok: true });
  });

  it('deleteSurface 取消该 surface 的 pending 调用', async () => {
    const { manager } = makeManager();
    manager.handleCreateSurface('s1');
    const promise = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    expect(manager.handleDeleteSurface('s1')).toBe(true);
    await assert.rejects(promise, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
    expect(manager.handleAgentFunctionResponse({ agentFunctionResponse: { functionCallId: 'c1', value: 1 } })).toBe(
      false,
    );
  });

  it('clear 取消全部 pending', async () => {
    const { manager } = makeManager();
    const promise = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    manager.clear();
    await assert.rejects(promise, (err: unknown) => {
      assert.ok(err instanceof A2uiRpcError);
      assert.equal(err.code, RpcErrorCode.CANCELLED);
      return true;
    });
  });

  it('onError 订阅结构化错误', () => {
    const { manager } = makeManager();
    const received: unknown[] = [];
    const unsubscribe = manager.onError((error) => received.push(error));
    manager.emitError({ code: 'EXPRESSION_ERROR', surfaceId: 's1', message: 'boom' });
    unsubscribe();
    manager.emitError({ code: 'INTERNAL_ERROR', message: 'after unsubscribe' });
    expect(received).toEqual([{ code: 'EXPRESSION_ERROR', surfaceId: 's1', message: 'boom' }]);
  });

  it('dispose 后 pending 取消，后续调用拒绝', async () => {
    const { manager } = makeManager();
    const promise = manager.callAgentFunction('s1', call, { functionCallId: 'c1' });
    manager.dispose('test');
    await assert.rejects(promise, (err: unknown) => {
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
});

describe('processMessageSafe / processMessagesWithErrors', () => {
  it('正常消息返回 null', () => {
    const { manager } = makeManager();
    const result = processMessageSafe(
      { version: '1.0', createSurface: { surfaceId: 's1' } },
      manager,
      undefined,
      undefined,
    );
    expect(result).toBeNull();
  });

  it('processor 抛出时映射为结构化错误并发出 onError', () => {
    const { manager } = makeManager();
    const received: unknown[] = [];
    manager.onError((error) => received.push(error));
    manager.handleCreateSurface = () => {
      throw new Error('boom');
    };
    const result = processMessageSafe({ version: '1.0', createSurface: { surfaceId: 's1' } }, manager);
    expect(result).toMatchObject({ version: '1.0', error: { code: 'INTERNAL_ERROR', surfaceId: 's1' } });
    expect(received).toHaveLength(1);
  });

  it('批量处理收集错误且不抛出', () => {
    const { manager } = makeManager();
    manager.handleCreateSurface = () => {
      throw new Error('x');
    };
    const errors = processMessagesWithErrors(
      [
        { version: '1.0', createSurface: { surfaceId: 's1' } },
        { version: '1.0', createSurface: { surfaceId: 's2' } },
      ],
      manager,
    );
    expect(errors).toHaveLength(2);
    expect(errors[0].messageIndex).toBe(0);
    expect(errors[1].messageIndex).toBe(1);
  });
});
