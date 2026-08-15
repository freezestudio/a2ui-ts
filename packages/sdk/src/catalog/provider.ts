/**
 * Catalog 提供器 — 从文件系统或内存加载 Catalog
 * 对应 Python: catalog/catalog.py（文件加载部分）
 * 对应 agent_sdk_guide.md 中的 CatalogProvider
 *
 * 设计说明：
 * - CatalogProvider 负责从文件系统加载原始 JSON Catalog
 * - 使用 Catalog.fromJson() 将 JSON 数据转换为 Catalog 实例
 * - BasicCatalog 提供开箱即用的内置 Catalog
 */

import { readFile } from 'node:fs/promises';
import { Catalog } from './catalog.js';
import type { CatalogConfig } from './types.js';
import { createBasicCatalogPath } from './resource-path.js';
import { BASIC_CATALOG_ID } from '../basic-catalog/index.js';

// ============================================================================
// CatalogProvider
// ============================================================================

/**
 * Catalog 提供器
 * 负责从文件系统加载 Catalog JSON 并缓存
 */
export class CatalogProvider {
  private config: CatalogConfig;
  private catalog: Catalog | null = null;

  constructor(config: CatalogConfig) {
    this.config = config;
  }

  /**
   * 加载 Catalog（带缓存）
   */
  async load(): Promise<Catalog> {
    if (this.catalog) {
      return this.catalog;
    }

    const catalogPath = this.config.path ?? createBasicCatalogPath();

    try {
      const content = await readFile(catalogPath, 'utf-8');
      const data = JSON.parse(content) as Record<string, unknown>;
      this.catalog = Catalog.fromJson(data as Parameters<typeof Catalog.fromJson>[0]);
      return this.catalog;
    } catch (error) {
      throw new Error(`加载 Catalog 失败: ${catalogPath} - ${String(error as string | number | bigint | symbol)}`);
    }
  }

  /** 获取 Catalog 配置 */
  getConfig(): CatalogConfig {
    return this.config;
  }

  /** 清除缓存 */
  clearCache(): void {
    this.catalog = null;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建默认 Catalog 提供器
 */
export function createDefaultCatalogProvider(): CatalogProvider {
  return new CatalogProvider({
    catalogId: BASIC_CATALOG_ID,
    version: 'v1_0',
  });
}
