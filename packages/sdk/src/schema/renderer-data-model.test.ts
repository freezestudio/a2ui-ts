import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { RendererDataModelSchema, isRendererDataModel, type RendererDataModel } from './renderer-data-model.js';

describe('renderer-data-model', () => {
  // ==========================================================================
  // RendererDataModelSchema
  // ==========================================================================
  describe('RendererDataModelSchema', () => {
    it('应解析合法的 {version, surfaces}', () => {
      const payload: RendererDataModel = {
        version: 'v1.0',
        surfaces: {
          main: { user_id: '12345', email: 'user@example.com' },
        },
      };
      assert.deepEqual(RendererDataModelSchema.parse(payload), payload);
    });

    it('应解析空 surfaces', () => {
      const payload = { version: 'v1.0', surfaces: {} };
      assert.deepEqual(RendererDataModelSchema.parse(payload), payload);
    });

    it('应拒绝缺少 version', () => {
      assert.throws(() => RendererDataModelSchema.parse({ surfaces: {} }));
    });

    it('应拒绝非 v1.0 版本号', () => {
      assert.throws(() => RendererDataModelSchema.parse({ version: 'v0.9', surfaces: {} }));
    });

    it('应拒绝缺少 surfaces', () => {
      assert.throws(() => RendererDataModelSchema.parse({ version: 'v1.0' }));
    });

    it('应拒绝额外顶层属性（对齐 additionalProperties: false）', () => {
      assert.throws(() => RendererDataModelSchema.parse({ version: 'v1.0', surfaces: {}, extra: 1 }));
    });
  });

  // ==========================================================================
  // isRendererDataModel
  // ==========================================================================
  describe('isRendererDataModel', () => {
    it('合法载荷返回 true', () => {
      assert.equal(isRendererDataModel({ version: 'v1.0', surfaces: { s: { a: 1 } } }), true);
    });

    it('非法载荷返回 false', () => {
      assert.equal(isRendererDataModel({ version: 'v1.0' }), false);
      assert.equal(isRendererDataModel(null), false);
      assert.equal(isRendererDataModel('str'), false);
    });
  });
});
