import { describe, it, expect, beforeAll } from 'vite-plus/test';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { listOfficialCases, OFFICIAL_CASES_DIR } from '../../src/harness/official-cases';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';
import {
  A2uiMessageSchema,
  A2uiClientMessageSchema,
  A2uiValidator,
  Catalog,
  createFullCatalog,
} from '@freezestudio/a2ui-sdk';

/** 按官方 schema 方向选择对应的 SDK Zod 校验器 */
function sdkSchemaFor(schema: string) {
  if (schema === 'agent_to_renderer.json') return A2uiMessageSchema;
  if (schema === 'renderer_to_agent.json') return A2uiClientMessageSchema;
  return null; // catalog_definition 等走 Catalog.fromJson，SDK 另有 catalog 测试覆盖
}

/**
 * 目录上下文差异允许清单（规范拒收、SDK 消息层接受）。
 *
 * 这些用例的判定依赖 catalog 组件/函数 Schema（testing_catalog 或 basic catalog 的
 * 组件属性 / 函数参数 / returnType / DynamicValue oneOf 约束），SDK 消息层 schema
 * 不做目录级校验——由 `Catalog.validateComponent` / `argsSchema` /
 * `validateComponentsWithCatalogs` 承担（见 "SDK Catalog-aware 校验" 测试）。
 *
 * 维护说明：若官方规范 test/cases 更新导致差异集变化，运行本测试并依据
 * "SDK Zod 与规范 Schema 差异报告" 输出更新此清单；信封级（ComponentCommon /
 * metadata / Surface 保留名 / 错误码枚举）差异不允许出现在此清单中。
 */
const CATALOG_CONTEXT_CASES: ReadonlySet<string> = new Set([
  // button_checks.json — 组件属性 vs testing catalog Button schema
  'button_checks.json: Button with deprecated enabled property (should fail)',
  'button_checks.json: Button with invalid check structure (invalid returnType)',
  'button_checks.json: Button with invalid nested structure (extra property)',
  "button_checks.json: Button with deprecated 'primary' property (should fail)",
  // call_function_message.json — CallRendererFunction args vs catalog 函数 schema
  'call_function_message.json: CallRendererFunctionMessage: Invalid args (nested object in a single value)',
  // checkable_components.json — checks 函数 returnType / Slider steps vs catalog schema
  'checkable_components.json: TextField with invalid function returnType in check',
  'checkable_components.json: Slider with invalid steps property (string)',
  'checkable_components.json: Slider with invalid steps property (less than 1)',
  // dynamic_value_validation.json — TestComponent.value vs DynamicValue oneOf（组件属性级）
  'dynamic_value_validation.json: DynamicValue: Invalid DataBinding with extra properties',
  'dynamic_value_validation.json: DynamicValue: Invalid FunctionCall with extra properties',
  // function_catalog_validation.json — 函数参数 / returnType / @index 系统函数 vs catalog 函数定义
  'function_catalog_validation.json: required: Invalid args (empty)',
  'function_catalog_validation.json: required: Invalid returnType',
  'function_catalog_validation.json: regex: Invalid args (missing pattern)',
  'function_catalog_validation.json: length: Invalid constraint (empty object)',
  'function_catalog_validation.json: formatString: Invalid returnType',
  'function_catalog_validation.json: formatNumber: Invalid args (wrong type for precision)',
  'function_catalog_validation.json: formatCurrency: Missing currency code',
  "function_catalog_validation.json: pluralize: Invalid (missing 'other')",
  'function_catalog_validation.json: openUrl: Invalid args (string instead of object)',
  'function_catalog_validation.json: openUrl: Invalid returnType',
  'function_catalog_validation.json: length: Invalid min type (string)',
  'function_catalog_validation.json: length: Invalid max value (negative)',
  'function_catalog_validation.json: numeric: Invalid min type (string)',
  'function_catalog_validation.json: numeric: Invalid max type (string)',
  'function_catalog_validation.json: regex: Invalid pattern type (number)',
  'function_catalog_validation.json: email: Invalid args count (too many)',
  'function_catalog_validation.json: formatString: Invalid format string type (number)',
  'function_catalog_validation.json: formatNumber: Invalid precision type (boolean)',
  'function_catalog_validation.json: formatCurrency: Invalid currency code type (number)',
  'function_catalog_validation.json: formatDate: Invalid pattern type (null)',
  'function_catalog_validation.json: openUrl: Invalid URL format (not a URI)',
  'function_catalog_validation.json: and: Invalid (single value)',
  'function_catalog_validation.json: or: Invalid (single value)',
  'function_catalog_validation.json: not: Invalid argument type (string)',
  'function_catalog_validation.json: not: Invalid returnType',
  'function_catalog_validation.json: required: Too many arguments',
  'function_catalog_validation.json: regex: Invalid returnType',
  'function_catalog_validation.json: and: Invalid returnType',
  'function_catalog_validation.json: @index: Invalid args (string offset)',
  'function_catalog_validation.json: @index: Invalid returnType',
  'function_catalog_validation.json: @index: Invalid call with catalogId (system function cannot have catalogId)',
  // icon_checks.json — Icon svgPath vs catalog Icon schema
  'icon_checks.json: Icon: Invalid custom SVG icon with type mismatch on svgPath (should fail)',
  'icon_checks.json: Icon: Invalid custom SVG icon with extra fields in svgPath binding (should fail)',
  // initial_state_validation.json — 组件未知信封属性（unevaluatedProperties: false 需 catalog 判定）
  'initial_state_validation.json: Invalid: component with unexpected property on envelope',
  // tabs_checks.json — Tabs 空数组 vs catalog Tabs schema
  'tabs_checks.json: Tabs with empty tabs array (should fail)',
  // text_variants.json — Text variant vs catalog Text schema
  'text_variants.json: Text with h1 variant (should fail)',
  'text_variants.json: Text with invalid variant (should fail)',
]);

describe('官方规范 test/cases 全量 Schema 一致性（与官方 run_tests.py 同源）', () => {
  // 按 suite 的 catalog 字段分组（basic catalog / testing_catalog），
  // 与官方 run_tests.py 的 setup_catalog_alias 行为一致
  const byCatalog = new Map<string, ReturnType<typeof listOfficialCases>>();
  for (const c of listOfficialCases()) {
    if (!byCatalog.has(c.catalog)) byCatalog.set(c.catalog, []);
    byCatalog.get(c.catalog)!.push(c);
  }

  for (const [catalog, cases] of byCatalog) {
    describe(`catalog: ${catalog}`, () => {
      let ajvValidator: SchemaValidator;

      beforeAll(() => {
        ajvValidator = new SchemaValidator(undefined, catalog);
        ajvValidator.loadSchemas();
      });

      for (const { file, schema, test } of cases) {
        it(`[${file}] ${test.description}`, () => {
          const result = ajvValidator.validate(schema, test.data);
          expect(result.valid).toBe(test.valid);
          if (!test.valid && result.errors) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});

describe('SDK Zod Schema 与官方规范 Schema 一致性对比', () => {
  const allCases = listOfficialCases();
  // SDK Zod 只处理协议消息（agent_to_renderer / renderer_to_agent）；
  // catalog_definition 用例走 Catalog.fromJson 链路（SDK 侧另有 catalog 测试覆盖）
  const messageCases = allCases.filter((c) => sdkSchemaFor(c.schema) !== null);

  it('SDK Zod 有效数据必须通过（规范也通过的数据）', () => {
    for (const { file, schema, test } of messageCases) {
      if (!test.valid) continue;
      const result = sdkSchemaFor(schema)!.safeParse(test.data);
      expect(result.success, `[${file}] ${test.description}`).toBe(true);
    }
  });

  it('SDK Zod 信封级与规范 Schema 一致（目录上下文差异须在允许清单内）', () => {
    const gaps: string[] = [];
    for (const { file, schema, catalog, test } of messageCases) {
      const specValidator = new SchemaValidator(undefined, catalog);
      specValidator.loadSchemas();
      const specResult = specValidator.validate(schema, test.data);
      const sdkResult = sdkSchemaFor(schema)!.safeParse(test.data);
      if (specResult.valid !== sdkResult.success) {
        gaps.push(`${file}: ${test.description}`);
      }
    }

    // 信封级差异（ComponentCommon / metadata / Surface 保留名 / 错误码枚举等）
    // 一律不允许；仅目录上下文差异可在允许清单内
    const unexpected = gaps.filter((g) => !CATALOG_CONTEXT_CASES.has(g));
    expect(
      unexpected,
      `信封级差异（不在目录上下文允许清单内）:\n${unexpected.map((g) => `  - ${g}`).join('\n')}\n` +
        `（目录上下文差异 ${gaps.length - unexpected.length} 处已在允许清单内）`,
    ).toEqual([]);

    if (gaps.length > 0) {
      console.warn(`SDK Zod 与规范 Schema 目录上下文差异（允许清单内）: ${gaps.length} 处`);
    }
  });

  it('SDK Catalog-aware 校验：initial_state 非法用例全部被拒', () => {
    // 官方 initial_state_validation.json 的非法用例（basic catalog 上下文）
    const file = loadTestData<{ schema: string; tests: Array<{ description: string; valid: boolean; data: unknown }> }>(
      join(OFFICIAL_CASES_DIR, 'initial_state_validation.json'),
    );
    const invalid = file.tests.filter((t) => !t.valid);

    // 用官方 basic catalog 构建 SDK Catalog
    const catalogJson = loadTestData<Record<string, unknown>>(
      join(PACKAGE_ROOT, 'schemas', 'catalogs', 'basic', 'catalog.json'),
    );
    const catalog = Catalog.fromJson(catalogJson as never);
    const validator = new A2uiValidator();

    for (const t of invalid) {
      const data = t.data as {
        version?: string;
        createSurface?: { surfaceId?: string; catalogId?: string; components?: unknown[] };
        updateComponents?: { surfaceId?: string; components?: unknown[] };
      };
      const components = data.createSurface?.components ?? data.updateComponents?.components ?? ([] as unknown[]);

      // 1) 消息信封校验：createSurface/updateComponents 级属性（严格对象）与
      //    组件信封（id 必填 / Surface 保留名 / metadata 严格）由 SDK 消息层拒绝
      const envelope = sdkSchemaFor(file.schema)!;
      const envelopeResult = envelope.safeParse(t.data);
      if (!envelopeResult.success) continue;

      // 2) 信封通过（如组件未知信封属性）→ catalog-aware 校验必须拒绝
      const surfaceDefaultCatalogId =
        data.createSurface?.catalogId ?? 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
      const msg = {
        version: 'v1.0',
        updateComponents: { surfaceId: 's', components },
      };
      const result = validator.validateComponentsWithCatalogs(msg as never, [catalog], {
        surfaceDefaultCatalogId,
      });
      expect(
        result.valid,
        `[initial_state_validation.json] ${t.description} 信封通过后应被 catalog-aware 校验拒绝: ${JSON.stringify(result.errors)}`,
      ).toBe(false);
    }
  });

  it('SDK Catalog-aware 校验：合法 initial_state 用例全部通过', () => {
    const file = loadTestData<{ schema: string; tests: Array<{ description: string; valid: boolean; data: unknown }> }>(
      join(OFFICIAL_CASES_DIR, 'initial_state_validation.json'),
    );
    const valid = file.tests.filter((t) => t.valid);

    const catalogJson = loadTestData<Record<string, unknown>>(
      join(PACKAGE_ROOT, 'schemas', 'catalogs', 'basic', 'catalog.json'),
    );
    const catalog = Catalog.fromJson(catalogJson as never);
    const validator = new A2uiValidator();
    // createFullCatalog（本地 basic-catalog 声明）也应通过官方合法用例
    const fullCatalog = createFullCatalog();

    for (const t of valid) {
      const data = t.data as {
        createSurface?: { surfaceId?: string; catalogId?: string; components?: unknown[] };
      };
      const components = data.createSurface?.components;
      if (!components || components.length === 0) continue;
      const surfaceDefaultCatalogId =
        data.createSurface?.catalogId ?? 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

      const msg = { version: 'v1.0', updateComponents: { surfaceId: 's', components } };
      const result = validator.validateComponentsWithCatalogs(msg as never, [catalog, fullCatalog], {
        surfaceDefaultCatalogId,
      });
      expect(
        result.valid,
        `[initial_state_validation.json] ${t.description} 应通过 catalog-aware 校验: ${JSON.stringify(result.errors)}`,
      ).toBe(true);
    }
  });
});
