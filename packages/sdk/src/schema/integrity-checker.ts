/**
 * 完整性检查器 — 组件 ID 唯一性、路径有效性、递归深度
 * 对应 Python: validating/integrity_checker.py
 *
 * 核心功能：
 * 1. 检查组件 ID 唯一性
 * 2. 检查 root 组件存在性
 * 3. 检查悬空引用（引用的子组件不存在）
 * 4. 检查函数调用嵌套深度
 * 5. 检查 JSON Pointer 路径语法
 */

import { ROOT_ID, MAX_FUNC_CALL_DEPTH } from './constants.js';
import type { ValidationError } from './validator.js';

// ============================================================================
// 组件完整性检查
// ============================================================================

/**
 * 检查组件列表的完整性
 * - ID 唯一性
 * - root 存在性
 * - 悬空引用检查
 */
export function checkComponentIntegrity(
  components: Array<{ id?: string; [key: string]: unknown }>,
  options: {
    allowMissingRoot?: boolean;
  } = {},
): ValidationError[] {
  const { allowMissingRoot = false } = options;
  const errors: ValidationError[] = [];
  const idSet = new Set<string>();
  const componentIds = new Set(components.map((c) => c.id).filter((id): id is string => typeof id === 'string'));

  for (const comp of components) {
    const id = comp.id;
    if (!id || typeof id !== 'string') {
      errors.push({
        path: '',
        message: '组件缺少 id 字段',
      });
      continue;
    }

    // 检查 ID 唯一性
    if (idSet.has(id)) {
      errors.push({
        path: id,
        message: `组件 ID 重复: "${id}"`,
      });
    }
    idSet.add(id);

    // 检查子引用是否存在
    const childRefs = extractChildReferences(comp);
    for (const refId of childRefs) {
      if (!componentIds.has(refId)) {
        errors.push({
          path: `${id}`,
          message: `悬空引用: 组件 "${id}" 引用了不存在的子组件 "${refId}"`,
        });
      }
    }
  }

  // 检查 root 存在性
  if (!idSet.has(ROOT_ID) && !allowMissingRoot) {
    errors.push({
      path: '',
      message: `缺少根组件 (id="${ROOT_ID}")`,
    });
  }

  return errors;
}

/** 从组件中提取所有子组件引用 ID（只识别已建模的结构字段） */
function extractChildReferences(comp: Record<string, unknown>): string[] {
  const refs: string[] = [];

  const children = comp['children'];
  if (Array.isArray(children)) {
    for (const item of children) {
      if (typeof item === 'string') refs.push(item);
    }
  } else if (typeof children === 'object' && children !== null && 'componentId' in children) {
    const compId = (children as Record<string, unknown>).componentId;
    if (typeof compId === 'string') refs.push(compId);
  }

  const child = comp['child'];
  if (typeof child === 'string') refs.push(child);

  if (comp['component'] === 'Modal') {
    for (const key of ['trigger', 'content']) {
      const value = comp[key];
      if (typeof value === 'string') refs.push(value);
    }
  }

  if (comp['component'] === 'Tabs' && Array.isArray(comp['tabs'])) {
    for (const tab of comp['tabs'] as Array<Record<string, unknown>>) {
      const tabChild = tab?.['child'];
      if (typeof tabChild === 'string') refs.push(tabChild);
    }
  }

  return refs;
}

// ============================================================================
// 递归深度检查
// ============================================================================

/**
 * 检查函数调用嵌套深度
 */
export function checkFunctionCallDepth(components: Array<{ id?: string; [key: string]: unknown }>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const comp of components) {
    const id = comp.id;
    if (!id || typeof id !== 'string') continue;

    // 检查组件属性中的函数调用
    for (const [key, value] of Object.entries(comp)) {
      const depth = countFunctionCallDepth(value, 0);
      if (depth > MAX_FUNC_CALL_DEPTH) {
        errors.push({
          path: `${id}.${key}`,
          message: `函数调用嵌套深度超过限制 (${depth} > ${MAX_FUNC_CALL_DEPTH})`,
        });
      }
    }
  }

  return errors;
}

/** 递归计算函数调用嵌套深度 */
function countFunctionCallDepth(value: unknown, currentDepth: number): number {
  if (currentDepth > MAX_FUNC_CALL_DEPTH + 1) {
    return currentDepth;
  }

  if (typeof value !== 'object' || value === null) {
    return currentDepth;
  }

  const obj = value as Record<string, unknown>;

  if ('call' in obj && 'args' in obj) {
    const newDepth = currentDepth + 1;
    const args = obj.args;
    if (typeof args === 'object' && args !== null) {
      let maxChildDepth = newDepth;
      for (const argValue of Object.values(args as Record<string, unknown>)) {
        const childDepth = countFunctionCallDepth(argValue, newDepth);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      return maxChildDepth;
    }
    return newDepth;
  }

  // 数组
  if (Array.isArray(value)) {
    let maxDepth = currentDepth;
    for (const item of value) {
      const itemDepth = countFunctionCallDepth(item, currentDepth);
      maxDepth = Math.max(maxDepth, itemDepth);
    }
    return maxDepth;
  }

  // 普通对象
  let maxDepth = currentDepth;
  for (const v of Object.values(obj)) {
    if (v !== value) {
      const childDepth = countFunctionCallDepth(v, currentDepth);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

// ============================================================================
// 路径语法检查
// ============================================================================

/** 宽松路径模式 — 支持 JSON Pointer 转义 (~0, ~1) */
const RELAXED_PATH_PATTERN = /^(\/[^/]*(\/[^/]*)*)?$/;

/**
 * 检查 JSON Pointer 路径语法
 */
export function validatePathSyntax(path: string): boolean {
  if (path === '' || path === '/') return true;
  return RELAXED_PATH_PATTERN.test(path);
}

/**
 * 检查组件中所有路径字段的语法
 */
export function checkPathSyntax(components: Array<{ id?: string; [key: string]: unknown }>): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const comp of components) {
    const id = comp.id;
    if (!id || typeof id !== 'string') continue;

    for (const [key, value] of Object.entries(comp)) {
      // 检查 DataBinding 的 path 字段
      if (
        typeof value === 'object' &&
        value !== null &&
        'path' in value &&
        typeof (value as Record<string, unknown>).path === 'string'
      ) {
        const path = (value as Record<string, unknown>).path as string;
        if (!validatePathSyntax(path)) {
          errors.push({
            path: `${id}.${key}.path`,
            message: `无效的路径语法: "${path}"`,
          });
        }
      }
    }
  }

  return errors;
}
