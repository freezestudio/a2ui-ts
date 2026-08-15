/**
 * 响应式事件系统 — Signal, EventSource, Subscription, AbortSignal
 * 对应 Python: common/events.py
 *
 * 提供响应式编程基础设施：
 * - Signal: 带类型的响应式值（类似 Preact Signal / BehaviorSubject）
 * - EventSource: 多播事件发射器
 * - Subscription: 可取消的订阅句柄
 * - AbortSignal: 取消令牌
 */

// ============================================================================
// Subscription — 可取消的订阅句柄
// ============================================================================

/**
 * 订阅句柄 — 包装取消回调
 */
export class Subscription {
  private _cancelled = false;
  private _cancel: () => void;

  constructor(cancel: () => void) {
    this._cancel = cancel;
  }

  /** 取消订阅 */
  unsubscribe(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      this._cancel();
    }
  }

  /** 是否已取消 */
  get cancelled(): boolean {
    return this._cancelled;
  }
}

// ============================================================================
// EventSource — 多播事件发射器
// ============================================================================

/**
 * 事件处理函数类型
 */
export type EventHandler<T = void> = (payload: T) => void;

/**
 * EventSource — 多播事件发射器
 * 支持订阅/取消订阅，并发安全
 */
export class EventSource<T = void> {
  private _listeners = new Set<EventHandler<T>>();
  private _disposed = false;

  /**
   * 订阅事件
   * 返回 Subscription 句柄，可调用 unsubscribe() 取消
   */
  subscribe(handler: EventHandler<T>): Subscription {
    if (this._disposed) {
      throw new Error('EventSource 已销毁');
    }

    this._listeners.add(handler);

    return new Subscription(() => {
      this._listeners.delete(handler);
    });
  }

  /**
   * 发射事件 — 通知所有监听器
   * 使用快照迭代，防止并发修改
   */
  emit(payload: T): void {
    if (this._disposed) return;

    // 使用快照防止迭代中修改 Set
    const snapshot = [...this._listeners];
    for (const handler of snapshot) {
      handler(payload);
    }
  }

  /** 监听器数量 */
  get listenerCount(): number {
    return this._listeners.size;
  }

  /** 是否有监听器 */
  get hasListeners(): boolean {
    return this._listeners.size > 0;
  }

  /**
   * 销毁 — 清除所有监听器
   */
  dispose(): void {
    this._disposed = true;
    this._listeners.clear();
  }
}

// ============================================================================
// Signal — 响应式值
// ============================================================================

/**
 * Signal — 响应式值容器（类似 Preact Signal）
 *
 * 特性：
 * - 值变化时自动通知所有订阅者
 * - 只有值实际变化时才触发通知（!= 比较）
 * - 订阅时立即返回当前值
 */
export class Signal<T> {
  private _value: T;
  private _onChanged = new EventSource<T>();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  /** 获取当前值 */
  get value(): T {
    return this._value;
  }

  /** 设置新值 — 仅在值实际变化时触发通知 */
  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._onChanged.emit(newValue);
    }
  }

  /** 无副作用地读取当前值（不触发任何订阅） */
  peek(): T {
    return this._value;
  }

  /**
   * 订阅值变化
   * 立即以当前值调用 handler，之后每次值变化时调用
   */
  subscribe(handler: EventHandler<T>): Subscription {
    // 立即返回当前值
    handler(this._value);
    return this._onChanged.subscribe(handler);
  }

  /** 订阅值变化（不立即返回当前值） */
  onValueChanged(handler: EventHandler<T>): Subscription {
    return this._onChanged.subscribe(handler);
  }

  /** 销毁 */
  dispose(): void {
    this._onChanged.dispose();
  }

  [Symbol.toStringTag] = 'Signal';

  toString(): string {
    return `Signal(${String(this._value as string | number | bigint | symbol)})`;
  }
}

// ============================================================================
// AbortSignal — 取消令牌
// ============================================================================

/** 取消事件类型 */
export type AbortEventType = 'abort';

/**
 * AbortSignal — 取消令牌
 * 兼容标准 AbortSignal 的接口风格
 */
export class A2uiAbortSignal {
  private _aborted = false;
  private _onAbort = new EventSource<void>();

  /** 是否已取消 */
  get aborted(): boolean {
    return this._aborted;
  }

  /** 触发取消 */
  abort(): void {
    if (!this._aborted) {
      this._aborted = true;
      this._onAbort.emit();
    }
  }

  /**
   * 添加取消事件监听
   * 如果在 abort() 之后注册，handler 立即执行
   */
  addEventListener(type: AbortEventType, handler: () => void): void {
    if (type !== 'abort') return;

    if (this._aborted) {
      // 已取消，立即执行
      handler();
      return;
    }

    this._onAbort.subscribe(handler);
  }

  /** 销毁 */
  dispose(): void {
    this._onAbort.dispose();
  }
}
