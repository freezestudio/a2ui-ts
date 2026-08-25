/**
 * 组合约束校验 — allowedParents / allowedChildren + Surface 容器
 *
 * 对齐 A2UI v1.0 规范（上游 d849f485 新增）与 sdk `composition-checker` 的语义：
 * - createSurface 隐式实例化 Surface 容器（child 固定为 "root"，不可被 updateComponents 修改）
 * - 组件 schema 顶层可声明 allowedParents / allowedChildren（可选，缺省允许所有父/子类型）
 * - 违反约束时错误码分别为 UNALLOWED_PARENT / UNALLOWED_CHILD
 *
 * basic catalog 未声明任何组合约束；自定义 catalog 通过
 * `registerCatalogConstraints(catalogId, constraints)` 注册约束表后，
 * message-handler 的组件校验链路会自动执行组合校验并产生标准错误码。
 *
 * 校验视角：Surface 作为顶层容器父节点，id="root" 组件挂载为其 child。
 * 因此 root 组件的父类型在约束判断中视为 "Surface"。
 */

/** 协议保留的 Surface 容器组件名（Catalog 中禁止定义同名组件） */
export const SURFACE_COMPONENT = 'Surface' as const;

/** 组合约束错误码（v1.0 renderer→agent error 枚举） */
export const UNALLOWED_PARENT = 'UNALLOWED_PARENT' as const;
export const UNALLOWED_CHILD = 'UNALLOWED_CHILD' as const;

/** 组件组合约束（来自组件 schema 顶层声明） */
export interface CompositionConstraints {
  /** 允许作为父组件出现的组件类型名列表；缺省 = 允许所有 */
  allowedParents?: string[];
  /** 允许作为子组件出现的组件类型名列表；缺省 = 允许所有 */
  allowedChildren?: string[];
}

/** 组件类型名 → 组合约束 的解析器 */
export type CompositionConstraintResolver = (componentType: string) => CompositionConstraints | undefined;

/** 组合约束校验错误（对齐 renderer_to_agent ValidationFailedError 结构） */
export interface CompositionIssue {
  code: typeof UNALLOWED_PARENT | typeof UNALLOWED_CHILD;
  path: string;
  message: string;
}

/** 待校验的组件（含 id/component/children/child） */
type ComponentLike = { id?: string; component?: string; [key: string]: unknown };

// ============================================================================
// Catalog 约束注册表
// ============================================================================

const CATALOG_CONSTRAINTS = new Map<string, Record<string, CompositionConstraints>>();

/**
 * 注册 catalog 的组合约束表（组件类型名 → 约束）
 * 同名 catalog 重复注册以最新为准；basic catalog 无需注册（无约束）。
 */
export function registerCatalogConstraints(
  catalogId: string,
  constraints: Record<string, CompositionConstraints>,
): void {
  CATALOG_CONSTRAINTS.set(catalogId, { ...constraints });
}

/** 清空全部已注册约束（测试用） */
export function clearCatalogConstraints(): void {
  CATALOG_CONSTRAINTS.clear();
}

/**
 * 获取指定 catalog 的约束解析器
 *
 * 解析顺序与 v1.0 catalog 解析一致：显式 catalogId → 注册表；未注册/未知 catalog
 * 返回恒 undefined 的解析器（即不做组合限制，与"缺省允许所有"语义一致）。
 */
export function getConstraintResolver(catalogId?: string): CompositionConstraintResolver {
  const table = catalogId ? CATALOG_CONSTRAINTS.get(catalogId) : undefined;
  return (componentType: string) => table?.[componentType];
}

// ============================================================================
// 父子关系提取 + 约束校验
// ============================================================================

interface ParentChildPair {
  parentId: string;
  parentType: string;
  childId: string;
  childType: string;
}

/** 从组件列表中提取全部父子关系对（children 数组 / child 单引用 / object 模板模式） */
function extractParentChildPairs(components: ComponentLike[]): ParentChildPair[] {
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
 * @returns 违规列表；错误码为 UNALLOWED_PARENT / UNALLOWED_CHILD，path 为违规组件 ID
 */
export function checkCompositionConstraints(
  components: ComponentLike[],
  resolveConstraints: CompositionConstraintResolver,
): CompositionIssue[] {
  const issues: CompositionIssue[] = [];
  const pairs = extractParentChildPairs(components);

  for (const pair of pairs) {
    const parentConstraints = resolveConstraints(pair.parentType);
    const childConstraints = resolveConstraints(pair.childType);

    // 子组件声明了 allowedParents 且不含当前父类型 → UNALLOWED_PARENT
    if (childConstraints?.allowedParents && !childConstraints.allowedParents.includes(pair.parentType)) {
      issues.push({
        code: UNALLOWED_PARENT,
        path: pair.childId,
        message:
          `组件 "${pair.childId}"（${pair.childType}）不允许放在父组件 "${pair.parentType}" 下，` +
          `允许的父: [${childConstraints.allowedParents.join(', ')}]`,
      });
    }

    // 父组件声明了 allowedChildren 且不含当前子类型 → UNALLOWED_CHILD
    if (parentConstraints?.allowedChildren && !parentConstraints.allowedChildren.includes(pair.childType)) {
      issues.push({
        code: UNALLOWED_CHILD,
        path: pair.parentId,
        message:
          `容器 "${pair.parentId}"（${pair.parentType}）不允许包含子组件 "${pair.childId}"（${pair.childType}），` +
          `允许的子: [${parentConstraints.allowedChildren.join(', ')}]`,
      });
    }
  }

  // root 组件挂载在隐式 Surface 容器下：allowedParents 须包含 "Surface"
  const root = components.find((c) => c.id === 'root');
  if (root && typeof root.component === 'string') {
    const rootConstraints = resolveConstraints(root.component);
    if (rootConstraints?.allowedParents && !rootConstraints.allowedParents.includes(SURFACE_COMPONENT)) {
      issues.push({
        code: UNALLOWED_PARENT,
        path: 'root',
        message:
          `根组件 "${root.component}" 声明了 allowedParents 但不含 "${SURFACE_COMPONENT}"，无法作为 surface 根` +
          `（如需仅作根组件，声明 allowedParents: ["${SURFACE_COMPONENT}"]）`,
      });
    }
  }

  return issues;
}
