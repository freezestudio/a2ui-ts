/**
 * Validator 组件属性 schema 校验回归测试。
 *
 * 回归背景：v1.0 组件 schema 使用相对引用 `common_types.json#/$defs/*`。
 * eval 的 Ajv 实例必须以根相对 key 注册 common_types，否则编译失败被 catch
 * 静默跳过，导致组件属性（如 Icon.name）漏检。
 */

import { describe, expect, it } from 'vitest';
import type { GeneratedResult } from '@freezestudio/a2ui-agent';
import { Validator } from './validator.js';

function makeResult(components: unknown[]): GeneratedResult {
  return {
    modelName: 'test',
    prompt: { name: 'test', description: 'test', promptText: '' },
    runNumber: 1,
    rawText: `<a2ui-json>${JSON.stringify([
      {
        version: 'v1.0',
        createSurface: {
          surfaceId: 'main',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
          components,
        },
      },
    ])}</a2ui-json>`,
    components: [],
    latency: 0,
  };
}

async function validate(components: unknown[]) {
  const validator = new Validator();
  const [result] = await validator.run([makeResult(components)]);
  return result.validationErrors;
}

describe('Validator 组件 schema 校验（相对 common_types 引用）', () => {
  it('Icon.name 非法时应报 schema 错误，而非静默跳过', async () => {
    const errors = await validate([
      { id: 'root', component: 'Column', children: ['icon1'] },
      { id: 'icon1', component: 'Icon', name: 123 },
    ]);

    const iconNameErrors = errors.filter((e) => e.path.includes('icon1') && e.path.includes('name'));
    expect(iconNameErrors.length).toBeGreaterThan(0);
    expect(iconNameErrors.some((e) => e.message.includes('oneOf'))).toBe(true);
  });

  it('Icon.name 合法 DataBinding 时不应有 name schema 错误', async () => {
    const errors = await validate([
      { id: 'root', component: 'Column', children: ['icon1'] },
      { id: 'icon1', component: 'Icon', name: { path: '/icon' } },
    ]);

    const iconNameErrors = errors.filter((e) => e.path.includes('icon1') && e.path.includes('name'));
    expect(iconNameErrors).toEqual([]);
  });

  it('Icon.name 合法内置名称时不应有 name schema 错误', async () => {
    const errors = await validate([
      { id: 'root', component: 'Column', children: ['icon1'] },
      { id: 'icon1', component: 'Icon', name: 'home' },
    ]);

    const iconNameErrors = errors.filter((e) => e.path.includes('icon1') && e.path.includes('name'));
    expect(iconNameErrors).toEqual([]);
  });
});
