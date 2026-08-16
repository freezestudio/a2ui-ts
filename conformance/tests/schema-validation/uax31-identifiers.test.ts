import { describe, it, expect } from 'vite-plus/test';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';

const UAX31_PATTERN = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

function isUAX31Identifier(name: string): boolean {
  return UAX31_PATTERN.test(name);
}

function validateCatalogIdentifiers(catalog: Record<string, unknown>, catalogName: string): string[] {
  const violations: string[] = [];

  const components = catalog.components as Record<string, unknown> | undefined;
  if (components) {
    for (const name of Object.keys(components)) {
      if (!isUAX31Identifier(name)) {
        violations.push(`${catalogName}: 组件名 '${name}' 不符合 UAX #31`);
      }
      const schema = components[name] as Record<string, unknown>;
      const props = schema?.properties as Record<string, unknown> | undefined;
      if (props) {
        for (const propName of Object.keys(props)) {
          if (!isUAX31Identifier(propName)) {
            violations.push(`${catalogName}: 组件 '${name}' 的属性名 '${propName}' 不符合 UAX #31`);
          }
        }
      }
    }
  }

  const functions = catalog.functions as Record<string, unknown> | undefined;
  if (functions) {
    for (const name of Object.keys(functions)) {
      if (!isUAX31Identifier(name)) {
        violations.push(`${catalogName}: 函数名 '${name}' 不符合 UAX #31`);
      }
      const schema = functions[name] as Record<string, unknown>;
      const args = (schema?.properties as Record<string, unknown>)?.args as Record<string, unknown> | undefined;
      const argProps = args?.properties as Record<string, unknown> | undefined;
      if (argProps) {
        for (const argName of Object.keys(argProps)) {
          if (!isUAX31Identifier(argName)) {
            violations.push(`${catalogName}: 函数 '${name}' 的参数名 '${argName}' 不符合 UAX #31`);
          }
        }
      }
    }
  }

  return violations;
}

describe('UAX #31 标识符合规检查', () => {
  it('testing_catalog.json 所有标识符符合 UAX #31', () => {
    const catalog = loadTestData<Record<string, unknown>>(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'test', 'testing_catalog.json'),
    );
    const violations = validateCatalogIdentifiers(catalog, 'testing_catalog.json');
    expect(violations).toEqual([]);
  });

  it('basic/catalog.json 所有标识符符合 UAX #31', () => {
    const catalog = loadTestData<Record<string, unknown>>(
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
    const violations = validateCatalogIdentifiers(catalog, 'basic/catalog.json');
    expect(violations).toEqual([]);
  });

  it('isUAX31Identifier 正确识别合法/非法标识符', () => {
    expect(isUAX31Identifier('Text')).toBe(true);
    expect(isUAX31Identifier('formatString')).toBe(true);
    expect(isUAX31Identifier('_private')).toBe(true);
    expect(isUAX31Identifier('camelCase')).toBe(true);
    expect(isUAX31Identifier('PascalCase')).toBe(true);

    expect(isUAX31Identifier('')).toBe(false);
    expect(isUAX31Identifier('123abc')).toBe(false);
    expect(isUAX31Identifier('my-component')).toBe(false);
    expect(isUAX31Identifier('my component')).toBe(false);
    expect(isUAX31Identifier('@index')).toBe(false);
  });
});
