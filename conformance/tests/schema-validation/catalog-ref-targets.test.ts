import { describe, it, expect } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../../src/harness/package-root';

/**
 * Catalog `$ref` 目标白名单校验（协议 catalog schema rule 3）
 *
 * 对齐上游 specification/v1_0/test/run_tests.py 的 validate_catalogs_ref_targets：
 * - 本地 `$ref` 只能指向 catalog 自己声明的 component / function；
 * - 外部 `$ref` 只能指向 `common_types.json#/$defs/*` 中的白名单 schema。
 *
 * 上游 #2708 把 `Child` / `DataBinding` / `FunctionCall` 纳入白名单。
 */
const SDK_RESOURCES = join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources');

const ALLOWED_EXTERNAL_REF_TARGETS = new Set([
  'ComponentId',
  'Child',
  'ChildList',
  'DynamicString',
  'DynamicNumber',
  'DynamicBoolean',
  'DynamicStringList',
  'DynamicValue',
  'AccessibilityAttributes',
  'CheckRule',
  'Checkable',
  'Action',
  'DataBinding',
  'FunctionCall',
]);

/** 值属于注解或字面量而非子 schema，其中的 `$ref` 不算引用 */
const NON_SCHEMA_KEYS = new Set(['metadata', 'examples', 'const', 'default', 'enum', 'description']);

function collectRefs(value: unknown, refs: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'object' && item !== null) collectRefs(item, refs);
    }
    return;
  }
  if (typeof value !== 'object' || value === null) return;

  const obj = value as Record<string, unknown>;
  const ref = obj['$ref'];
  if (typeof ref === 'string') refs.push(ref);

  // 声明的属性无论叫什么名字都是子 schema，因此名为 "metadata" 的属性仍需递归
  const properties = obj['properties'];
  if (typeof properties === 'object' && properties !== null && !Array.isArray(properties)) {
    for (const propDef of Object.values(properties as Record<string, unknown>)) {
      collectRefs(propDef, refs);
    }
  }

  for (const [key, val] of Object.entries(obj)) {
    if (key === 'properties' || NON_SCHEMA_KEYS.has(key)) continue;
    if (typeof val === 'object' && val !== null) collectRefs(val, refs);
  }
}

function validateCatalogRefTargets(path: string): string[] {
  const catalog = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const components = (catalog['components'] ?? {}) as Record<string, unknown>;
  const functions = (catalog['functions'] ?? {}) as Record<string, unknown>;
  const defs = (catalog['$defs'] ?? {}) as Record<string, unknown>;

  const refs: string[] = [];
  for (const section of [components, functions, defs]) {
    for (const definition of Object.values(section)) {
      collectRefs(definition, refs);
    }
  }

  const errors: string[] = [];
  for (const ref of refs) {
    if (ref.startsWith('#/components/')) {
      const target = ref.slice('#/components/'.length);
      if (!(target in components)) errors.push(`未知的本地 $ref 目标: '${ref}'`);
    } else if (ref.startsWith('#/functions/')) {
      const target = ref.slice('#/functions/'.length);
      if (!(target in functions)) errors.push(`未知的本地 $ref 目标: '${ref}'`);
    } else if (ref.startsWith('common_types.json#/$defs/')) {
      const target = ref.slice('common_types.json#/$defs/'.length);
      if (!ALLOWED_EXTERNAL_REF_TARGETS.has(target)) {
        errors.push(`不允许的外部 $ref 目标: '${ref}'`);
      }
    } else {
      errors.push(`不允许的 $ref 目标: '${ref}'`);
    }
  }
  return errors;
}

const CATALOGS: Array<[string, string]> = [
  ['basic catalog', join(SDK_RESOURCES, 'catalogs', 'basic', 'v1', 'catalog.json')],
  ['testing_catalog', join(SDK_RESOURCES, 'specification', 'v1_0', 'test', 'testing_catalog.json')],
];

describe('Catalog $ref 目标白名单（协议 rule 3）', () => {
  for (const [name, path] of CATALOGS) {
    it(`${name} 的所有 $ref 目标合法`, () => {
      expect(validateCatalogRefTargets(path)).toEqual([]);
    });
  }

  it('白名单包含上游 #2708 新增的 Child / DataBinding / FunctionCall', () => {
    expect(ALLOWED_EXTERNAL_REF_TARGETS.has('Child')).toBe(true);
    expect(ALLOWED_EXTERNAL_REF_TARGETS.has('DataBinding')).toBe(true);
    expect(ALLOWED_EXTERNAL_REF_TARGETS.has('FunctionCall')).toBe(true);
  });
});
