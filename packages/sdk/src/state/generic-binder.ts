/**
 * GenericBinder — 响应式属性绑定器
 * 对应 Python: rendering/generic_binder.py
 *
 * 将组件属性响应式绑定到 DataModel，包含 CheckRule 验证
 *
 * 核心流程：
 * 1. _rebuildAllBindings — 清理旧绑定，重新绑定所有属性
 * 2. _bindProperty — 检测 DynamicValue 类型，订阅变化
 * 3. _bindChecks — 为每个 CheckRule 订阅条件变化
 */

import { z } from 'zod';
import { Subscription } from '../core/events.js';
import { EventSource } from '../core/events.js';
import { DataContext } from './data-context.js';
import { ComponentModel } from './component-model.js';
import { isDataBinding, isFunctionCall } from '../schema/common-types.js';
import { CheckRuleSchema, type CheckRule } from '../schema/common-types.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 校验规则结果 */
export const checkRuleResultSchema = z.object({
  /** 规则 */
  rule: CheckRuleSchema,
  /** 条件求值结果 */
  conditionResult: z.boolean(),
  /** 是否通过 */
  passed: z.boolean(),
});
export type CheckRuleResult = z.infer<typeof checkRuleResultSchema>;

/** 绑定结果事件 */
export const bindingResultEventSchema = z.object({
  /** 绑定后的属性值 */
  resolvedProps: z.record(z.string(), z.unknown()),
  /** 校验结果 */
  checkResults: z.array(checkRuleResultSchema),
});
export type BindingResultEvent = z.infer<typeof bindingResultEventSchema>;

// ============================================================================
// GenericBinder
// ============================================================================

/**
 * GenericBinder — 响应式属性绑定器
 *
 * 将组件的动态属性绑定到 DataModel，自动解析和订阅变化
 */
export class GenericBinder {
  /** 组件 Model */
  readonly componentModel: ComponentModel;

  /** DataContext */
  readonly dataContext: DataContext;

  /** 绑定结果事件 */
  readonly onResolved = new EventSource<BindingResultEvent>();

  /** 当前已解析的属性 */
  private _resolvedProps: Record<string, unknown> = {};

  /** 校验规则结果 */
  private _checkResults: CheckRuleResult[] = [];

  /** 活跃的订阅 */
  private _subscriptions: Subscription[] = [];

  /** 标准属性键（排除 id、component 等非动态属性） */
  private static readonly NON_BINDABLE_KEYS = new Set(['id', 'component']);

  constructor(componentModel: ComponentModel, dataContext: DataContext) {
    this.componentModel = componentModel;
    this.dataContext = dataContext;

    // 监听组件属性变更，重新绑定
    componentModel.onUpdated.subscribe(() => {
      this._rebuildAllBindings();
    });

    // 初始绑定
    this._rebuildAllBindings();
  }

  /** 获取当前已解析的属性 */
  get resolvedProps(): Record<string, unknown> {
    return { ...this._resolvedProps };
  }

  /** 获取校验结果 */
  get checkResults(): CheckRuleResult[] {
    return [...this._checkResults];
  }

  /**
   * 注册监听器
   * 立即以当前结果调用 handler，之后每次变化时调用
   */
  subscribe(handler: (event: BindingResultEvent) => void): Subscription {
    // 立即回调当前结果
    handler({
      resolvedProps: this._resolvedProps,
      checkResults: this._checkResults,
    });

    return this.onResolved.subscribe(handler);
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /**
   * 重新构建所有绑定
   */
  private _rebuildAllBindings(): void {
    // 清理旧订阅
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions = [];

    // 重新解析属性
    this._resolvedProps = {};
    this._checkResults = [];

    const props = this.componentModel.properties;

    // 绑定标准属性
    for (const [key, value] of Object.entries(props)) {
      if (GenericBinder.NON_BINDABLE_KEYS.has(key)) {
        this._resolvedProps[key] = value;
        continue;
      }

      if (key === 'checks') {
        this._bindChecks(value as CheckRule[]);
        continue;
      }

      this._bindProperty(key, value);
    }

    // 通知监听器
    this.onResolved.emit({
      resolvedProps: this._resolvedProps,
      checkResults: this._checkResults,
    });
  }

  /**
   * 绑定单个属性
   */
  private _bindProperty(key: string, value: unknown): void {
    // 检测动态值类型
    if (isDataBinding(value) || isFunctionCall(value)) {
      // 订阅动态值变化
      const sub = this.dataContext.subscribeDynamicValue(value, (event) => {
        this._resolvedProps[key] = event.value;
        this._notifyListeners();
      });
      this._subscriptions.push(sub);
    } else if (typeof value === 'string' && /\$\{[^}]+\}/.test(value)) {
      // 插值字符串 — 响应式订阅（对齐 Python: is_interpolatable → subscribe_dynamic_value）
      const sub = this.dataContext.subscribeDynamicValue(value, (event) => {
        this._resolvedProps[key] = event.value;
        this._notifyListeners();
      });
      this._subscriptions.push(sub);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 递归展开对象属性（但不订阅）
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.dataContext.resolveDynamicValue(v);
      }
      this._resolvedProps[key] = resolved;
    } else {
      // 静态值
      this._resolvedProps[key] = value;
    }
  }

  /**
   * 绑定校验规则
   */
  private _bindChecks(checks: CheckRule[]): void {
    if (!Array.isArray(checks)) return;

    for (const rule of checks) {
      const sub = this.dataContext.subscribeDynamicValue(rule.condition, (event) => {
        const conditionResult = Boolean(event.value);
        const result: CheckRuleResult = {
          rule,
          conditionResult,
          passed: conditionResult,
        };

        // 更新校验结果
        const existingIndex = this._checkResults.findIndex((r) => r.rule === rule);
        if (existingIndex >= 0) {
          this._checkResults[existingIndex] = result;
        } else {
          this._checkResults.push(result);
        }

        // 注入校验状态到属性
        this._resolvedProps['isValid'] = this._checkResults.every((r) => r.passed);
        this._resolvedProps['validationErrors'] = this._checkResults
          .filter((r) => !r.passed)
          .map((r) => r.rule.message);

        this._notifyListeners();
      });
      this._subscriptions.push(sub);
    }
  }

  /** 通知监听器 */
  private _notifyListeners(): void {
    this.onResolved.emit({
      resolvedProps: this._resolvedProps,
      checkResults: this._checkResults,
    });
  }

  /** 销毁 */
  dispose(): void {
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions = [];
    this.onResolved.dispose();
  }
}
