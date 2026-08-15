/**
 * ComponentNode — 视图层级中已解析的活组件实例
 * 对应 Python: state/component_node.py
 *
 * 持有解析后的组件属性（通过 Signal），支持响应式更新和自清理
 */

import { z } from 'zod';
import { Signal, EventSource, Subscription } from '../core/events.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 组件销毁事件 */
export const componentNodeDestroyedEventSchema = z.object({
  instanceId: z.string(),
  componentId: z.string(),
});
export type ComponentNodeDestroyedEvent = z.infer<typeof componentNodeDestroyedEventSchema>;

/** 占位符标记 — 表示组件尚未解析 */
export const PLACEHOLDER = Symbol('Placeholder');
export type Placeholder = typeof PLACEHOLDER;

// ============================================================================
// ComponentNode
// ============================================================================

/**
 * ComponentNode — 视图树中活着的、完全解析的组件实例节点
 *
 * 特性：
 * - instanceId: `{componentId}-[{normalizedPath}]`
 * - props: 响应式属性 Signal
 * - onDestroyed: 销毁事件
 * - dispose(): 幂等销毁，执行所有清理回调
 */
export class ComponentNode {
  /** 实例 ID（唯一标识一个节点实例） */
  readonly instanceId: string;

  /** 组件 ID（对应 ComponentModel 的 id） */
  readonly componentId: string;

  /** 组件类型 */
  readonly type: string;

  /** 数据路径 */
  readonly dataPath: string;

  /** 响应式属性 */
  readonly props: Signal<Record<string, unknown>>;

  /** 销毁事件源 */
  readonly onDestroyed = new EventSource<ComponentNodeDestroyedEvent>();

  /** 清理回调栈 */
  private _cleanupCallbacks: Array<() => void> = [];

  /** 是否已销毁 */
  private _disposed = false;

  /** 子节点映射 */
  private _children = new Map<string, ComponentNode>();

  constructor(
    instanceId: string,
    componentId: string,
    type: string,
    dataPath: string,
    initialProps: Record<string, unknown> = {},
  ) {
    this.instanceId = instanceId;
    this.componentId = componentId;
    this.type = type;
    this.dataPath = dataPath;
    this.props = new Signal(initialProps);
  }

  // ==========================================================================
  // 子节点管理
  // ==========================================================================

  /** 获取子节点 */
  getChild(instanceId: string): ComponentNode | undefined {
    return this._children.get(instanceId);
  }

  /** 设置子节点 */
  setChild(instanceId: string, node: ComponentNode): void {
    this._children.set(instanceId, node);
  }

  /** 删除子节点 */
  removeChild(instanceId: string): ComponentNode | undefined {
    const child = this._children.get(instanceId);
    if (child) {
      this._children.delete(instanceId);
    }
    return child;
  }

  /** 获取所有子节点 */
  getChildren(): Map<string, ComponentNode> {
    return this._children;
  }

  // ==========================================================================
  // 清理管理
  // ==========================================================================

  /**
   * 注册清理回调 — 在 dispose() 时调用
   */
  addCleanup(callback: () => void): void {
    this._cleanupCallbacks.push(callback);
  }

  /**
   * 添加订阅（自动在销毁时取消）
   */
  trackSubscription(sub: Subscription): void {
    this.addCleanup(() => sub.unsubscribe());
  }

  // ==========================================================================
  // 序列化
  // ==========================================================================

  /**
   * 递归序列化节点树为字典
   * 支持 Signal 展开、Placeholder 标记
   */
  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      instanceId: this.instanceId,
      componentId: this.componentId,
      type: this.type,
      dataPath: this.dataPath,
      props: this._resolveProps(this.props.peek()),
    };

    if (this._children.size > 0) {
      result.children = {};
      for (const [childId, child] of this._children) {
        (result.children as Record<string, unknown>)[childId] = child.toDict();
      }
    }

    return result;
  }

  /** 解析属性值（展开 Signal，标记 Action） */
  private _resolveProps(props: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(props)) {
      if (value instanceof Signal) {
        resolved[key] = (value as Signal<unknown>).peek();
      } else if (typeof value === 'function') {
        resolved[key] = '<Action>';
      } else if (value === PLACEHOLDER) {
        resolved[key] = '<Placeholder>';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        resolved[key] = this._resolveProps(value as Record<string, unknown>);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /**
   * 销毁 — 幂等操作，执行所有清理回调
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    // 递归销毁子节点
    for (const child of this._children.values()) {
      child.dispose();
    }
    this._children.clear();

    // 执行清理回调（倒序）
    for (let i = this._cleanupCallbacks.length - 1; i >= 0; i--) {
      this._cleanupCallbacks[i]();
    }
    this._cleanupCallbacks = [];

    // 销毁 Signal 和 EventSource
    this.props.dispose();
    this.onDestroyed.emit({ instanceId: this.instanceId, componentId: this.componentId });
    this.onDestroyed.dispose();
  }

  /** 是否已销毁 */
  get disposed(): boolean {
    return this._disposed;
  }
}
