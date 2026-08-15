/**
 * DataContext — 无头求值作用域
 * 对应 Python: rendering/data_context.py
 *
 * 解析 A2UI 动态绑定和表达式：
 * - resolveDynamicValue: 递归求值 DataBinding/FunctionCall/字面量
 * - subscribeDynamicValue: 响应式订阅动态值变化
 * - executeFunction: 函数执行器
 */

import { z } from 'zod';
import { Subscription } from '../core/events.js';
import { DataModel } from './data-model.js';
import { Catalog } from '../catalog/catalog.js';
import { SurfaceModel } from './surface-model.js';
import { isDataBinding, isFunctionCall } from '../schema/common-types.js';
import { ExpressionParser, toStr } from '@a2ui-ts/shared';
import type { DataBinding, FunctionCall } from '../schema/common-types.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 动态值变更事件 */
export const dynamicValueChangeEventSchema = z.object({
  /** 值 */
  value: z.unknown(),
  /** 来源路径（用于调试） */
  sourcePaths: z.array(z.string()).optional(),
});
export type DynamicValueChangeEvent = z.infer<typeof dynamicValueChangeEventSchema>;

/** 变更回调 */
export type DynamicValueChangeHandler = (event: DynamicValueChangeEvent) => void;

/** DataContext 配置 */
export interface DataContextConfig {
  /** 关联的 DataModel */
  dataModel: DataModel;
  /** 关联的 Catalog（用于函数执行） */
  catalog?: Catalog;
  /** 关联的 Surface（用于错误分发） */
  surface?: SurfaceModel;
  /** 数据路径前缀（用于相对路径解析） */
  dataPathPrefix?: string;
}

// ============================================================================
// DataContext
// ============================================================================

/**
 * DataContext — 无头求值作用域
 *
 * 核心职责：
 * - 解析 DynamicValue（DataBinding → DataModel 读取 / FunctionCall → 函数执行）
 * - 响应式订阅动态值变化
 * - 函数调用执行
 */
export class DataContext {
  /** 关联的 DataModel */
  readonly dataModel: DataModel;

  /** 关联的 Catalog */
  readonly catalog: Catalog | undefined;

  /** 关联的 Surface */
  readonly surface: SurfaceModel | undefined;

  /** 数据路径前缀 */
  readonly dataPathPrefix: string;

  constructor(config: DataContextConfig) {
    this.dataModel = config.dataModel;
    this.catalog = config.catalog;
    this.surface = config.surface;
    this.dataPathPrefix = config.dataPathPrefix ?? '';
  }

  // ==========================================================================
  // 值解析
  // ==========================================================================

  /**
   * 递归求值 DynamicValue
   *
   * - DataBinding ({path}) → DataModel.get(path)
   * - FunctionCall ({call, args}) → 函数执行
   * - 字面量 → 直接返回
   * - 数组/对象 → 递归求值每个元素
   */
  resolveDynamicValue(value: unknown): unknown {
    // DataBinding
    if (isDataBinding(value)) {
      return this._resolveDataBinding(value);
    }

    // FunctionCall
    if (isFunctionCall(value)) {
      return this._executeFunctionCall(value);
    }

    // 数组 — 递归求值
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveDynamicValue(item));
    }

    // 对象（非 DataBinding/FunctionCall）— 递归求值属性
    if (typeof value === 'object' && value !== null) {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolveDynamicValue(v);
      }
      return resolved;
    }

    // 插值字符串（含 ${...}）— 解析模板并逐段求值
    if (typeof value === 'string' && value.includes('${')) {
      return this._resolveInterpolatedString(value);
    }

    // 字面量（string/number/boolean/null/undefined）
    return value;
  }

  /**
   * 解析插值字符串模板（${path} / ${call(...)}）
   *
   * 对应 Python: data_context + expression_parser 的模板插值求值，
   * 也即官方 formatString 的语义。
   */
  private _resolveInterpolatedString(template: string): string {
    const parser = new ExpressionParser();
    let parts;
    try {
      parts = parser.parse(template);
    } catch {
      return template;
    }

    if (parts.length === 0) return template;

    return parts
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'number' || typeof part === 'boolean') return toStr(part);
        if ('path' in part) {
          const val = this.resolveDynamicValue({ path: part.path });
          return val != null ? toStr(val) : '';
        }
        if ('call' in part) {
          const val = this.resolveDynamicValue(part);
          return val != null ? toStr(val) : '';
        }
        return toStr(part);
      })
      .join('');
  }

  /**
   * 响应式订阅动态值变化
   * 提取所有 path 引用，订阅 DataModel，变化时重新求值
   */
  subscribeDynamicValue(value: unknown, handler: DynamicValueChangeHandler): Subscription {
    const paths = this._extractPaths(value);
    const subscriptions: Subscription[] = [];

    // 为每个路径订阅 DataModel（subscribe 会立即以当前值回调一次，作为初始求值）
    for (const path of paths) {
      const fullPath = this._resolvePath(path);
      const sub = this.dataModel.subscribe(fullPath, () => {
        const resolved = this.resolveDynamicValue(value);
        handler({ value: resolved, sourcePaths: paths });
      });
      subscriptions.push(sub);
    }

    // 无路径引用时（纯字面量/函数参数无 path），需要显式初始求值一次
    if (paths.length === 0) {
      const initialValue = this.resolveDynamicValue(value);
      handler({ value: initialValue, sourcePaths: paths });
    }

    // 返回合并的 Subscription
    return new Subscription(() => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    });
  }

  /**
   * 解析 Action（递归求值 context 中的动态值）
   */
  resolveAction(action: {
    event?: { name: string; context?: Record<string, unknown> };
    functionCall?: FunctionCall;
  }): unknown {
    if ('event' in action && action.event) {
      const context = action.event.context;
      if (context) {
        const resolvedContext: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(context)) {
          resolvedContext[k] = this.resolveDynamicValue(v);
        }
        return { event: { name: action.event.name, context: resolvedContext } };
      }
      return action;
    }

    if ('functionCall' in action && action.functionCall) {
      const resolved = this.resolveDynamicValue(action.functionCall);
      return { functionCall: resolved };
    }

    return action;
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /** 解析 DataBinding */
  private _resolveDataBinding(binding: DataBinding): unknown {
    const fullPath = this._resolvePath(binding.path);
    return this.dataModel.get(fullPath);
  }

  /** 执行函数调用 */
  private _executeFunctionCall(call: FunctionCall): unknown {
    if (!this.catalog) {
      throw new Error(`函数调用 "${call.call}" 需要 Catalog 但当前 DataContext 未绑定 Catalog`);
    }

    const fn = this.catalog.getFunction(call.call);
    if (!fn) {
      const error = `函数 "${call.call}" 未在 Catalog 中注册`;
      if (this.surface) {
        this.surface.dispatchError({
          code: 'FUNCTION_NOT_FOUND',
          surfaceId: this.surface.surfaceId,
          message: error,
        });
      }
      throw new Error(error);
    }

    if (!fn.execute) {
      return undefined;
    }

    // 递归解析参数
    const resolvedArgs: Record<string, unknown> = {};
    if (call.args) {
      for (const [k, v] of Object.entries(call.args)) {
        resolvedArgs[k] = this.resolveDynamicValue(v);
      }
    }

    try {
      return fn.execute(resolvedArgs, {
        surfaceId: this.surface?.surfaceId,
      });
    } catch (error) {
      if (this.surface) {
        this.surface.dispatchError({
          code: 'FUNCTION_EXECUTION_ERROR',
          surfaceId: this.surface.surfaceId,
          message: `函数 "${call.call}" 执行失败: ${String(error as string | number | bigint | symbol)}`,
        });
      }
      throw error;
    }
  }

  /** 从 DynamicValue 中提取所有 path 引用 */
  private _extractPaths(value: unknown): string[] {
    const paths: string[] = [];

    if (isDataBinding(value)) {
      paths.push(value.path);
    } else if (isFunctionCall(value)) {
      // 函数参数中的路径
      if (value.args) {
        for (const argValue of Object.values(value.args)) {
          paths.push(...this._extractPaths(argValue));
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        paths.push(...this._extractPaths(item));
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const v of Object.values(value)) {
        paths.push(...this._extractPaths(v));
      }
    } else if (typeof value === 'string' && value.includes('${')) {
      // 插值字符串 — 提取模板中的路径引用
      paths.push(...this._extractInterpolatedPaths(value));
    }

    return [...new Set(paths)];
  }

  /** 从插值字符串模板中提取路径引用 */
  private _extractInterpolatedPaths(template: string): string[] {
    const parser = new ExpressionParser();
    let parts;
    try {
      parts = parser.parse(template);
    } catch {
      return [];
    }

    const paths: string[] = [];
    for (const part of parts) {
      if (typeof part === 'string') continue;
      if (typeof part === 'number' || typeof part === 'boolean') continue;
      if ('path' in part) {
        paths.push(part.path);
      } else if ('call' in part && part.args) {
        for (const argValue of Object.values(part.args)) {
          paths.push(...this._extractPaths(argValue));
        }
      }
    }
    return paths;
  }

  /** 解析路径（处理相对路径前缀） */
  private _resolvePath(path: string): string {
    if (path.startsWith('/') || !this.dataPathPrefix) {
      return path;
    }
    return `${this.dataPathPrefix}/${path}`;
  }
}
