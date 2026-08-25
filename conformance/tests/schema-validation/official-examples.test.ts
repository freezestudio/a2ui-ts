import { describe, it, expect } from 'vite-plus/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { A2uiMessageSchema } from '@freezestudio/a2ui-sdk';

/**
 * 官方 basic catalog examples 一致性校验
 *
 * examples 是官方维护的完整 UI 场景（catalogs/basic/examples/*.json，
 * 结构 { name, description, messages }），与规范 test/cases 互为补充：
 * - test/cases 覆盖单点 schema 校验
 * - examples 覆盖完整消息流（createSurface → updateComponents 等）
 *
 * 此处用 SDK 的 A2uiMessageSchema（zod）校验每条消息，防止实现随协议演进漂移。
 */
const EXAMPLES_DIR = join(
  PACKAGE_ROOT,
  '..',
  'packages',
  'sdk',
  'resources',
  'specification',
  'v1_0',
  'catalogs',
  'basic',
  'examples',
);

describe('官方 basic catalog examples（SDK zod 一致性）', () => {
  const files = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  it(`覆盖 ${files.length} 个官方 examples`, () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), 'utf8')) as {
      name?: string;
      messages?: unknown[];
    };
    const msgs = doc.messages ?? [];

    it(`[examples/${file}] ${doc.name ?? ''} 的 ${msgs.length} 条消息均通过 A2uiMessageSchema`, () => {
      for (const msg of msgs) {
        const result = A2uiMessageSchema.safeParse(msg);
        expect(result.success, JSON.stringify(result.error?.issues ?? []).slice(0, 500)).toBe(true);
      }
    });
  }
});
