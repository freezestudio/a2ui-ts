/**
 * SurfaceManager — 生产渲染器状态管理
 *
 * 定位说明（与 sdk/src/state/ 的边界）：
 * - 本模块是**实际渲染链路**使用的状态源：preact signal 驱动的浅实现，
 *   面向 Angular/React 等框架的响应式消费（apps/web 已消费）。
 * - sdk/src/state/（NodeGraph/DataModel/GenericBinder）是官方 Python
 *   core/state/ + core/rendering/ 的 TypeScript 移植，定位"headless 参考实现"，
 *   不公开导出、未被生产渲染消费。
 * - 两套状态**有意分离**：本模块保持轻量（纯数据 + signal），深度响应式
 *   绑定逻辑（插值订阅、模板列表 spawn）在 sdk state 演进完备后再评估迁移。
 *
 * 能力：
 * - 组件按 id 合并更新（浅比较跳过未变化项）
 * - DataModel 增量更新（JSON Pointer 路径）
 * - 快照/恢复（会话持久化）
 * - sendDataModel 载荷导出
 * - callFunction 边界检查（allowedCallers）
 */

import { signal } from '@preact/signals-core';
import { z } from 'zod';
import { setAtPath, deleteAtPath } from '../processing/data-binding.js';
import { callFunction, getFunctionAllowedCallers } from '../processing/function-call.js';
import type { A2uiRendererError } from '../processing/message-error-mapper.js';
import {
  toOutboundActionMessage,
  toOutboundFunctionResponse,
  type OutboundMessage,
  type OutboundMessageListener,
} from '../processing/outbound-envelope.js';
import type { ClientActionPayload, FunctionCall } from '../schema/schemas.js';
import { RpcErrorCode, A2uiRpcError } from '../common/errors.js';
import type { CallAgentFunctionOptions, RpcHandler } from '../rpc/rpc-handler.js';
import { createRendererLogger } from '../common/logger.js';
const logger = createRendererLogger('surface-manager');

export const a2uIDescriptorSchema = z.object({ id: z.string(), component: z.string() }).catchall(z.unknown());
export type A2UIDescriptor = z.infer<typeof a2uIDescriptorSchema>;

export const surfaceSchema = z.object({
  surfaceId: z.string(),
  catalogId: z.string().optional(),
  components: z.array(a2uIDescriptorSchema),
  dataModel: z.record(z.string(), z.unknown()),
  sendDataModel: z.boolean().optional(),
});
export type Surface = z.infer<typeof surfaceSchema>;

/**
 * Renderer Data Model 载荷（对齐官方 renderer_data_model.json）
 * 启用 sendDataModel 的 surface 通过 A2A 元数据 a2uiRendererDataModel 发送给 Agent。
 */
export type RendererDataModel = {
  version: '1.0';
  surfaces: Record<string, Record<string, unknown>>;
};

export function findRootComponent(components: A2UIDescriptor[]): A2UIDescriptor | null {
  return components.find((c) => c.id === 'root') ?? null;
}

export class SurfaceManager {
  surfaces = signal<Map<string, Surface>>(new Map());

  private errorListeners = new Set<(error: A2uiRendererError) => void>();
  private rpcHandler?: RpcHandler;
  private isDisposed = false;
  private unifiedOutbound = false;
  private outboundListener?: OutboundMessageListener;

  constructor(
    options: {
      rpcHandler?: RpcHandler;
      unifiedOutbound?: boolean;
      outboundListener?: OutboundMessageListener;
    } = {},
  ) {
    this.rpcHandler = options.rpcHandler;
    this.outboundListener = options.outboundListener;
    this.unifiedOutbound = options.unifiedOutbound ?? false;
  }

  /**
   * 开启/关闭统一出站：action / error / callAgentFunction / rendererFunctionResponse
   * 都通过同一个 outboundListener 发出。开启时必须已注册监听器。
   */
  setUnifiedOutbound(enabled: boolean): void {
    if (enabled && !this.outboundListener) {
      throw new A2uiRpcError('unifiedOutbound requires an outboundListener.', RpcErrorCode.NO_LISTENER);
    }
    this.unifiedOutbound = enabled;
  }

  /** 是否启用统一出站 */
  get isUnifiedOutbound(): boolean {
    return this.unifiedOutbound;
  }

  /** 注册/替换统一出站监听器 */
  setOutboundListener(listener: OutboundMessageListener | undefined): void {
    this.outboundListener = listener;
  }

  /** 发出统一出站消息；未启用或无监听器时返回 false */
  private forwardOutbound(message: OutboundMessage): boolean {
    if (!this.unifiedOutbound || this.isDisposed || !this.outboundListener) return false;
    try {
      const result = this.outboundListener(message);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch((error: unknown) => {
          logger.warn('统一出站监听器失败', { error: errorMessage(error) });
        });
      }
    } catch (error) {
      logger.warn('统一出站监听器抛出异常', { error: errorMessage(error) });
    }
    return true;
  }

  /** 发送 action；统一出站开启时经 outboundListener，否则返回 false 由宿主发送 */
  emitAction(action: ClientActionPayload): boolean {
    return this.forwardOutbound(toOutboundActionMessage(action));
  }

  /** 订阅出站错误（结构化 renderer→agent error 载荷） */
  onError(listener: (error: A2uiRendererError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * 直接转发一条结构化错误到统一出站（不触发本地 onError 订阅）。
   *
   * 供 `sendError` 这类「发送到 agent」入口使用：未开启统一出站或已 dispose 时返回 false，
   * 由调用方回退到旧版 error sender。
   */
  forwardError(error: A2uiRendererError): boolean {
    return this.forwardOutbound({ version: '1.0', error });
  }

  /** 发出结构化错误；本地订阅者与统一出站都会收到 */
  emitError(error: A2uiRendererError): void {
    for (const listener of Array.from(this.errorListeners)) {
      try {
        listener(error);
      } catch (err) {
        logger.warn('错误监听器抛出异常', { error: errorMessage(err) });
      }
    }
    this.forwardOutbound({ version: '1.0', error });
  }

  /** 注入/替换 RPC 处理器 */
  setRpcHandler(handler: RpcHandler | undefined): void {
    this.rpcHandler = handler;
  }

  /** 获取当前 RPC 处理器 */
  getRpcHandler(): RpcHandler | undefined {
    return this.rpcHandler;
  }

  /** 发起 renderer→agent 函数调用（需要已注入 RpcHandler） */
  callAgentFunction<T = unknown>(
    surfaceId: string,
    call: FunctionCall,
    options?: CallAgentFunctionOptions,
  ): Promise<T> {
    if (!this.rpcHandler) {
      return Promise.reject(
        new A2uiRpcError('No RpcHandler configured on SurfaceManager.', RpcErrorCode.NO_LISTENER, undefined, {
          surfaceId,
        }),
      );
    }
    return this.rpcHandler.callAgentFunction<T>(surfaceId, call, options);
  }

  /** 处理 agent 对 callAgentFunction 的响应；迟到/未知响应被忽略 */
  handleAgentFunctionResponse(message: {
    agentFunctionResponse: { functionCallId: string; value?: unknown; error?: { code: string; message: string } };
  }): boolean {
    return this.rpcHandler?.handleAgentFunctionResponse(message) ?? false;
  }

  /** surface 是否已释放 */
  get disposed(): boolean {
    return this.isDisposed;
  }

  handleCreateSurface(surfaceId: string, catalogId?: string, sendDataModel?: boolean): boolean {
    logger.debug('handleCreateSurface', { surfaceId, catalogId });

    const current = this.surfaces.value;
    if (current.has(surfaceId)) {
      logger.debug('⚠ 重复 surfaceId', { surfaceId });
      return false;
    }
    const surface: Surface = {
      surfaceId,
      catalogId,
      components: [],
      dataModel: {},
      sendDataModel,
    };
    const newMap = new Map(current);
    newMap.set(surfaceId, surface);
    this.surfaces.value = newMap;
    logger.debug('Surface 已创建', { surfaceId, totalSurfaces: newMap.size });
    return true;
  }

  handleUpdateComponents(surfaceId: string, components: A2UIDescriptor[]): void {
    logger.debug('handleUpdateComponents', { surfaceId, componentCount: components?.length || 0 });
    if (!components || components.length === 0) return;

    const current = this.surfaces.value;
    const surface = current.get(surfaceId);
    if (!surface) {
      logger.debug('Surface 不存在', { surfaceId });
      return;
    }

    const existingMap = new Map(surface.components.map((c) => [c.id, c]));
    const newIds: string[] = [];
    const updatedIds: string[] = [];
    const skippedIds: string[] = [];

    for (const comp of components) {
      if (existingMap.has(comp.id)) {
        const existing = existingMap.get(comp.id)!;
        if (!this._hasChanged(existing, comp)) {
          skippedIds.push(comp.id);
          continue;
        }
        updatedIds.push(comp.id);
      } else {
        newIds.push(comp.id);
      }
      existingMap.set(comp.id, comp);
    }
    const merged = [...existingMap.values()];

    logger.debug('组件已合并', {
      surfaceId,
      totalCount: merged.length,
      newCount: newIds.length,
      updatedCount: updatedIds.length,
      skippedCount: skippedIds.length,
    });

    const newMap = new Map(current);
    newMap.set(surfaceId, { ...surface, components: merged });
    this.surfaces.value = newMap;
  }

  handleUpdateDataModel(surfaceId: string, path?: string, value?: unknown): void {
    logger.debug('handleUpdateDataModel', { surfaceId, path: path || '/', hasValue: value !== undefined });
    const current = this.surfaces.value;
    const surface = current.get(surfaceId);
    if (!surface) {
      logger.debug('Surface 不存在', { surfaceId });
      return;
    }

    // 不可变更新：深拷贝 dataModel 后再写入，避免原地 mutate 破坏快照语义与
    // 响应式变更检测（Surface 对象本身也新建，保证 signal 触发）
    const nextDataModel = structuredClone(surface.dataModel);
    if (value === null || value === undefined) {
      if (path) {
        deleteAtPath(nextDataModel, path);
      } else {
        for (const key of Object.keys(nextDataModel)) delete nextDataModel[key];
      }
    } else if (value !== undefined) {
      setAtPath(nextDataModel, path || '/', value);
    }

    const newMap = new Map(current);
    newMap.set(surfaceId, { ...surface, dataModel: nextDataModel });
    this.surfaces.value = newMap;
  }

  handleDeleteSurface(surfaceId: string): boolean {
    const current = this.surfaces.value;
    if (!current.has(surfaceId)) return false;
    this.rpcHandler?.cancelSurfaceCalls(surfaceId);
    const newMap = new Map(current);
    newMap.delete(surfaceId);
    this.surfaces.value = newMap;
    logger.debug('Surface 已删除', { surfaceId, remainingCount: newMap.size });
    return true;
  }

  clear(): void {
    const count = this.surfaces.value.size;
    this.rpcHandler?.cancelAll('SurfaceManager cleared.');
    this.surfaces.value = new Map();
    logger.debug('清除所有 Surface', { clearedCount: count });
  }

  /** 释放管理器：取消 pending RPC、清空监听器与 surface 状态 */
  dispose(reason?: string): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.rpcHandler?.dispose(reason);
    this.errorListeners.clear();
    this.outboundListener = undefined;
    this.surfaces.value = new Map();
  }

  snapshot(): Surface[] {
    return [...this.surfaces.value.values()].map((s) => structuredClone(s));
  }

  restore(surfaces: Surface[]): void {
    const map = new Map<string, Surface>();
    for (const s of surfaces) {
      map.set(s.surfaceId, structuredClone(s));
    }
    this.surfaces.value = map;
    logger.debug('从快照恢复', { surfaceCount: map.size });
  }

  getSendDataModelPayload(): RendererDataModel | undefined {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [id, surface] of this.surfaces.value) {
      if (surface.sendDataModel) {
        result[id] = surface.dataModel;
      }
    }
    return Object.keys(result).length > 0 ? { version: '1.0', surfaces: result } : undefined;
  }

  getComponentMap(surface: Surface): Map<string, A2UIDescriptor> {
    const map = new Map<string, A2UIDescriptor>();
    for (const comp of surface.components) {
      map.set(comp.id, comp);
    }
    return map;
  }

  handleCallRendererFunction(
    call: {
      /** v1.0 (#3110)：可选求值上下文 surface；缺省为空根上下文 */
      surfaceId?: string;
      functionCallId: string;
      '@call': string;
      catalogId: string;
      args?: Record<string, unknown>;
    },
    onResponse?: (response: {
      functionCallId: string;
      value?: unknown;
      error?: { code: string; message: string };
    }) => void,
  ): void {
    const respond =
      onResponse ??
      ((response: { functionCallId: string; value?: unknown; error?: { code: string; message: string } }) => {
        if (this.unifiedOutbound) this.forwardOutbound(toOutboundFunctionResponse(response));
      });

    const callName = call['@call'];
    let dataModel: Record<string, unknown> = {};
    if (call.surfaceId !== undefined) {
      const surface = this.surfaces.value.get(call.surfaceId);
      if (!surface) {
        respond({
          functionCallId: call.functionCallId,
          error: {
            code: 'INVALID_FUNCTION_CALL',
            message: `Surface '${call.surfaceId}' does not exist for callRendererFunction.`,
          },
        });
        return;
      }
      dataModel = surface.dataModel;
    }

    const allowedCallers = getFunctionAllowedCallers(callName, call.catalogId);
    if (!allowedCallers) {
      respond({
        functionCallId: call.functionCallId,
        error: {
          code: 'INVALID_FUNCTION_CALL',
          message: `Function '${callName}' is not registered in catalog '${call.catalogId}'.`,
        },
      });
      return;
    }
    if (allowedCallers === 'rendererOnly') {
      respond({
        functionCallId: call.functionCallId,
        error: { code: 'INVALID_FUNCTION_CALL', message: `Function '${callName}' is rendererOnly.` },
      });
      return;
    }

    try {
      const result = callFunction({ '@call': callName, catalogId: call.catalogId, args: call.args }, dataModel, 0, {
        caller: 'agent',
      });
      respond({ functionCallId: call.functionCallId, value: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      respond({
        functionCallId: call.functionCallId,
        error: { code: 'EXECUTION_ERROR', message },
      });
    }
  }

  private _hasChanged(a: A2UIDescriptor, b: A2UIDescriptor): boolean {
    const aKeys = Object.keys(a)
      .filter((k) => k !== 'id')
      .sort();
    const bKeys = Object.keys(b)
      .filter((k) => k !== 'id')
      .sort();
    if (aKeys.length !== bKeys.length) return true;
    for (const key of aKeys) {
      if (!bKeys.includes(key)) return true;
      if (a[key] !== b[key]) return true;
    }
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
