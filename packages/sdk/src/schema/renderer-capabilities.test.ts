import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  FunctionDefinitionSchema,
  A2uiClientCapabilitiesSchema,
  getV10Capabilities,
  FUNCTION_RETURN_TYPES,
  FUNCTION_ALLOWED_CALLERS,
} from './renderer-capabilities.js';

describe('renderer-capabilities', () => {
  // ==========================================================================
  // FunctionDefinitionSchema（对齐官方 catalog_definition.json FunctionDefinition）
  // ==========================================================================
  describe('FunctionDefinitionSchema', () => {
    it('应解析最小合法定义（name + parameters）', () => {
      const def = { name: 'required', parameters: {} };
      assert.deepEqual(FunctionDefinitionSchema.parse(def), def);
    });

    it('应解析完整合法定义', () => {
      const def = {
        name: 'openUrl',
        description: 'open a url',
        parameters: { type: 'object' },
        returnType: 'void',
        allowedCallers: 'rendererOnly',
        requiresUserActivation: true,
      };
      assert.deepEqual(FunctionDefinitionSchema.parse(def), def);
    });

    it('应拒绝非法 returnType', () => {
      assert.throws(() => FunctionDefinitionSchema.parse({ name: 'f', parameters: {}, returnType: 'invalid' }));
    });

    it('应拒绝非法 allowedCallers', () => {
      assert.throws(() => FunctionDefinitionSchema.parse({ name: 'f', parameters: {}, allowedCallers: 'anyone' }));
    });

    it('requiresUserActivation=true 时 allowedCallers 必须为 rendererOnly', () => {
      assert.throws(() =>
        FunctionDefinitionSchema.parse({
          name: 'f',
          parameters: {},
          returnType: 'string',
          allowedCallers: 'agentOnly',
          requiresUserActivation: true,
        }),
      );
      // rendererOnly 合法
      assert.doesNotThrow(() =>
        FunctionDefinitionSchema.parse({
          name: 'f',
          parameters: {},
          returnType: 'string',
          allowedCallers: 'rendererOnly',
          requiresUserActivation: true,
        }),
      );
    });

    it('requiresUserActivation=true 且未声明 allowedCallers 合法（默认 rendererOnly）', () => {
      assert.doesNotThrow(() =>
        FunctionDefinitionSchema.parse({ name: 'f', parameters: {}, returnType: 'void', requiresUserActivation: true }),
      );
    });

    it('枚举常量与官方 catalog_definition.json 一致', () => {
      assert.deepEqual(
        [...FUNCTION_RETURN_TYPES],
        ['string', 'number', 'boolean', 'array', 'object', 'validationResult', 'any', 'void'],
      );
      assert.deepEqual([...FUNCTION_ALLOWED_CALLERS], ['rendererOnly', 'agentOnly', 'rendererOrAgent']);
    });
  });

  // ==========================================================================
  // A2uiClientCapabilitiesSchema
  // ==========================================================================
  describe('A2uiClientCapabilitiesSchema', () => {
    it('应解析 v1.0 能力声明', () => {
      const caps = {
        'v1.0': {
          supportedCatalogIds: ['https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'],
        },
      };
      assert.deepEqual(A2uiClientCapabilitiesSchema.parse(caps), caps);
    });

    it('getV10Capabilities 提取 v1.0 声明', () => {
      const caps = A2uiClientCapabilitiesSchema.parse({
        'v1.0': { supportedCatalogIds: ['https://example.com/catalog.json'] },
      });
      assert.equal(getV10Capabilities(caps)?.supportedCatalogIds.length, 1);
    });
  });
});
