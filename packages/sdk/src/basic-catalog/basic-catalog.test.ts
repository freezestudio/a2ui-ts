import { describe, it, beforeEach } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { BasicCatalog, BASIC_CATALOG_ID } from './index.js';

describe('BasicCatalog', () => {
  beforeEach(() => {
    BasicCatalog.clearCache();
  });

  describe('getInstance()', () => {
    it('返回 Catalog 实例', () => {
      const catalog = BasicCatalog.getFullInstance();
      assert.ok(catalog);
      assert.equal(typeof catalog.componentCount, 'number');
      assert.equal(typeof catalog.functionCount, 'number');
    });

    it('多次调用返回同一实例（单例）', () => {
      const a = BasicCatalog.getFullInstance();
      const b = BasicCatalog.getFullInstance();
      assert.equal(a, b);
    });
  });

  describe('getConfig()', () => {
    it('返回正确的 catalogId', () => {
      const config = BasicCatalog.getConfig();
      assert.equal(config.catalogId, BASIC_CATALOG_ID);
    });

    it('返回正确的 version', () => {
      const config = BasicCatalog.getConfig();
      assert.equal(config.version, 'v1_0');
    });
  });
});
