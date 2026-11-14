/**
 * RPC 生命周期管理（对齐上游 web_core #3856 / #3579）
 *
 * 负责 renderer→agent 的 `callAgentFunction`：
 * - pending 调用登记、functionCallId 关联
 * - timeout / cancel / dispose
 * - 迟到响应（超时、取消、dispose 后）忽略
 * - pending 数量上限（TOO_MANY_PENDING）
 *
 * Agent→renderer 的 `callRendererFunction` 由 `SurfaceManager.handleCallRendererFunction`
 * 执行并复用本模块的错误码。
 */

import { A2uiRpcError, RpcErrorCode } from '../common/errors.js';
import type { FunctionCall } from '../schema/schemas.js';

/** 出站 callAgentFunction 消息信封（v1.0） */
export interface CallAgentFunctionEnvelope {
  version: '1.0';
  callAgentFunction: {
    surfaceId: string;
    functionCallId: string;
    callFunction: FunctionCall;
  };
}

/** 出站消息监听器 */
export type RpcOutboundListener = (message: CallAgentFunctionEnvelope) => void | Promise<void>;

/** RpcHandler 配置 */
export interface RpcHandlerOptions {
  /** 发送 callAgentFunction 的监听器；未提供时调用会以 NO_LISTENER 拒绝 */
  outboundListener?: RpcOutboundListener;
  /** 默认超时（毫秒，默认 30000；<=0 表示不启用超时） */
  defaultTimeoutMs?: number;
  /** 同时 pending 的调用上限（默认 64） */
  maxPendingCalls?: number;
}

/** 单次调用选项 */
export interface CallAgentFunctionOptions {
  functionCallId?: string;
  timeoutMs?: number;
}

interface PendingCall {
  functionCallId: string;
  surfaceId: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** 默认 pending 上限 */
export const DEFAULT_MAX_PENDING_CALLS = 64;

/** 默认超时 */
export const DEFAULT_RPC_TIMEOUT_MS = 30_000;

export class RpcHandler {
  private readonly pending = new Map<string, PendingCall>();
  private outboundListener?: RpcOutboundListener;
  private readonly defaultTimeoutMs: number;
  private readonly maxPendingCalls: number;
  private isDisposed = false;
  private counter = 0;

  constructor(options: RpcHandlerOptions = {}) {
    this.outboundListener = options.outboundListener;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
    this.maxPendingCalls = options.maxPendingCalls ?? DEFAULT_MAX_PENDING_CALLS;
  }

  /** 是否已 dispose */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /** 当前 pending 数量 */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** 替换出站监听器 */
  setOutboundListener(listener: RpcOutboundListener | undefined): void {
    this.outboundListener = listener;
  }

  /**
   * 发起 renderer→agent 函数调用，返回 Promise；由 `handleAgentFunctionResponse` 关联结果。
   */
  callAgentFunction<T = unknown>(
    surfaceId: string,
    call: FunctionCall,
    options: CallAgentFunctionOptions = {},
  ): Promise<T> {
    if (this.isDisposed) {
      return Promise.reject(new A2uiRpcError('RpcHandler has been disposed.', RpcErrorCode.DISPOSED));
    }
    if (!this.outboundListener) {
      return Promise.reject(
        new A2uiRpcError('Cannot call agent function without outboundListener configured.', RpcErrorCode.NO_LISTENER),
      );
    }
    const callName = call?.['@call'];
    if (typeof callName !== 'string' || callName.length === 0) {
      return Promise.reject(
        new A2uiRpcError('Missing or invalid function call name.', RpcErrorCode.INVALID_FUNCTION_CALL),
      );
    }
    if (this.pending.size >= this.maxPendingCalls) {
      return Promise.reject(
        new A2uiRpcError(
          `Too many pending agent function calls (max ${this.maxPendingCalls}).`,
          RpcErrorCode.TOO_MANY_PENDING,
        ),
      );
    }

    const functionCallId = options.functionCallId ?? this.generateFunctionCallId(callName);
    if (this.pending.has(functionCallId)) {
      return Promise.reject(
        new A2uiRpcError(
          `A call with functionCallId '${functionCallId}' is already pending.`,
          RpcErrorCode.DUPLICATE,
          functionCallId,
        ),
      );
    }

    return new Promise<T>((resolve, reject) => {
      const pending: PendingCall = {
        functionCallId,
        surfaceId,
        resolve: resolve as (value: unknown) => void,
        reject,
      };
      const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.expire(functionCallId, `Agent function call '${functionCallId}' timed out.`);
        }, timeoutMs);
        const timer = pending.timer as { unref?: () => void };
        if (typeof timer.unref === 'function') timer.unref();
      }
      this.pending.set(functionCallId, pending);

      const message: CallAgentFunctionEnvelope = {
        version: '1.0',
        callAgentFunction: { surfaceId, functionCallId, callFunction: call },
      };
      try {
        const result = this.outboundListener?.(message);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch((error: unknown) => {
            this.rejectPending(functionCallId, RpcErrorCode.EXECUTION_ERROR, errorMessage(error), error);
          });
        }
      } catch (error) {
        this.rejectPending(functionCallId, RpcErrorCode.EXECUTION_ERROR, errorMessage(error), error);
      }
    });
  }

  /**
   * 处理 agentFunctionResponse；未知/迟到 functionCallId 会被忽略并返回 false。
   */
  handleAgentFunctionResponse(message: {
    agentFunctionResponse: { functionCallId: string; value?: unknown; error?: { code: string; message: string } };
  }): boolean {
    const payload = message?.agentFunctionResponse;
    if (!payload || typeof payload.functionCallId !== 'string') return false;
    const pending = this.pending.get(payload.functionCallId);
    if (!pending) return false;

    this.settle(pending);
    if (payload.error !== undefined) {
      pending.reject(
        new A2uiRpcError(
          payload.error.message || 'Agent function execution failed.',
          payload.error.code || RpcErrorCode.UNKNOWN_ERROR,
          payload.functionCallId,
        ),
      );
    } else {
      pending.resolve(payload.value);
    }
    return true;
  }

  /** 主动让某个调用超时（供确定性测试与宿主定时器使用） */
  expire(functionCallId: string, reason?: string): boolean {
    return this.rejectPending(
      functionCallId,
      RpcErrorCode.TIMEOUT,
      reason ?? `Agent function call '${functionCallId}' timed out.`,
    );
  }

  /** 取消某个 surface 上所有 pending 调用（surface 删除时调用） */
  cancelSurfaceCalls(surfaceId: string, reason?: string): number {
    let count = 0;
    for (const [id, pending] of Array.from(this.pending.entries())) {
      if (pending.surfaceId !== surfaceId) continue;
      this.settle(pending);
      pending.reject(
        new A2uiRpcError(
          reason ?? `Pending calls for surface '${surfaceId}' were cancelled.`,
          RpcErrorCode.CANCELLED,
          id,
        ),
      );
      count++;
    }
    return count;
  }

  /** 取消全部 pending 调用 */
  cancelAll(reason?: string): number {
    let count = 0;
    for (const [id, pending] of Array.from(this.pending.entries())) {
      this.settle(pending);
      pending.reject(new A2uiRpcError(reason ?? 'Pending function call was cancelled.', RpcErrorCode.CANCELLED, id));
      count++;
    }
    return count;
  }

  /** 释放：拒绝所有 pending、忽略迟到响应、后续调用以 DISPOSED 拒绝 */
  dispose(reason?: string): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.outboundListener = undefined;
    const suffix = reason ? `: ${reason}` : '';
    this.cancelAll(`RpcHandler disposed while calls were pending${suffix}`);
  }

  private rejectPending(functionCallId: string, code: string, message: string, cause?: unknown): boolean {
    const pending = this.pending.get(functionCallId);
    if (!pending) return false;
    this.settle(pending);
    pending.reject(new A2uiRpcError(message, code, functionCallId, { cause }));
    return true;
  }

  private settle(pending: PendingCall): void {
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    this.pending.delete(pending.functionCallId);
  }

  private generateFunctionCallId(callName: string): string {
    this.counter += 1;
    const random = Math.random().toString(36).slice(2, 8);
    return `${callName}_${Date.now()}_${this.counter}_${random}`;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
