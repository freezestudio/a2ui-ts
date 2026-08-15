import { computed, Signal } from '@angular/core';
import { z } from 'zod';
import { SurfaceManager } from './renderer/surface-manager.js';
import { resolvePath } from './renderer/data-binding.js';

/**
 * 校验规则
 */
export const checkRuleSchema = z.strictObject({
  condition: z.unknown(),
  message: z.string(),
});
export type CheckRule = z.infer<typeof checkRuleSchema>;

/**
 * DynamicBinding — Signal 驱动的双向绑定抽象
 *
 * @template T 绑定值的类型
 */
export interface DynamicBinding<T> {
  /** 绑定值（只读 Signal，从 DataModelStore 读取） */
  readonly value: Signal<T | undefined>;
  /** 校验错误（只读 Signal，null 表示无错误） */
  readonly error: Signal<string | null>;
  /** 作用域路径（编译时常量，非 Signal） */
  readonly scope: string;
  /** 回写值到 DataModelStore */
  write(v: T): void;
}

/**
 * 创建 DynamicBinding 实例
 *
 * @param surfaceManager - Surface 管理器
 * @param surfaceId - 目标 Surface ID
 * @param path - DataModel 中的 JSON Pointer 路径
 * @param checks - 可选的校验规则列表
 * @returns DynamicBinding<T> 实例
 */
export function createBinding<T>(
  surfaceManager: SurfaceManager,
  surfaceId: string,
  path: string,
  checks?: CheckRule[],
): DynamicBinding<T> {
  const value = computed(() => {
    const surfaces = surfaceManager.surfaces();
    const surface = surfaces.get(surfaceId);
    if (!surface) return undefined;
    return resolvePath({ path }, surface.dataModel) as T | undefined;
  });

  const error = computed(() => {
    const val = value();
    if (!checks || checks.length === 0) return null;
    for (const check of checks) {
      if (!evaluateCondition(check.condition, val)) {
        return check.message;
      }
    }
    return null;
  });

  return {
    scope: path,
    value,
    error,
    write(v: T) {
      surfaceManager.handleUpdateDataModel(surfaceId, path, v as unknown);
    },
  };
}

/**
 * 求值校验条件
 *
 * 支持的格式：
 * - { call: 'required' }: 非空校验
 * - { call: 'regex', pattern: '...' }: 正则匹配
 * - 其他: 转换为布尔值
 */
function evaluateCondition(condition: unknown, value: unknown): boolean {
  if (!condition || typeof condition !== 'object') return !!condition;
  const cond = condition as Record<string, unknown>;
  if (cond['call'] === 'required') {
    return value !== null && value !== undefined && value !== '';
  }
  if (cond['call'] === 'email') {
    if (typeof value !== 'string' || !value) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  }
  if (cond['call'] === 'regex' && typeof cond['pattern'] === 'string') {
    if (typeof value !== 'string') return false;
    try {
      return new RegExp(cond['pattern']).test(value);
    } catch (err) {
      console.debug('[DynamicBinding] 正则表达式无效:', cond['pattern'], err);
      return false;
    }
  }
  if (cond['call'] === 'and' && Array.isArray(cond['values'])) {
    return (cond['values'] as unknown[]).every((v) => evaluateCondition(v, value));
  }
  if (cond['call'] === 'or' && Array.isArray(cond['values'])) {
    return (cond['values'] as unknown[]).some((v) => evaluateCondition(v, value));
  }
  if (cond['call'] === 'not') {
    return !evaluateCondition(cond['value'], value);
  }
  return true;
}
