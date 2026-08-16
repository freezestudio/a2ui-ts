/**
 * 拓扑分析器 — 检测组件树的可及性和循环引用
 * 对应 Python: validating/topology_analyzer.py
 *
 * 核心功能：
 * 1. 构建组件邻接表（有向图）
 * 2. 从 root 出发 DFS 遍历，检测可达性
 * 3. 检测自引用和循环引用
 * 4. 检测孤立组件（从 root 不可达）
 * 5. 强制最大嵌套深度限制
 */

import { z } from 'zod';
import { MAX_GLOBAL_DEPTH, ROOT_ID } from './constants.js';
import type { ValidationError } from './validator.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 组件引用字段映射 — 记录每个组件的所有子引用 */
export const refFieldsMapSchema = z.record(z.string(), z.record(z.string(), z.array(z.string())));
export type RefFieldsMap = z.infer<typeof refFieldsMapSchema>;

/** 拓扑分析配置 */
export const topologyConfigSchema = z.object({
  /** 是否允许孤立组件（从 root 不可达） */
  allowOrphanComponents: z.boolean().optional(),
  /** 是否允许缺失 root 组件 */
  allowMissingRoot: z.boolean().optional(),
  /** 最大全局嵌套深度 */
  maxDepth: z.number().optional(),
});
export type TopologyConfig = z.infer<typeof topologyConfigSchema>;

/** 组件类型 — 带有 id 属性的对象 */
type ComponentWithId = { id?: string; [key: string]: unknown };

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 从组件列表中提取引用字段映射
 * 只提取 children/child/ChildList 中的组件引用，text/label 等字符串属性不作为引用
 */
export function extractRefFields(components: ComponentWithId[]): RefFieldsMap {
  const refFields: RefFieldsMap = {};

  for (const comp of components) {
    const compId = comp.id;
    if (!compId || typeof compId !== 'string') continue;

    refFields[compId] = {};

    const children = comp['children'];
    if (Array.isArray(children)) {
      const refs = extractReferences(children);
      if (refs.length > 0) refFields[compId]['children'] = refs;
    } else if (typeof children === 'object' && children !== null && 'componentId' in children) {
      const refs = extractReferences(children);
      if (refs.length > 0) refFields[compId]['children'] = refs;
    }

    const child = comp['child'];
    if (typeof child === 'string') refFields[compId]['child'] = [child];

    if (comp['component'] === 'Modal') {
      for (const key of ['trigger', 'content']) {
        const value = comp[key];
        if (typeof value === 'string') refFields[compId][key] = [value];
      }
    }

    if (comp['component'] === 'Tabs' && Array.isArray(comp['tabs'])) {
      const refs: string[] = [];
      for (const tab of comp['tabs'] as Array<Record<string, unknown>>) {
        const tabChild = tab?.['child'];
        if (typeof tabChild === 'string') refs.push(tabChild);
      }
      if (refs.length > 0) refFields[compId]['tabs'] = refs;
    }
  }

  return refFields;
}

/** 从值中提取组件 ID 引用 */
function extractReferences(value: unknown): string[] {
  const refs: string[] = [];

  if (typeof value === 'string') {
    refs.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        refs.push(item);
      } else if (typeof item === 'object' && item !== null && 'componentId' in item) {
        const compId = (item as Record<string, unknown>).componentId;
        if (typeof compId === 'string') refs.push(compId);
      }
    }
  } else if (typeof value === 'object' && value !== null && 'componentId' in value && 'path' in value) {
    const compId = (value as Record<string, unknown>).componentId;
    if (typeof compId === 'string') refs.push(compId);
  }

  return refs;
}

/**
 * 拓扑分析 — 检测循环引用、可达性和深度
 *
 * 返回：
 * - 从 root 可达的所有组件 ID 集合
 * - 检测到的错误列表
 */
export function analyzeTopology(
  components: ComponentWithId[],
  refFieldsMap: RefFieldsMap,
  config: TopologyConfig = {},
): { reachable: Set<string>; errors: ValidationError[] } {
  const { allowOrphanComponents = false, allowMissingRoot = false, maxDepth = MAX_GLOBAL_DEPTH } = config;

  const errors: ValidationError[] = [];
  const reachable = new Set<string>();

  // 检查 root 组件是否存在
  const hasRoot = components.some((c) => c.id === ROOT_ID);
  if (!hasRoot && !allowMissingRoot) {
    errors.push({
      path: '',
      message: `缺少根组件 (id="${ROOT_ID}")`,
    });
  }

  // 检测自引用
  for (const [compId, fields] of Object.entries(refFieldsMap)) {
    for (const [, refs] of Object.entries(fields)) {
      if (refs.includes(compId)) {
        errors.push({
          path: compId,
          message: `组件 "${compId}" 自引用`,
        });
      }
    }
  }

  // DFS 遍历 — 检测循环引用
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(nodeId: string, depth: number): void {
    if (depth > maxDepth) {
      errors.push({
        path: nodeId,
        message: `组件嵌套深度超过限制 (${depth} > ${maxDepth})`,
      });
      return;
    }

    if (visiting.has(nodeId)) {
      errors.push({
        path: nodeId,
        message: `检测到循环引用: ${nodeId}`,
      });
      return;
    }

    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    visited.add(nodeId);
    reachable.add(nodeId);

    const fields = refFieldsMap[nodeId];
    if (fields) {
      for (const [, refs] of Object.entries(fields)) {
        for (const refId of refs) {
          // 验证引用目标存在
          if (!refFieldsMap[refId]) {
            errors.push({
              path: nodeId,
              message: `悬空引用: "${nodeId}" 引用了不存在的组件 "${refId}"`,
            });
            continue;
          }
          dfs(refId, depth + 1);
        }
      }
    }

    visiting.delete(nodeId);
  }

  // 从 root 开始遍历
  if (hasRoot) {
    dfs(ROOT_ID, 0);
  }

  // 检测孤立组件
  if (!allowOrphanComponents) {
    for (const comp of components) {
      const compId = comp.id;
      if (compId && typeof compId === 'string' && !reachable.has(compId)) {
        errors.push({
          path: compId,
          message: `孤立组件: "${compId}" 从 root 不可达`,
        });
      }
    }
  }

  return { reachable, errors };
}
