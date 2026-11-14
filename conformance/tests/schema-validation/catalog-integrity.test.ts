import { describe, it, expect } from 'vite-plus/test';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';

const UAX31_IDENTIFIER = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

/**
 * v1.0 (#2724)：`$defs` 除 anyComponent / anyFunction 外允许叶子定义，
 * 名称必须是 UAX #31 标识符；“不得定义组件”由 catalog_definition schema 用例覆盖。
 */
function checkDefs(defs: Record<string, unknown>, name: string): string[] {
  const errs = [];
  for (const k of Object.keys(defs)) {
    if (!UAX31_IDENTIFIER.test(k)) errs.push(name + ': invalid $defs key: ' + k);
  }
  return errs;
}

describe('Catalog $defs key validation', () => {
  it('testing_catalog.json $defs 名称符合 UAX #31', () => {
    const c = loadTestData(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'test', 'testing_catalog.json'),
    );
    const defs = (c as any).$defs || {};
    expect(checkDefs(defs, 'testing_catalog')).toEqual([]);
  });

  it('basic/catalog.json $defs 名称符合 UAX #31', () => {
    const c = loadTestData(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'catalogs', 'basic', 'v1', 'catalog.json'),
    );
    const defs = (c as any).$defs || {};
    expect(checkDefs(defs, 'basic/catalog')).toEqual([]);
  });

  it('testing_catalog has components and functions', () => {
    const c = loadTestData(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'test', 'testing_catalog.json'),
    );
    expect((c as any).components).toBeDefined();
    expect((c as any).functions).toBeDefined();
    expect((c as any).catalogId).toBeDefined();
  });

  it('basic catalog has 18 components and functions map', () => {
    const c = loadTestData(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'catalogs', 'basic', 'v1', 'catalog.json'),
    );
    const compCount = Object.keys((c as any).components || {}).length;
    expect(compCount).toBe(18);
    expect((c as any).functions).toBeDefined();
    expect(typeof (c as any).functions).toBe('object');
    expect(Array.isArray((c as any).functions)).toBe(false);
  });
});
