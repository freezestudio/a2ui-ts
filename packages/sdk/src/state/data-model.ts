/**
 * DataModel — 基于 RFC 6901 JSON Pointer 的原子响应式键值存储
 * 对应 Python: state/data_model.py
 *
 * 核心能力：
 * - 通过 JSON Pointer 路径读写数据
 * - auto-vivification：自动创建不存在的中间路径
 * - 路径订阅：subscribe(path, callback) 监听特定路径变化
 * - 级联通知：值变化时通知所有父路径和子路径的订阅者
 */

import { z } from 'zod';
import { Subscription } from '../core/events.js';
import { FORBIDDEN_KEYS } from '@freezestudio/a2ui-shared';
import { parsePointer, serializePointer, normalizePath } from './path-utils.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 路径变更事件载荷 */
export const dataModelChangeEventSchema = z.object({
  /** 变更的路径 */
  path: z.string(),
  /** 变更后的值（undefined 表示删除） */
  value: z.unknown(),
});
export type DataModelChangeEvent = z.infer<typeof dataModelChangeEventSchema>;

/** 路径订阅回调 */
export type DataModelChangeHandler = (event: DataModelChangeEvent) => void;

// ============================================================================
// DataModel
// ============================================================================

/**
 * DataModel — 响应式键值存储
 *
 * 数据存储为嵌套的 object/array 结构，通过 JSON Pointer 路径访问。
 * 支持：
 * - get(path): 读取路径处的值
 * - set(path, value): 设置路径处的值（value=undefined 表示删除）
 * - hasPath(path): 检查路径是否存在
 * - subscribe(path, handler): 订阅路径变化
 */
export class DataModel {
  private _data: Record<string, unknown> = {};
  /** 路径 → 订阅者集合 */
  private _subscriptions = new Map<string, Set<DataModelChangeHandler>>();

  // ==========================================================================
  // 数据访问
  // ==========================================================================

  /**
   * 获取路径处的值
   * @param path - JSON Pointer 路径（如 "/user/name"）
   * @returns 路径处的值，不存在时返回 undefined
   */
  get(path: string = ''): unknown {
    const normalizedPath = normalizePath(path);
    if (normalizedPath === '') {
      return this._data;
    }

    const tokens = parsePointer(normalizedPath);
    for (const token of tokens) {
      if (FORBIDDEN_KEYS.has(token)) {
        throw new Error(`Forbidden path segment '${token}' in path '${path}'`);
      }
    }
    let current: unknown = this._data;

    for (const token of tokens) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = parseInt(token, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[token];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 设置路径处的值
   * - value 为 undefined 或 null 时删除该路径（协议 updateDataModel 语义）
   * - 自动创建不存在的中间路径（auto-vivification）
   * - 中间路径类型根据下一个 token 推断（数字 → array，否则 → object）
   *
   * @param path - JSON Pointer 路径
   * @param value - 要设置的值（undefined 或 null 表示删除）
   */
  set(path: string, value: unknown): void {
    const normalizedPath = normalizePath(path);
    // 非原始类型值做深拷贝，防止引用意外共享
    const clonedValue = typeof value === 'object' && value !== null ? structuredClone(value) : value;

    if (normalizedPath === '') {
      // 设置根路径
      if (typeof clonedValue === 'object' && clonedValue !== null && !Array.isArray(clonedValue)) {
        this._data = clonedValue as Record<string, unknown>;
      } else {
        this._data = {};
      }
      this._triggerCascade(normalizedPath, this._data);
      return;
    }

    const tokens = parsePointer(normalizedPath);
    for (const token of tokens) {
      if (FORBIDDEN_KEYS.has(token)) {
        throw new Error(`Forbidden path segment '${token}' in path '${path}'`);
      }
    }
    if (tokens.length === 0) {
      this._triggerCascade(normalizedPath, clonedValue);
      return;
    }

    // 遍历到倒数第二个 token，创建中间路径
    let current: Record<string, unknown> = this._data;

    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];
      const key = this._resolveArrayIndex(current, token);

      if (key === null) {
        // 路径不存在，自动创建
        const isNextIndex = /^\d+$/.test(nextToken);
        const newContainer = isNextIndex ? [] : {};
        this._setAtContainer(current, token, newContainer);
        current = newContainer as Record<string, unknown>;
      } else {
        const existing = Array.isArray(current) ? (current as unknown[])[key as number] : current[key as string];

        if (existing === null || existing === undefined || typeof existing !== 'object') {
          // 路径存在但值不是容器，覆盖创建
          const isNextIndex = /^\d+$/.test(nextToken);
          const newContainer = isNextIndex ? [] : {};
          this._setAtContainer(current, token, newContainer);
          current = newContainer as Record<string, unknown>;
        } else {
          current = existing as Record<string, unknown>;
        }
      }
    }

    // 设置最终值
    const lastToken = tokens[tokens.length - 1];

    if (clonedValue === undefined || clonedValue === null) {
      // 删除（协议：value 为 null/undefined 即删除键）
      this._deleteAtContainer(current, lastToken);
    } else {
      this._setAtContainer(current, lastToken, clonedValue);
    }

    this._triggerCascade(normalizedPath, clonedValue);
  }

  /**
   * 检查路径是否存在
   */
  hasPath(path: string): boolean {
    return this.get(path) !== undefined;
  }

  // ==========================================================================
  // 订阅系统
  // ==========================================================================

  /**
   * 订阅路径变化
   * 立即以当前值调用 handler，之后每次路径变化时调用
   *
   * @param path - 要订阅的路径
   * @param handler - 变更回调
   * @returns Subscription 句柄
   */
  subscribe(path: string, handler: DataModelChangeHandler): Subscription {
    const normalizedPath = normalizePath(path);

    if (!this._subscriptions.has(normalizedPath)) {
      this._subscriptions.set(normalizedPath, new Set());
    }
    this._subscriptions.get(normalizedPath)!.add(handler);

    // 立即以当前值调用
    const currentValue = normalizedPath === '' ? this._data : this.get(normalizedPath);
    handler({ path: normalizedPath, value: currentValue });

    return new Subscription(() => {
      const handlers = this._subscriptions.get(normalizedPath);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._subscriptions.delete(normalizedPath);
        }
      }
    });
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /**
   * 触发级联通知 — 先冒泡到父路径，再级联到子路径
   */
  private _triggerCascade(path: string, value: unknown): void {
    const event: DataModelChangeEvent = { path, value };

    // 1. Bubble Up — 通知所有父路径
    const tokens = path === '' ? [] : parsePointer(path);
    for (let i = tokens.length; i >= 0; i--) {
      const parentPath = serializePointer(tokens.slice(0, i));
      this._notifySubscribers(parentPath, event);
    }

    // 2. Cascade Down — 通知所有匹配的子路径
    for (const subscribedPath of this._subscriptions.keys()) {
      if (subscribedPath !== path && subscribedPath.startsWith(path === '' ? '/' : path + '/')) {
        const childValue = this.get(subscribedPath);
        this._notifySubscribers(subscribedPath, { path: subscribedPath, value: childValue });
      }
    }
  }

  /** 通知特定路径的订阅者 */
  private _notifySubscribers(path: string, event: DataModelChangeEvent): void {
    const handlers = this._subscriptions.get(path);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  /** 解析容器中的 key（支持数组索引） */
  private _resolveArrayIndex(container: Record<string, unknown>, token: string): string | number | null {
    if (Array.isArray(container)) {
      const index = parseInt(token, 10);
      if (!isNaN(index) && index >= 0 && index < container.length) {
        return index;
      }
      return null;
    }
    return token in container ? token : null;
  }

  /** 在容器中设置值 */
  private _setAtContainer(container: Record<string, unknown>, key: string, value: unknown): void {
    if (Array.isArray(container)) {
      const index = parseInt(key, 10);
      if (!isNaN(index)) {
        (container as unknown[])[index] = value;
      }
    } else {
      container[key] = value;
    }
  }

  /** 在容器中删除值 */
  private _deleteAtContainer(container: Record<string, unknown>, key: string): void {
    if (Array.isArray(container)) {
      const index = parseInt(key, 10);
      if (!isNaN(index) && index >= 0 && index < container.length) {
        (container as unknown[]).splice(index, 1);
      }
    } else {
      delete container[key];
    }
  }

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /** 销毁 — 清除所有订阅 */
  dispose(): void {
    this._subscriptions.clear();
  }
}
