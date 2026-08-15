/**
 * 组合约束校验器 — allowedParents / allowedChildren + Surface 容器
 * 对应 A2UI v1.0 规范（上游 d849f485 新增）：
 * - createSurface 视为隐式实例化 Surface 容器（child: "root" 固定，不可被 updateComponents 修改）
 * - 组件 schema 顶层可声明 allowedParents / allowedChildren（可选，缺省允许所有父/子类型）
 * - 违反约束时错误码分别为 UNALLOWED_PARENT / UNALLOWED_CHILD
 *
 * 校验视角：Surface 作为顶层容器父节点，id="root" 组件挂载为其 child。
 * 因此 root 组件的父类型在约束判断中视为 "Surface"。
 */

import { ROOT_ID } from './constants.js';
import type { ValidationError } from './validator.js';

/** 协议保留的 Surface 容器组件名（Catalog 中禁止定义同名组件） */
export const SURFACE_COMPONENT = 'Surface' as const;

/** 组合约束错误码 */
export const UNALLOWED_PARENT = 'UNALLOWED_PARENT' as const;
export const UNALLOWED_CHILD = 'UNALLOWED_CHILD' as const;

/** 组件组合约束（来自组件 schema 顶层） */
export interface CompositionConstraints {
  /** 允许作为父组件出现的组件类型名列表；缺省（undefined）= 允许所有 */
  allowedParents?: string[];
  /** 允许作为子组件出现的组件类型名列表；缺省（undefined）= 允许所有 */
  allowedChildren?: string[];
}

/** 组件类型名 → 组合约束 的解析器（通常来自 Catalog） */
export type CompositionConstraintResolver = (componentType: string) => CompositionConstraints | undefined;

/** 待校验的组件（含 id/component/children/child） */
type ComponentLike = { id?: string; component?: string; [key: string]: unknown };

/** 遍历得到的父子关系对 */
interface ParentChildPair {
  parentId: string;
  parentType: string;
  childId: string;
  childType: string;
}

/**
 * 从组件列表中提取全部父子关系对（children 数组 / child 单引用 / object 模板模式）
 */
export function extractParentChildPairs(components: ComponentLike[]): ParentChildPair[] {
  const byId = new Map<string, ComponentLike>();
  for (const comp of components) {
    if (typeof comp.id === 'string') byId.set(comp.id, comp);
  }

  const pairs: ParentChildPair[] = [];
  for (const comp of components) {
    const parentId = comp.id;
    const parentType = comp.component;
    if (typeof parentId !== 'string' || typeof parentType !== 'string') continue;

    for (const childId of collectChildIds(comp)) {
      const child = byId.get(childId);
      if (!child) continue; // 悬空引用由完整性检查负责
      const childType = child.component;
      if (typeof childType !== 'string') continue;
      pairs.push({ parentId, parentType, childId, childType });
    }
  }
  return pairs;
}

/** 收集组件声明引用的子组件 ID（ChildList array / object 模板 / child 单引用） */
function collectChildIds(comp: ComponentLike): string[] {
  const ids: string[] = [];
  const children = comp['children'];
  const child = comp['child'];

  if (Array.isArray(children)) {
    for (const item of children) {
      if (typeof item === 'string') ids.push(item);
    }
  } else if (typeof children === 'object' && children !== null) {
    const componentId = (children as Record<string, unknown>)['componentId'];
    if (typeof componentId === 'string') ids.push(componentId);
  }

  if (typeof child === 'string') {
    ids.push(child);
  } else if (typeof child === 'object' && child !== null) {
    const componentId = (child as Record<string, unknown>)['componentId'];
    if (typeof componentId === 'string') ids.push(componentId);
  }

  return ids;
}

/**
 * 校验组件列表的组合约束
 *
 * @param components - 组件列表（邻接表）
 * @param resolveConstraints - 组件类型名 → 组合约束（未声明约束的组件返回 undefined）
 * @returns 校验错误列表；违反约束时错误码为 UNALLOWED_PARENT / UNALLOWED_CHILD
 */
export function checkCompositionConstraints(
  components: ComponentLike[],
  resolveConstraints: CompositionConstraintResolver,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const pairs = extractParentChildPairs(components);

  for (const pair of pairs) {
    const parentConstraints = resolveConstraints(pair.parentType);
    const childConstraints = resolveConstraints(pair.childType);

    // 子组件声明了 allowedParents 且不含当前父类型 → UNALLOWED_PARENT
    if (childConstraints?.allowedParents && !childConstraints.allowedParents.includes(pair.parentType)) {
      errors.push({
        path: pair.childId,
        message: `UNALLOWED_PARENT: 组件 "${pair.childId}"（${pair.childType}）不允许放在父组件 "${pair.parentType}" 下，允许的父: [${childConstraints.allowedParents.join(', ')}]`,
      });
    }

    // 父组件声明了 allowedChildren 且不含当前子类型 → UNALLOWED_CHILD
    if (parentConstraints?.allowedChildren && !parentConstraints.allowedChildren.includes(pair.childType)) {
      errors.push({
        path: pair.parentId,
        message: `UNALLOWED_CHILD: 容器 "${pair.parentId}"（${pair.parentType}）不允许包含子组件 "${pair.childType}"，允许的子: [${parentConstraints.allowedChildren.join(', ')}]`,
      });
    }
  }

  // root 组件挂载在隐式 Surface 容器下：allowedParents 须包含 "Surface"
  const root = components.find((c) => c.id === ROOT_ID);
  if (root && typeof root.component === 'string') {
    const rootConstraints = resolveConstraints(root.component);
    if (rootConstraints?.allowedParents && !rootConstraints.allowedParents.includes(SURFACE_COMPONENT)) {
      errors.push({
        path: ROOT_ID,
        message: `UNALLOWED_PARENT: 根组件 "${root.component}" 声明了 allowedParents 但不含 "${SURFACE_COMPONENT}"，无法作为 surface 根（如需仅作根组件，声明 allowedParents: ["${SURFACE_COMPONENT}"]）`,
      });
    }
  }

  return errors;
}
