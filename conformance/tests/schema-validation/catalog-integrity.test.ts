import { describe, it, expect } from 'vite-plus/test';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';

const ALLOWED = new Set(['surfaceProperties', 'anyComponent', 'anyFunction']);

function checkDefs(defs: Record<string, unknown>, name: string): string[] {
  const errs = [];
  for (const k of Object.keys(defs)) {
    if (!ALLOWED.has(k)) errs.push(name + ': unexpected $defs key: ' + k);
  }
  return errs;
}

describe('Catalog $defs key validation', () => {
  it('testing_catalog.json $defs has only allowed keys', () => {
    const c = loadTestData(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'test', 'testing_catalog.json'),
    );
    const defs = (c as any).$defs || {};
    expect(checkDefs(defs, 'testing_catalog')).toEqual([]);
  });

  it('basic/catalog.json $defs has only allowed keys', () => {
    const c = loadTestData(
      join(
        PACKAGE_ROOT,
        '..',
        'packages',
        'sdk',
        'resources',
        'specification',
        'v1_0',
        'catalogs',
        'basic',
        'catalog.json',
      ),
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
      join(
        PACKAGE_ROOT,
        '..',
        'packages',
        'sdk',
        'resources',
        'specification',
        'v1_0',
        'catalogs',
        'basic',
        'catalog.json',
      ),
    );
    const compCount = Object.keys((c as any).components || {}).length;
    expect(compCount).toBe(18);
    expect((c as any).functions).toBeDefined();
    expect(typeof (c as any).functions).toBe('object');
    expect(Array.isArray((c as any).functions)).toBe(false);
  });
});
