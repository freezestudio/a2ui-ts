import { describe, beforeEach, it, expect } from 'vite-plus/test';
import { CatalogRegistry } from './catalog-registry';

describe('CatalogRegistry', () => {
  let registry: CatalogRegistry;

  beforeEach(() => {
    registry = new CatalogRegistry();
  });

  it('register 和 resolve 组件', () => {
    registry.register('basic', [{ type: 'Text', componentClass: class TextMock {} }]);
    const resolved = registry.resolve('basic', 'Text');
    expect(resolved).not.toBeNull();
  });

  it('解析未注册组件返回 null', () => {
    const resolved = registry.resolve('basic', 'Unknown');
    expect(resolved).toBeNull();
  });

  it('解析未注册 catalog 返回 null', () => {
    registry.register('basic', [{ type: 'Text', componentClass: class TextMock {} }]);
    const resolved = registry.resolve('geo', 'Text');
    expect(resolved).toBeNull();
  });

  it('getComponents 返回 Catalog 所有组件', () => {
    registry.register('basic', [
      { type: 'Text', componentClass: class TextMock {} },
      { type: 'Button', componentClass: class ButtonMock {} },
    ]);
    const components = registry.getComponents('basic');
    expect(components).toHaveLength(2);
  });

  it('getCatalogIds 返回所有已注册 Catalog', () => {
    registry.register('basic', [{ type: 'Text', componentClass: class TextMock {} }]);
    registry.register('geo', [{ type: 'RiskPanel', componentClass: class RiskMock {} }]);
    expect(registry.getCatalogIds()).toEqual(['basic', 'geo']);
  });
});
