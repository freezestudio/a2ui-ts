import { describe, it, expect } from 'vite-plus/test';
import { DataModel } from '@freezestudio/a2ui-sdk';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { SDKBehaviorTestCase } from '../../src/harness/types';

describe('DataModel — reactive data model 一致性（对齐上游 core/data_model.yaml）', () => {
  const testDir = join(PACKAGE_ROOT, 'test-data/sdk-behavior/data_model');
  const files = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const testCases = loadTestData<SDKBehaviorTestCase[]>(join(testDir, file));

    for (const tc of testCases) {
      it(`${tc.name}: ${tc.description}`, () => {
        expect(tc.action).toBe('data_model');
        const model = new DataModel();

        // 设置 initial 数据
        if (tc.initial !== undefined) {
          for (const [key, value] of Object.entries(tc.initial)) {
            model.set('/' + key, value);
          }
        }

        for (const step of tc.steps ?? []) {
          switch (step.op) {
            case 'get': {
              const result = model.get(step.path);
              if (step.expect !== undefined) {
                expect(result, `path=${step.path} expect=${JSON.stringify(step.expect)}`).toEqual(step.expect);
              }
              if (step.expect_absent) {
                expect(result, `path=${step.path} 应不存在`).toBeUndefined();
              }
              if (step.expect_type === 'list') {
                expect(Array.isArray(result), `path=${step.path} 应为 list`).toBe(true);
              }
              if (step.expect_type === 'object') {
                expect(
                  typeof result === 'object' && !Array.isArray(result) && result !== null,
                  `path=${step.path} 应为 object`,
                ).toBe(true);
              }
              if (step.expect_values) {
                for (const [path, val] of Object.entries(step.expect_values)) {
                  expect(model.get(path), `path=${path} expect_values`).toEqual(val);
                }
              }
              if (step.expect_error) {
                expect(true).toBe(false); // 不应到达此处
              }
              break;
            }
            case 'set': {
              model.set(step.path, step.value);
              break;
            }
            case 'delete': {
              model.set(step.path, undefined);
              break;
            }
            case 'dispose': {
              model.dispose();
              break;
            }
          }
        }
      });
    }
  }
});
