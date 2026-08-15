import { describe, it, expect, beforeAll } from 'vite-plus/test';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { listOfficialCases } from '../../src/harness/official-cases';
import { A2uiMessageSchema, A2uiClientMessageSchema } from '@a2ui/sdk';

/** 按官方 schema 方向选择对应的 SDK Zod 校验器 */
function sdkSchemaFor(schema: string) {
  if (schema === 'agent_to_renderer.json') return A2uiMessageSchema;
  if (schema === 'renderer_to_agent.json') return A2uiClientMessageSchema;
  return null; // catalog_definition 等走 Catalog.fromJson，SDK 另有 catalog 测试覆盖
}

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

  it('SDK Zod 与规范 Schema 差异报告', () => {
    const gaps: string[] = [];
    for (const { file, schema, catalog, test } of messageCases) {
      const specValidator = new SchemaValidator(undefined, catalog);
      specValidator.loadSchemas();
      const specResult = specValidator.validate(schema, test.data);
      const sdkResult = sdkSchemaFor(schema)!.safeParse(test.data);
      if (specResult.valid !== sdkResult.success) {
        gaps.push(`${file}: ${test.description} (规范=${specResult.valid}, SDK=${sdkResult.success})`);
      }
    }
    if (gaps.length > 0) {
      console.warn(`SDK Zod 与规范 Schema 存在 ${gaps.length} 处差异:`);
      for (const g of gaps) console.warn(`  - ${g}`);
    }
  });
});
