/**
 * A2UI BasicCatalog 工厂
 * 对应 Python: basic_catalog/__init__.py
 * 对应 agent_sdk_guide.md 中的 BasicCatalog 单例
 *
 * FullCatalog: 18 个组件 + 26 个函数（14 个官方 + 12 个扩展）
 *   官方组件参考：https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json
 */

import { Catalog } from '../catalog/catalog.js';
import { FULL_COMPONENTS } from './components/index.js';
import { FULL_FUNCTIONS, OFFICIAL_FUNCTIONS } from './functions/index.js';

/** 官方 v1.0 Basic Catalog ID */
export const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/** 项目扩展 Catalog ID（含官方组件 + 扩展函数） */
export const EXTENDED_CATALOG_ID = 'https://freezestudio.dev/a2ui/v1.0/catalogs/extended.json';

/**
 * 创建官方 v1.0 Basic Catalog（18 个组件 + 14 个官方函数）
 */
export function createBasicCatalog(): Catalog {
  return new Catalog({
    catalogId: BASIC_CATALOG_ID,
    version: 'v1_0',
    components: FULL_COMPONENTS,
    functions: OFFICIAL_FUNCTIONS,
  });
}

/**
 * 创建项目扩展 Full Catalog（18 个组件 + 26 个函数）。
 * 扩展函数不得挂载在官方 basic catalog ID 下。
 */
export function createFullCatalog(): Catalog {
  return new Catalog({
    catalogId: EXTENDED_CATALOG_ID,
    version: 'v1_0',
    components: FULL_COMPONENTS,
    functions: FULL_FUNCTIONS,
  });
}

/**
 * BasicCatalog — 预制 Catalog 工厂（单例模式）
 * 提供开箱即用的 Catalog 实例
 */
export class BasicCatalog {
  private static _fullInstance: Catalog | null = null;

  /** 获取 Full Catalog 单例 */
  static getFullInstance(): Catalog {
    if (!BasicCatalog._fullInstance) {
      BasicCatalog._fullInstance = createFullCatalog();
    }
    return BasicCatalog._fullInstance;
  }

  /** 获取 Catalog 配置 */
  static getConfig(): { catalogId: string; version: string } {
    return {
      catalogId: BASIC_CATALOG_ID,
      version: 'v1_0',
    };
  }

  /** 获取 Full Catalog 实例 */
  static getFullCatalog(): Catalog {
    return BasicCatalog.getFullInstance();
  }

  /** 清除缓存（用于测试） */
  static clearCache(): void {
    BasicCatalog._fullInstance = null;
  }
}
