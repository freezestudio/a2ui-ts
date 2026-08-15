/**
 * 对象工具 — 深合并/深克隆/危险键防护
 *
 * 原属 @geo/shared，下沉到本包使 A2UI 协议 SDK 可独立复用。
 */

/** 递归深合并对象（source 覆盖 target，忽略 undefined） */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>) as T[typeof key];
    } else if (val !== undefined) {
      result[key] = val as T[typeof key];
    }
  }
  return result;
}

/** 深克隆（基于 structuredClone） */
export function deepClone<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    return structuredClone(value);
  }
  return value;
}

/** 危险路径键（原型污染防护） */
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** 判断键是否安全（非危险键） */
export function isSafeKey(key: string): boolean {
  return !FORBIDDEN_KEYS.has(key);
}
