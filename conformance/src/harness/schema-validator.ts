import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { loadTestData } from './loader';
import { PACKAGE_ROOT } from './package-root';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

export interface SchemaValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
}

export class SchemaValidator {
  private ajv: Ajv2020;
  private schemasLoaded = false;
  private schemaDir: string;
  private catalogFile: string;

  /**
   * @param schemaDir - schema 目录（默认 packages/sdk/resources/specification/v1_0/json 官方只读副本）
   * @param catalogFile - 注册为 catalog.json（$ref 目标）的 catalog 文件；
   *                      官方 run_tests.py 按 suite 的 "catalog" 字段切换
   *                      （basic 或 testing_catalog），此处对应实现
   */
  constructor(schemaDir?: string, catalogFile = 'catalog.json') {
    // 官方规范为 JSON Schema draft 2020-12（unevaluatedProperties 等关键字），
    // 必须用 Ajv2020 而非默认 draft-07，否则约束会被静默忽略
    this.ajv = new Ajv2020({ strict: false, allErrors: true, validateSchema: false });
    addFormats(this.ajv);
    // 默认直接使用 packages/sdk/resources/specification/v1_0 的官方只读副本
    this.schemaDir =
      schemaDir ?? join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'json');
    this.catalogFile = catalogFile;
  }

  loadSchemas(): void {
    if (this.schemasLoaded) return;

    const files = readdirSync(this.schemaDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const schema = loadTestData<Record<string, unknown>>(join(this.schemaDir, file));
      let schemaWithId = this.fixCatalogSchemaId(schema, file);
      this.ajv.addSchema(schemaWithId, file);
    }

    // 官方规范中 envelope 通过相对引用 catalog.json 解析 anyComponent/anyFunction；
    // 这里按 suite 选择 official basic catalog 或 official testing_catalog，
    // 并统一注册为 catalog.json 别名。
    const catalogPath =
      this.catalogFile === 'testing_catalog.json'
        ? join(
            PACKAGE_ROOT,
            '..',
            'packages',
            'sdk',
            'resources',
            'specification',
            'v1_0',
            'test',
            'testing_catalog.json',
          )
        : join(
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
          );
    const catalog = loadTestData<Record<string, unknown>>(catalogPath);
    this.ajv.addSchema({ ...catalog, $id: 'https://a2ui.org/specification/v1_0/catalog.json' }, 'catalog.json');

    this.schemasLoaded = true;
  }

  private fixCatalogSchemaId(schema: Record<string, unknown>, fileName: string): Record<string, unknown> {
    if (fileName === 'catalog.json' && typeof schema.$id === 'string') {
      const baseUri = 'https://a2ui.org/specification/v1_0/catalog.json';
      if (schema.$id !== baseUri) {
        return { ...schema, $id: baseUri };
      }
    }
    return schema;
  }

  validate(schemaName: string, data: unknown): SchemaValidationResult {
    if (!this.schemasLoaded) {
      this.loadSchemas();
    }

    const validateFn = this.ajv.getSchema(schemaName);
    if (!validateFn) {
      throw new Error(`Schema 未找到: ${schemaName}`);
    }

    const valid = validateFn(data);
    if (valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: (validateFn.errors || []).map((err: ErrorObject) => ({
        path: err.instancePath || '/',
        message: err.message || '验证失败',
      })),
    };
  }
}
