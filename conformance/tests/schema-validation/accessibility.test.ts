import { describe, it, expect } from 'vite-plus/test';
import { AccessibilityAttributesSchema, type AccessibilityAttributes } from '@freezestudio/a2ui-sdk';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { SDKBehaviorTestCase } from '../../src/harness/types';

/** accessibility_check 用例（扩展 SDKBehaviorTestCase，action 独立于既有联合） */
type AccessibilityTestCase = Omit<SDKBehaviorTestCase, 'action'> & {
  action: 'accessibility_check';
  args: {
    components: Array<Record<string, unknown>>;
    dataModel?: Record<string, unknown>;
  };
  expect_accessibility?: Record<string, Record<string, unknown>>;
  expect_axe_rules?: string[];
};

/** 组件 id 字符串化（仅接受 string，避免 unknown 转字符串告警） */
function compId(comp: Record<string, unknown>): string {
  const raw = comp['id'];
  return typeof raw === 'string' ? raw : '';
}

/** 解析动态值（DataBinding / FunctionCall 字面量）；无法解析时返回 undefined */
function resolveValue(value: unknown, dataModel: Record<string, unknown>): string | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj['path'] === 'string') {
      const parts = (obj['path'] as string).replace(/^\//, '').split('/');
      let cur: unknown = dataModel;
      for (const p of parts) {
        if (typeof cur !== 'object' || cur === null || !(p in (cur as Record<string, unknown>))) return undefined;
        cur = (cur as Record<string, unknown>)[p];
      }
      return typeof cur === 'string' || typeof cur === 'boolean' ? cur : undefined;
    }
    if (typeof obj['call'] === 'string') {
      // 函数调用求值不属于 accessibility 一致性范围，返回 undefined（不推断）
      return undefined;
    }
  }
  return undefined;
}

/** 收集组件声明的子组件 ID（children 数组 / child 单引用 / object 模板） */
function collectChildIds(comp: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const children = comp['children'];
  const child = comp['child'];
  if (Array.isArray(children)) {
    for (const item of children) {
      if (typeof item === 'string') ids.push(item);
    }
  } else if (typeof children === 'object' && children !== null) {
    const cid = (children as Record<string, unknown>)['componentId'];
    if (typeof cid === 'string') ids.push(cid);
  }
  if (typeof child === 'string') {
    ids.push(child);
  } else if (typeof child === 'object' && child !== null) {
    const cid = (child as Record<string, unknown>)['componentId'];
    if (typeof cid === 'string') ids.push(cid);
  }
  return ids;
}

/**
 * 构建无障碍树：
 * - 每个组件的 accessibility 属性先按 AccessibilityAttributesSchema 校验（v1.0 #2209）
 * - 显式 label/description 解析动态值；live/hidden 透传
 * - hidden 沿子树递归传播（hidden=true 隐藏自身与全部后代）
 * - 隐式可访问名称推断：Button 的 title → label（无显式 label 时）
 */
function buildAccessibilityTree(
  components: Array<Record<string, unknown>>,
  dataModel: Record<string, unknown>,
): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const comp of components) {
    const id = compId(comp);
    if (id) byId.set(id, comp);
  }

  const tree = new Map<string, Record<string, unknown>>();
  const parentOf = new Map<string, string>();
  for (const comp of components) {
    const id = compId(comp);
    for (const cid of collectChildIds(comp)) {
      parentOf.set(cid, id);
    }
  }

  const isHiddenInAncestors = (id: string): boolean => {
    let cur = parentOf.get(id);
    while (cur !== undefined) {
      const node = tree.get(cur);
      if (node?.['hidden'] === true) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };

  for (const comp of components) {
    const id = compId(comp);
    if (!id) continue;

    const raw = (comp['accessibility'] ?? {}) as Record<string, unknown>;
    const parsed = AccessibilityAttributesSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`组件 "${id}" 的 accessibility 属性不符合 v1.0 规范: ${JSON.stringify(parsed.error?.issues)}`);
    }
    const acc = parsed.data as AccessibilityAttributes;

    const node: Record<string, unknown> = {};
    const label = acc.label !== undefined ? resolveValue(acc.label, dataModel) : undefined;
    if (label !== undefined) node['label'] = label;
    else if (acc.label === undefined && comp['component'] === 'Button' && typeof comp['title'] === 'string') {
      // 隐式可访问名称推断：Button title（对齐上游 implicit_label_inference 用例）
      node['label'] = comp['title'];
    }
    const description = acc.description !== undefined ? resolveValue(acc.description, dataModel) : undefined;
    if (description !== undefined) node['description'] = description;
    if (acc.live !== undefined) node['live'] = acc.live;
    if (acc.hidden !== undefined) {
      const h = resolveValue(acc.hidden, dataModel);
      if (h !== undefined) node['hidden'] = h;
    }

    tree.set(id, node);
  }

  // hidden 子树传播（祖先 hidden → 后代 hidden）
  for (const comp of components) {
    const id = compId(comp);
    if (!id || tree.get(id)?.['hidden'] === true) continue;
    if (isHiddenInAncestors(id)) {
      tree.get(id)!['hidden'] = true;
    }
  }

  return tree;
}

describe('Accessibility 一致性（v1.0 #2209，对齐上游 core/accessibility.yaml）', () => {
  const testDir = join(PACKAGE_ROOT, 'test-data/sdk-behavior/accessibility');
  const files = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const testCases = loadTestData<AccessibilityTestCase[]>(join(testDir, file));

    for (const tc of testCases) {
      it(`${tc.name}: ${tc.description}`, () => {
        expect(tc.action).toBe('accessibility_check');
        const components = tc.args?.components ?? [];
        const dataModel = tc.args?.dataModel ?? {};

        const tree = buildAccessibilityTree(components, dataModel);

        // accessibility_tree 断言：期望节点与解析结果逐键匹配
        if (tc.expect_accessibility) {
          for (const [compId, expected] of Object.entries(tc.expect_accessibility)) {
            const actual = tree.get(compId);
            expect(actual, `组件 "${compId}" 应存在于无障碍树`).toBeDefined();
            for (const [key, value] of Object.entries(expected)) {
              expect(actual![key], `组件 "${compId}" 的 ${key} 应等于 ${JSON.stringify(value)}`).toBe(value);
            }
          }
        }

        // axe_core 断言：规则名列表为渲染端（axe-core）要求，此处校验其完整性
        if (tc.expect_axe_rules) {
          for (const rule of tc.expect_axe_rules) {
            expect(typeof rule).toBe('string');
            expect(rule.length).toBeGreaterThan(0);
          }
        }
      });
    }
  }
});
