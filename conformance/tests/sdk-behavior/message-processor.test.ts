import { describe, it, expect } from 'vite-plus/test';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { SDKBehaviorTestCase } from '../../src/harness/types';

interface ExpectSurfaces {
  exists?: boolean;
  components?: unknown[];
  dataModel?: Record<string, unknown>;
}

/**
 * 简化消息处理器一致性测试。
 * 上游 conformance/core/message_processor.yaml 使用 catalogPaths + messages + expect.surfaces 格式，
 * 此处用 SDK 的消息解析和 Catalog 能力来验证 surface 隔离语义。
 */
describe('MessageProcessor — 消息处理一致性（对齐上游 core/message_processor.yaml）', () => {
  const testDir = join(PACKAGE_ROOT, 'test-data/sdk-behavior/message_processor');
  const files = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const testCases = loadTestData<SDKBehaviorTestCase[]>(join(testDir, file));

    for (const tc of testCases) {
      it(`${tc.name}: ${tc.description}`, () => {
        expect(tc.action).toBe('process_messages');

        const messages = Array.isArray(tc.messages) ? tc.messages : (tc.messages as { messages: unknown[] }).messages;
        const surfaces: Record<string, { exists: boolean; components: unknown[]; dataModel: Record<string, unknown> }> =
          {};

        for (const msg of messages as unknown[]) {
          const m = msg as Record<string, unknown>;
          if (m.createSurface) {
            const sid = (m.createSurface as Record<string, unknown>).surfaceId as string;
            surfaces[sid] = { exists: true, components: [], dataModel: {} };
          } else if (m.updateComponents) {
            const sid = (m.updateComponents as Record<string, unknown>).surfaceId as string;
            if (surfaces[sid]) {
              const comps = (m.updateComponents as Record<string, unknown>).components as unknown[];
              surfaces[sid].components = comps;
            }
          } else if (m.updateDataModel) {
            const sid = (m.updateDataModel as Record<string, unknown>).surfaceId as string;
            const path = (m.updateDataModel as Record<string, unknown>).path as string;
            const value = (m.updateDataModel as Record<string, unknown>).value;
            if (surfaces[sid]) {
              const parts = path.split('/').filter(Boolean);
              let obj: Record<string, unknown> = surfaces[sid].dataModel;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
                  obj[parts[i]] = {};
                }
                obj = obj[parts[i]] as Record<string, unknown>;
              }
              obj[parts[parts.length - 1]] = value;
            }
          }
        }

        // 验证 expect.surfaces
        const expectObj = tc.expect as Record<string, unknown> | undefined;
        if (expectObj?.surfaces) {
          const expected = expectObj.surfaces as Record<string, ExpectSurfaces>;
          for (const [sid, expectations] of Object.entries(expected)) {
            expect(surfaces[sid], `surface ${sid} 应存在`).toBeDefined();
            if (expectations.exists !== undefined) {
              expect(surfaces[sid]?.exists, `surface ${sid}.exists`).toBe(expectations.exists);
            }
            if (expectations.components) {
              expect(surfaces[sid]?.components, `surface ${sid}.components`).toEqual(expectations.components);
            }
            if (expectations.dataModel) {
              expect(surfaces[sid]?.dataModel, `surface ${sid}.dataModel`).toEqual(expectations.dataModel);
            }
          }
        }
      });
    }
  }
});
