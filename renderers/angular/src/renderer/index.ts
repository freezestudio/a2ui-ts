/**
 * A2UI 渲染器服务（入口模块）
 *
 * 模块职责：
 * 作为 A2UI 渲染子系统的统一入口，接收来自后端传输通道（WS/SSE）的 A2UI 协议消息，
 * 将其解析为 Surface（渲染表面）和 Component（UI 组件）的状态变更，
 * 并通过 Angular Signal 驱动视图更新。
 *
 * 在通信链路中的位置：
 *   传输通道 (WS/SSE) → A2UIRendererService (数据解析 & 状态管理) → Angular 组件 (视图渲染)
 *
 * 核心概念：
 *   - Surface（渲染表面）：一个独立的 UI 渲染区域，包含组件列表和数据模型。
 *     每个 Surface 有唯一的 surfaceId 和关联的组件目录 catalogId。
 *   - A2UIDescriptor（A2UI 组件）：描述一个 UI 组件的类型和属性，如 RiskPanel、MultiSensorChart 等。
 *   - DataModel（数据模型）：Surface 中组件可绑定的响应式数据源。
 *   - DynamicValue（动态值）：组件属性中可以绑定到 DataModel 路径或函数调用的值。
 *
 * 消息类型（A2UIMessage）：
 *   - createSurface：创建新的 Surface 并可选地附带初始组件和数据模型
 *   - updateComponents：更新指定 Surface 中的组件列表
 *   - updateDataModel：更新指定 Surface 的数据模型（支持 JSON Pointer 路径）
 *   - deleteSurface：删除指定的 Surface
 *   - callRendererFunction：Agent 请求 Renderer 执行函数（v1.0 #2210）
 *   - agentFunctionResponse：Agent 响应 Renderer 的 callAgentFunction（v1.0 #2210）
 */
import { Injectable, Signal } from '@angular/core';
import { SurfaceManager, Surface, A2UIDescriptor } from './surface-manager.js';
import { processMessage, isValidMessage, clearAllPending, type A2UIMessage } from './message-handler.js';
import {
  resolveDynamicValue,
  resolveDynamicString,
  callFunction,
  isKnownFunction,
  type FunctionCall,
} from './function-call.js';
import { A2uiClientActionMessageSchema, A2uiClientErrorMessageSchema } from '@a2ui-ts/web-core';
import { createRendererLogger } from './logger.js';
const logger = createRendererLogger('renderer');

export type { A2UIDescriptor, Surface } from './surface-manager.js';
export { findRootComponent } from './surface-manager.js';
export type { A2UIMessage } from './message-handler.js';
export { DataContext } from './data-context.js';
export { ComponentBinder } from './component-binder.js';

/**
 * A2UI 渲染器服务（Angular 单例）
 *
 * 负责将 A2UI JSON 数据转换为前端可渲染的 Surface/Component 状态，
 * 并提供 Signal 供 Angular 组件订阅状态变化。
 */
@Injectable({ providedIn: 'root' })
export class A2UIRendererService {
  /** Surface 管理器——维护所有 Surface 的增删改查状态 */
  private _surfaceManager = new SurfaceManager();

  /** rendererFunctionResponse 发送回调（由 App 注入，v1.0 #2210 对应 callRendererFunction） */
  private _sendRendererFunctionResponse:
    | ((response: { functionCallId: string; value?: unknown; error?: { code: string; message: string } }) => void)
    | null = null;

  /** action 事件发送回调（由 App 注入，发送 renderer→agent 的 action 消息） */
  private _sendAction:
    | ((action: {
        name: string;
        userMessage?: string;
        surfaceId: string;
        sourceComponentId: string;
        timestamp: string;
        context: Record<string, unknown>;
      }) => unknown)
    | null = null;

  /** callAgentFunction 发送回调（由 App 注入，发送 renderer→agent 的 callAgentFunction 消息） */
  private _sendCallAgentFunction:
    | ((call: {
        surfaceId: string;
        functionCallId: string;
        callFunction: { call: string; catalogId?: string; args?: Record<string, unknown> };
      }) => unknown)
    | null = null;

  /** error 消息发送回调（由 App 注入，发送 renderer→agent 的 error 消息） */
  private _sendError:
    | ((error: { code: string; message: string; surfaceId?: string; path?: string; functionCallId?: string }) => void)
    | null = null;

  /**
   * 注册 rendererFunctionResponse 发送回调（v1.0 #2210）
   */
  setFunctionResponseSender(
    sender: (response: { functionCallId: string; value?: unknown; error?: { code: string; message: string } }) => void,
  ): void {
    this._sendRendererFunctionResponse = sender;
  }

  /**
   * 注册 action 事件发送回调（v1.0 renderer→agent action 消息）
   */
  setActionSender(
    sender: (action: {
      name: string;
      userMessage?: string;
      surfaceId: string;
      sourceComponentId: string;
      timestamp: string;
      context: Record<string, unknown>;
    }) => unknown,
  ): void {
    this._sendAction = sender;
  }

  /**
   * 注册 callAgentFunction 发送回调（v1.0 #2210）
   */
  setCallAgentFunctionSender(
    sender: (call: {
      surfaceId: string;
      functionCallId: string;
      callFunction: { call: string; catalogId?: string; args?: Record<string, unknown> };
    }) => unknown,
  ): void {
    this._sendCallAgentFunction = sender;
  }

  /**
   * 注册 error 消息发送回调（v1.0 renderer→agent error 消息）
   */
  setErrorSender(
    sender: (error: {
      code: string;
      message: string;
      surfaceId?: string;
      path?: string;
      functionCallId?: string;
    }) => void,
  ): void {
    this._sendError = sender;
  }

  /**
   * 发送 renderer→agent 错误消息（协议 error 消息，含 VALIDATION_FAILED 与通用错误）
   */
  sendError(error: {
    code: string;
    message: string;
    surfaceId?: string;
    path?: string;
    functionCallId?: string;
  }): void {
    const payload = { version: 'v1.0' as const, error };
    const validation = A2uiClientErrorMessageSchema.safeParse(payload);
    if (!validation.success) {
      logger.warn('sendError 载荷校验失败，已拦截', {
        code: error.code,
        issues: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return;
    }
    logger.debug('sendError', { ...error });
    this._sendError?.(error);
  }

  /**
   * 发送 action 事件到服务端（v1.0 renderer→agent）
   *
   * 组装标准 renderer_to_agent action 消息信封并交由 App 注入的发送器传输。
   */
  sendAction(action: {
    name: string;
    userMessage?: string;
    surfaceId: string;
    sourceComponentId: string;
    context: Record<string, unknown>;
  }): unknown {
    const payload = {
      version: 'v1.0' as const,
      action: {
        ...action,
        timestamp: new Date().toISOString(),
      },
    };
    const validation = A2uiClientActionMessageSchema.safeParse(payload);
    if (!validation.success) {
      logger.warn('sendAction 载荷校验失败，已拦截', {
        name: action.name,
        issues: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return undefined;
    }
    logger.debug('sendAction', {
      name: action.name,
      surfaceId: action.surfaceId,
    });
    return this._sendAction?.(payload.action) ?? undefined;
  }

  /**
   * 发送 callAgentFunction 到服务端（v1.0 #2210 双向函数调用）
   *
   * 组件 action.functionCall 需要 agent 端执行时调用；服务端以 agentFunctionResponse 响应。
   * 返回发送器结果（Promise 或同步值，含 agentFunctionResponse 的 value）。
   */
  sendCallAgentFunction(call: {
    surfaceId: string;
    functionCallId: string;
    callFunction: { call: string; catalogId?: string; args?: Record<string, unknown> };
  }): unknown {
    logger.debug('sendCallAgentFunction', {
      call: call.callFunction.call,
      surfaceId: call.surfaceId,
      functionCallId: call.functionCallId,
    });
    return this._sendCallAgentFunction?.(call) ?? undefined;
  }

  /** 内部：调用 processMessage 并传入 rendererFunctionResponse 回调 */
  private _p(msg: A2UIMessage): void {
    processMessage(msg, this._surfaceManager.core, this._sendRendererFunctionResponse ?? undefined, this);
  }

  /**
   * 处理组件 action 事件（v1.0 #2210 双向函数调用）
   *
   * basic/geo 组件共用入口：
   * - action.event：单向事件，解析 context 后发送 renderer→agent action
   * - action.functionCall：
   *   - 本地已注册函数 → 渲染端本地执行（用户激活上下文，requiresUserActivation 函数可执行）
   *   - 本地未注册函数 → 视为 agent 端函数，发送 callAgentFunction，响应写回 dataModel
   *
   * @param component - 含 action 字段的组件描述
   * @param surface - 所属 surface
   */
  async handleComponentAction(component: A2UIDescriptor, surface: Surface): Promise<void> {
    const action = component['action'] as Record<string, unknown> | undefined;
    if (!action) return;

    if (action['functionCall']) {
      const fn = action['functionCall'] as FunctionCall;
      // agent 端函数：本地 FunctionRegistry 未注册 → callAgentFunction（如 refreshData）
      if (!isKnownFunction(fn.call)) {
        await this.handleAgentFunction(fn, surface, action);
        return;
      }
      // 本地渲染端函数（requiresUserActivation 函数仅在激活 Action 内允许）
      const context = {
        ...this.buildContext(surface),
        isExecutingAction: true,
        actionIntent: 'activation',
      } as Record<string, unknown>;
      try {
        callFunction(fn, surface.dataModel, 0, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('action.functionCall 执行失败', { call: fn.call, message });
      }
      return;
    }

    if (action['event']) {
      const event = action['event'] as Record<string, unknown>;
      const name = event['name'] as string;
      const userMessage = event['userMessage'] as string | undefined;
      const rawContext = (event['context'] || {}) as Record<string, unknown>;

      const resolvedContext: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(rawContext)) {
        resolvedContext[key] = this.resolveDynamicValue(val, surface);
      }

      this.sendAction({
        name,
        userMessage,
        surfaceId: surface.surfaceId,
        sourceComponentId: component.id,
        context: resolvedContext,
      });
    }
  }

  /**
   * 处理 agent 端函数调用（v1.0 #2210 callAgentFunction → agentFunctionResponse）
   *
   * args 中声明 `responsePath`（如 '/components/stats-summary'）时，
   * 将 agentFunctionResponse 的 value 写回 dataModel 对应路径（响应式刷新）。
   */
  private async handleAgentFunction(
    fn: FunctionCall,
    surface: Surface,
    action: Record<string, unknown>,
  ): Promise<void> {
    const responsePath =
      (fn.args?.['responsePath'] as string | undefined) ?? (action['responsePath'] as string | undefined);
    const functionCallId = `${fn.call}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.sendCallAgentFunction({
      surfaceId: surface.surfaceId,
      functionCallId,
      callFunction: { call: fn.call, catalogId: fn.catalogId, args: fn.args },
    });
    const value =
      result && typeof result === 'object' && 'value' in result ? (result as { value?: unknown }).value : result;
    if (responsePath && value !== undefined && value !== null) {
      this.processMessage({
        version: 'v1.0',
        updateDataModel: { surfaceId: surface.surfaceId, path: responsePath, value },
      });
    }
  }

  /**
   * 获取当前所有 Surface 的响应式信号
   *
   * Angular 组件可通过此 Signal 订阅 Surface 列表变化，
   * 当 Surface 被创建、更新或删除时，视图会自动刷新。
   *
   * @returns 包含所有 Surface 的 Map<string, Surface> 的 Signal
   */
  get surfaces(): Signal<Map<string, Surface>> {
    return this._surfaceManager.surfaces;
  }

  get surfaceManager(): SurfaceManager {
    return this._surfaceManager;
  }

  /** 获取标记了 sendDataModel 的 surface 数据模型 payload */
  getSendDataModelPayload(): Record<string, unknown> | undefined {
    return this._surfaceManager.getSendDataModelPayload();
  }

  /**
   * 批量处理 A2UI 消息数组
   *
   * @param messages - A2UI 消息数组，每条消息描述一个 Surface 操作
   */
  processMessages(messages: A2UIMessage[]): void {
    logger.debug('批量消息', { count: messages.length });
    for (const msg of messages) {
      this._p(msg);
    }
  }

  /**
   * 处理单条 A2UI 消息
   *
   * @param msg - 单条 A2UI 消息
   */
  processMessage(msg: A2UIMessage): void {
    this._p(msg);
  }

  /**
   * 增量渲染：处理 a2ui_partial 增量事件（服务端增量解析器的渐进渲染）
   *
   * 将增量组件/数据模型应用到 Surface，surface 不存在时自动创建。
   * 收敛 App 对 surfaceManager 的直接操作，保证单一状态写入入口。
   *
   * @param partial - a2ui_partial 事件的 delta 载荷
   */
  processIncremental(partial: {
    components?: Array<{
      id: string;
      type?: string;
      props?: Record<string, unknown>;
      isPlaceholder: boolean;
    }>;
    dataModelDelta?: { path?: string; value?: unknown };
    surfaceId?: string;
    catalogId?: string;
  }): void {
    const surfaceId = partial.surfaceId || 'main';

    if (partial.components?.length) {
      if (!this._surfaceManager.surfaces().has(surfaceId)) {
        this._surfaceManager.handleCreateSurface(surfaceId, partial.catalogId);
      }
      const comps = partial.components.map((c) => ({
        id: c.id,
        component: c.isPlaceholder ? 'placeholder' : c.type || 'Text',
        ...c.props,
      }));
      this._surfaceManager.handleUpdateComponents(surfaceId, comps);
    }

    if (partial.dataModelDelta) {
      if (!this._surfaceManager.surfaces().has(surfaceId)) {
        this._surfaceManager.handleCreateSurface(surfaceId, partial.catalogId);
      }
      this._surfaceManager.handleUpdateDataModel(surfaceId, partial.dataModelDelta.path, partial.dataModelDelta.value);
    }
  }

  /**
   * 处理从传输通道（WS/SSE）接收的原始 A2UI 数据
   *
   * 数据格式可能是：
   *   1. 单条 A2UIMessage 对象（最常见）
   *   2. A2UIMessage 数组
   *   3. 嵌套对象（包含 messages 等 key 的数组）
   *
   * @param data - 从 A2A Artifact 的 data Part 中解析出的原始数据
   */
  processData(data: unknown): void {
    logger.debug('processData 入口', {
      dataType: typeof data,
      isArray: Array.isArray(data),
      isNull: data === null,
    });

    // 非对象类型（null、string、number 等）无法解析为 A2UI 消息，直接跳过
    if (!data || typeof data !== 'object') {
      logger.debug('processData: 非对象跳过', { type: typeof data });
      return;
    }

    let processed = 0;

    // 情况 1：数据是数组——逐条解析并处理
    if (Array.isArray(data)) {
      logger.debug('数组消息', { count: data.length });
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        logger.debug('处理数组项', {
          index: i,
          type: typeof item,
          keys: item && typeof item === 'object' ? Object.keys(item) : 'non-object',
        });
        if (isValidMessage(item)) {
          // 传入 functionResponse 发送回调，保证 callFunction 消息的函数结果能回传 agent
          processMessage(
            item as A2UIMessage,
            this._surfaceManager.core,
            this._sendRendererFunctionResponse ?? undefined,
            this,
          );
          processed++;
        } else {
          logger.debug('⚠ 无效消息跳过', { index: i, itemType: typeof item });
        }
      }
      if (processed === 0 && data.length > 0) {
        logger.debug('❌ 所有消息均无效', { total: data.length });
      } else {
        logger.debug('数组处理完成', { total: data.length, processed });
      }
      return;
    }

    // 情况 2：数据是单条标准 A2UI 消息
    if (isValidMessage(data)) {
      const msgType = detectMessageType(data as unknown as Record<string, unknown>);
      logger.debug('单条消息', {
        type: msgType,
        keys: Object.keys(data as unknown as Record<string, unknown>),
      });
      processMessage(
        data as A2UIMessage,
        this._surfaceManager.core,
        this._sendRendererFunctionResponse ?? undefined,
        this,
      );
      processed = 1;
    } else {
      // 情况 3：非标准格式——尝试在嵌套对象中查找消息数组
      logger.debug('⚠ 非标准格式，尝试嵌套', {
        keys: Object.keys(data as unknown as Record<string, unknown>),
      });
      const obj = data as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          logger.debug('找到嵌套数组', { key, length: value.length });
          for (const item of value) {
            if (isValidMessage(item)) {
              processMessage(
                item as A2UIMessage,
                this._surfaceManager.core,
                this._sendRendererFunctionResponse ?? undefined,
                this,
              );
              processed++;
            }
          }
        }
      }
      if (processed === 0) {
        logger.debug('❌ 所有嵌套数据均无效', { keys: Object.keys(obj) });
      }
    }

    // 记录 Surface 列表变化
    logger.debug('处理完成', {
      processed,
      surfaceCount: this._surfaceManager.surfaces().size,
      surfaceIds: [...this._surfaceManager.surfaces().keys()],
    });
  }

  /**
   * 解析动态值——将组件属性中的 DataBinding 或 FunctionCall 解析为实际值
   *
   * @param value - 待解析的动态值（可能是路径绑定、函数调用或静态值）
   * @param surface - 目标 Surface，提供数据模型上下文
   * @returns 解析后的实际值
   */
  resolveDynamicValue(value: unknown, surface: Surface): unknown {
    const context = this.buildContext(surface);
    return resolveDynamicValue(value, surface.dataModel, context);
  }

  /**
   * 解析动态字符串——同 resolveDynamicValue，但确保返回字符串类型
   *
   * @param value - 待解析的动态值
   * @param surface - 目标 Surface
   * @returns 解析后的字符串值（null/undefined 转为空字符串）
   */
  resolveDynamicString(value: unknown, surface: Surface): string {
    const context = this.buildContext(surface);
    return resolveDynamicString(value, surface.dataModel, context);
  }

  /**
   * 解析组件属性为渲染值（v1.0 DataBinding 支持）
   *
   * 对值为 DataBinding（{path}）/ FunctionCall（{call}）的属性做动态解析，
   * 静态值（字符串/数字/数组/普通对象）原样返回。
   * geo 组件读取复杂数据字段（series/factors/stats/data/option 等）统一走此入口，
   * 使组件既能消费"内嵌静态数据"，也能消费"dataModel 外置 + DataBinding 引用"。
   *
   * @param component - 组件描述对象
   * @param surface - 目标 Surface
   * @param key - 属性名
   * @returns 解析后的实际值
   */
  resolveComponentProp(component: A2UIDescriptor, surface: Surface, key: string): unknown {
    const value = component[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && ('path' in value || 'call' in value)) {
      return this.resolveDynamicValue(value, surface);
    }
    return value;
  }

  private buildContext(_surface: Surface): Record<string, unknown> | undefined {
    return undefined;
  }

  /**
   * 获取指定 Surface 的组件映射表
   *
   * 将 Surface 中的组件数组转换为 Map<componentId, component>，
   * 便于在模板中通过 ID 快速查找组件。
   *
   * @param surface - 目标 Surface
   * @returns 组件 ID 到组件对象的映射表
   */
  getComponentMap(surface: Surface): Map<string, A2UIDescriptor> {
    return this._surfaceManager.getComponentMap(surface);
  }

  /**
   * 清除所有 Surface 状态
   *
   * 通常在会话重置或页面销毁时调用。
   */
  clear(): void {
    const count = this._surfaceManager.surfaces().size;
    this._surfaceManager.clear();
    clearAllPending();
    logger.debug('清除所有', { clearedSurfaces: count });
  }

  /**
   * 序列化所有 Surface 为快照数据
   *
   * 用于会话持久化，将当前 Surface 状态保存为可存储格式。
   */
  snapshot(): Surface[] {
    return this._surfaceManager.snapshot();
  }

  /**
   * 从快照数据恢复 Surface 状态
   *
   * 快速恢复 Surface 状态，跳过消息重放过程。
   */
  restore(surfaces: Surface[]): void {
    this._surfaceManager.restore(surfaces);
    logger.debug('从快照恢复', { surfaceCount: surfaces.length });
  }
}

/**
 * 检测 A2UI 消息的类型
 *
 * 根据消息对象中包含的字段判断其消息类型。
 * A2UI 消息通过可选字段区分类型（互斥）：
 *   - createSurface：创建渲染表面
 *   - updateComponents：更新组件列表
 *   - updateDataModel：更新数据模型
 *   - deleteSurface：删除渲染表面
 *   - callRendererFunction：Agent 请求 Renderer 执行函数（v1.0 #2210）
 *   - agentFunctionResponse：Agent 响应 callAgentFunction（v1.0 #2210）
 *
 * @param msg - A2UI 消息对象
 * @returns 消息类型字符串
 */
function detectMessageType(msg: Record<string, unknown>): string {
  if (msg['createSurface']) return 'createSurface';
  if (msg['updateComponents']) return 'updateComponents';
  if (msg['updateDataModel']) return 'updateDataModel';
  if (msg['deleteSurface']) return 'deleteSurface';
  if (msg['callRendererFunction']) return 'callRendererFunction';
  if (msg['agentFunctionResponse']) return 'agentFunctionResponse';
  return 'unknown';
}
