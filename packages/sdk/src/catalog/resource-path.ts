/**
 * 资源路径工具 — 解析内置 Schema 和 Catalog 文件路径
 * 自动检测开发环境和构建后环境的路径差异
 *
 * 资源目录结构（semantics）：
 * - resources/specification/v1_0/  ← A2UI 官方协议规范副本（只读，含 docs / json schema / test）
 * - resources/catalogs/            ← A2UI 官方 Catalog 副本（只读，独立于协议版本）
 *                                      basic/v1/catalog.json、mcp/catalog.json
 *   （自定义 geo-catalog 已外移至 @geo/geo-catalog 包，见 packages/geo-catalog/）
 *
 * 说明：上游自 #2693 起把 v1.0 basic catalog 从 specification/v1_0/catalogs/
 * 迁到仓库顶层 catalogs/（由 catalog 自身 $id 标识，发布 URL 不变）。
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/** 查找包含 resources/ 的包根目录 */
function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  // dist/ → src/ → catalog/ 等多层，向上查找直到找到 resources/ 目录
  while (dir !== '/') {
    if (existsSync(join(dir, 'resources', 'specification'))) {
      return dir;
    }
    dir = dirname(dir);
  }

  // 兜底：使用当前模块位置向上 3 级（兼容构建后 dist/index.js 场景）
  return join(dirname(currentFile), '..', '..', '..');
}

let _packageRoot: string | null = null;

function getPackageRoot(): string {
  if (!_packageRoot) {
    _packageRoot = findPackageRoot();
  }
  return _packageRoot;
}

export function getSchemaDir(): string {
  return join(getPackageRoot(), 'resources', 'specification', 'v1_0', 'json');
}

/**
 * 顶层 Catalog 目录（resources/catalogs）
 * Catalog 由自身 $id 标识并独立于协议版本演进，上游自 #2693 起置于仓库顶层。
 */
export function getCatalogsDir(): string {
  return join(getPackageRoot(), 'resources', 'catalogs');
}

/** @deprecated 使用 getCatalogsDir()；保留仅为向后兼容 */
export function getCatalogDir(): string {
  return getCatalogsDir();
}

export function createBasicCatalogPath(): string {
  return join(getCatalogsDir(), 'basic', 'v1', 'catalog.json');
}

export function getSchemaPath(name: string): string {
  return join(getSchemaDir(), `${name}.json`);
}

/** 清除缓存（用于测试） */
export function clearResourceCache(): void {
  _packageRoot = null;
}
