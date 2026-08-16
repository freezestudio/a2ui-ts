import { describe, it, expect, beforeAll } from 'vite-plus/test';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';
import { createFullCatalog } from '@freezestudio/a2ui-sdk';

/** 对齐上游 basic catalog 的函数定义结构（allOf 形式，引用 FunctionCommon） */
function functionDef(overrides: Record<string, unknown>): Record<string, unknown> {
  // call 属于 allOf 分支的 properties（const），其余元数据（callableFrom/requiresUserActivation）
  // 位于顶层，两者不可混淆，否则 unevaluatedProperties: false 会拒绝顶层 call
  const { call = 'test', ...rest } = overrides;
  return {
    type: 'object',
    description: 'Test function.',
    returnType: 'void',
    allOf: [
      { $ref: 'https://a2ui.org/specification/v1_0/common_types.json#/$defs/FunctionCommon' },
      {
        type: 'object',
        properties: {
          call: { const: call },
          args: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
            required: ['url'],
            unevaluatedProperties: false,
          },
        },
        required: ['call', 'args'],
      },
    ],
    unevaluatedProperties: false,
    ...rest,
  };
}

describe('requiresUserActivation — catalog_definition 规范一致性（上游 #2157）', () => {
  let ajvValidator: SchemaValidator;

  beforeAll(() => {
    ajvValidator = new SchemaValidator();
    ajvValidator.loadSchemas();
  });

  it('catalog_definition.json 定义 requiresUserActivation 属性', () => {
    const def = loadTestData(
      join(
        PACKAGE_ROOT,
        '..',
        'packages',
        'sdk',
        'resources',
        'specification',
        'v1_0',
        'json',
        'catalog_definition.json',
      ),
    );
    const fnDef = (def as Record<string, unknown>)['$defs'] as Record<string, Record<string, unknown>>;
    const functionDefinition = fnDef['FunctionDefinition'] as Record<string, unknown>;
    expect(functionDefinition).toBeDefined();
    expect(JSON.stringify(functionDefinition)).toContain('requiresUserActivation');
  });

  it('basic catalog 的 openUrl 定义符合新 schema（requiresUserActivation: true + rendererOrAgent）', () => {
    const basicCatalog = loadTestData(
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
    const openUrl = (basicCatalog as Record<string, Record<string, unknown>>)['functions']?.['openUrl'] as
      | Record<string, unknown>
      | undefined;
    expect(openUrl?.['requiresUserActivation']).toBe(true);

    const result = ajvValidator.validate('catalog_definition.json', {
      catalogId: (basicCatalog as Record<string, unknown>)['catalogId'],
      functions: { openUrl },
    });
    expect(result.valid).toBe(true);
  });

  it('requiresUserActivation: true 且 callableFrom=agentOnly → 拒绝（条件约束）', () => {
    const result = ajvValidator.validate('catalog_definition.json', {
      catalogId: 'https://a2ui.org/specification/v1_0/basic-catalog.json',
      functions: {
        bad: functionDef({ call: 'bad', callableFrom: 'agentOnly', requiresUserActivation: true }),
      },
    });
    expect(result.valid).toBe(false);
  });

  it('显式 requiresUserActivation: false → 不受条件约束（agentOnly 允许）', () => {
    const result = ajvValidator.validate('catalog_definition.json', {
      catalogId: 'https://a2ui.org/specification/v1_0/basic-catalog.json',
      functions: {
        ping: functionDef({ call: 'ping', callableFrom: 'agentOnly', requiresUserActivation: false }),
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe('SDK 双轨：BasicCatalog openUrl requiresUserActivation', () => {
  it('openUrl 声明 requiresUserActivation: true', () => {
    const catalog = createFullCatalog();
    const openUrl = catalog.getFunction('openUrl');
    expect(openUrl?.requiresUserActivation).toBe(true);
    // openUrl 未声明 callableFrom → 按规范缺省为 rendererOnly（上游 #2157 仅声明 requiresUserActivation）
    expect(openUrl?.callableFrom).toBe('rendererOnly');
  });
});
