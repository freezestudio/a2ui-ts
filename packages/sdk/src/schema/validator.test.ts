import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { A2uiValidator, STRICT_VALIDATION, RELAXED_VALIDATION } from './validator.js';
import type { UpdateComponentsMessage } from './index.js';

// 构造合法的 CreateSurface 消息
function makeCreateSurfaceMessage(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    version: 'v1.0',
    createSurface: {
      surfaceId: 'surface-1',
      catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      ...overrides,
    },
    ...(overrides as Record<string, Record<string, unknown>>)?.['_extra'],
  };
}

// 构造合法的 UpdateComponents 消息
function makeUpdateComponentsMessage(
  components: Array<Record<string, unknown>>,
  surfaceId = 'surface-1',
): UpdateComponentsMessage {
  return {
    version: 'v1.0',
    updateComponents: {
      surfaceId,
      components: components as never,
    },
  } as UpdateComponentsMessage;
}

// 包含 root 的合法组件列表
function makeValidComponents(): Array<Record<string, unknown>> {
  return [
    { id: 'root', component: 'Column', children: ['child-1'] },
    { id: 'child-1', component: 'Text' },
  ];
}

describe('A2uiValidator', () => {
  const validator = new A2uiValidator();

  describe('协议信封校验 validateServerToClientMessage', () => {
    it('合法的 CreateSurface 消息 → valid', () => {
      const msg = makeCreateSurfaceMessage();
      const result = validator.validateServerToClientMessage(msg);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('合法的 UpdateComponents 消息 → valid', () => {
      const msg = makeUpdateComponentsMessage(makeValidComponents());
      const result = validator.validateServerToClientMessage(msg);
      assert.equal(result.valid, true);
    });

    it('合法但版本号错误 → invalid', () => {
      const msg = {
        version: 'v999.0',
        createSurface: {
          surfaceId: 's1',
          catalogId: 'c1',
        },
      };
      const result = validator.validateServerToClientMessage(msg);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('缺少必填字段 → invalid', () => {
      const msg = { version: 'v1.0' };
      const result = validator.validateServerToClientMessage(msg);
      assert.equal(result.valid, false);
    });

    it('非法的额外属性 → invalid（strict schema）', () => {
      const msg = {
        version: 'v1.0',
        createSurface: {
          surfaceId: 's1',
          catalogId: 'c1',
          unknownField: 'bad',
        },
      };
      const result = validator.validateServerToClientMessage(msg);
      assert.equal(result.valid, false);
    });
  });

  describe('组件校验 validateComponents', () => {
    it('包含 root 的合法组件列表 → valid', () => {
      const msg = makeUpdateComponentsMessage(makeValidComponents());
      const result = validator.validateComponents(msg, STRICT_VALIDATION);
      assert.equal(result.valid, true, `期望 valid，但得到错误: ${JSON.stringify(result.errors)}`);
    });

    it('缺少 root → invalid（strict）', () => {
      const components = [{ id: 'child-1', component: 'Text', text: 'hello' }];
      const msg = makeUpdateComponentsMessage(components);
      const result = validator.validateComponents(msg, STRICT_VALIDATION);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.message.includes('root')));
    });

    it('缺少 root → valid（relaxed）', () => {
      const components = [{ id: 'child-1', component: 'Text', text: 'hello' }];
      const msg = makeUpdateComponentsMessage(components);
      const result = validator.validateComponents(msg, RELAXED_VALIDATION);
      assert.equal(result.valid, true, `期望 relaxed 下 valid，但得到错误: ${JSON.stringify(result.errors)}`);
    });

    it('重复 ID → invalid', () => {
      const components = [
        { id: 'root', component: 'Column', children: ['dup'] },
        { id: 'dup', component: 'Text', text: 'a' },
        { id: 'dup', component: 'Text', text: 'b' },
      ];
      const msg = makeUpdateComponentsMessage(components);
      const result = validator.validateComponents(msg, { ...STRICT_VALIDATION, runTopologyAnalysis: false });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.message.includes('重复')));
    });

    it('悬空引用 → invalid', () => {
      const components = [{ id: 'root', component: 'Column', children: ['nonexistent'] }];
      const msg = makeUpdateComponentsMessage(components);
      const result = validator.validateComponents(msg, { ...STRICT_VALIDATION, runTopologyAnalysis: false });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.message.includes('悬空引用') || e.message.includes('不存在')));
    });
  });

  describe('消息列表校验 validateMessageList', () => {
    it('多条合法消息 → valid', () => {
      const messages = [makeCreateSurfaceMessage(), makeUpdateComponentsMessage(makeValidComponents())];
      const result = validator.validateMessageList(messages, RELAXED_VALIDATION);
      assert.equal(result.valid, true, `期望 valid，但得到错误: ${JSON.stringify(result.errors)}`);
    });

    it('包含非法消息 → invalid', () => {
      const messages = [makeCreateSurfaceMessage(), { version: 'v999.0', bogus: true }];
      const result = validator.validateMessageList(messages, RELAXED_VALIDATION);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
    });

    it('空消息列表 → valid', () => {
      const result = validator.validateMessageList([], STRICT_VALIDATION);
      assert.equal(result.valid, true);
    });
  });
});
