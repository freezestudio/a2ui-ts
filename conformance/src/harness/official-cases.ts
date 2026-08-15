import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { PACKAGE_ROOT } from './package-root';
import type { SchemaValidationTestFile } from './types';

/**
 * 官方规范 test/cases 目录（@freezestudio/a2ui-sdk 的只读规范副本，单一事实来源）。
 * 与官方 run_tests.py 消费同一份数据：{ schema, tests: [{ description, valid, data }] }
 */
export const OFFICIAL_CASES_DIR = join(
  PACKAGE_ROOT,
  '..',
  'packages',
  'sdk',
  'resources',
  'specification',
  'v1_0',
  'test',
  'cases',
);

/** 官方 testing_catalog.json（函数/组件精确验证用） */
export const OFFICIAL_TESTING_CATALOG = join(
  PACKAGE_ROOT,
  '..',
  'packages',
  'sdk',
  'resources',
  'specification',
  'v1_0',
  'test',
  'testing_catalog.json',
);

/** 官方 contact_form_example.jsonl（JSONL 流式验证用） */
export const OFFICIAL_CONTACT_FORM_JSONL = join(
  PACKAGE_ROOT,
  '..',
  'packages',
  'sdk',
  'resources',
  'specification',
  'v1_0',
  'test',
  'cases',
  'contact_form_example.jsonl',
);

/** 官方测试用例文件（含 run_tests.py 的 "catalog" 切换字段） */
export interface OfficialCaseFile {
  file: string;
  /** suite 指定的 catalog 文件（缺省 basic catalog），与官方 run_tests.py 行为一致 */
  catalog: string;
  content: SchemaValidationTestFile;
}

/** 遍历官方 test/cases 目录，返回 { file, catalog, content } 列表（json 文件） */
export function listOfficialCaseFiles(): OfficialCaseFile[] {
  return readdirSync(OFFICIAL_CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const raw = JSON.parse(readFileSync(join(OFFICIAL_CASES_DIR, file), 'utf-8')) as SchemaValidationTestFile & {
        catalog?: string;
      };
      return { file, catalog: raw.catalog ?? 'catalog.json', content: raw };
    });
}

/** 遍历官方 test/cases 目录，返回全部用例（平铺，含 suite catalog） */
export function listOfficialCases(): Array<{
  file: string;
  catalog: string;
  schema: string;
  test: SchemaValidationTestFile['tests'][number];
}> {
  const cases: Array<{
    file: string;
    catalog: string;
    schema: string;
    test: SchemaValidationTestFile['tests'][number];
  }> = [];
  for (const { file, catalog, content } of listOfficialCaseFiles()) {
    for (const test of content.tests) {
      cases.push({ file, catalog, schema: content.schema, test });
    }
  }
  return cases;
}
