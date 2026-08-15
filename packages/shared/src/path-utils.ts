/**
 * JSON Pointer 路径工具
 *
 * 支持 JSON Pointer RFC 6901 转义（~1 → /、~0 → ~）。
 * pointer 系列工具原属 @geo/shared，下沉到本包使 A2UI 协议 SDK 可独立复用。
 */

/** 解析 JSON Pointer 为 token 数组（含 ~0/~1 转义还原） */
export function parsePointer(pointer: string): string[] {
  if (pointer === '' || pointer === '/') {
    return [];
  }

  const path = pointer.startsWith('/') ? pointer.slice(1) : pointer;

  if (path === '') {
    return [];
  }

  return path.split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** 将 token 数组序列化为 JSON Pointer 字符串（含转义） */
export function serializePointer(tokens: string[]): string {
  if (tokens.length === 0) {
    return '';
  }

  const escaped = tokens.map((token) => token.replace(/~/g, '~0').replace(/\//g, '~1'));

  return '/' + escaped.join('/');
}

/** 归一化路径：空/根返回空串，非 / 开头补 / */
export function normalizePath(path: string): string {
  if (path === '' || path === '/') {
    return '';
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}

/** 获取父路径 */
export function getParentPath(path: string): string {
  const tokens = parsePointer(path);
  if (tokens.length === 0) {
    return '';
  }
  return serializePointer(tokens.slice(0, -1));
}

/** 判断 ancestor 是否为 descendant 的祖先路径 */
export function isAncestorPath(ancestor: string, descendant: string): boolean {
  if (ancestor === '') {
    return descendant !== '';
  }
  const normalizedAncestor = normalizePath(ancestor);
  const normalizedDescendant = normalizePath(descendant);
  return normalizedDescendant.startsWith(normalizedAncestor + '/') || normalizedDescendant === normalizedAncestor;
}

/** parseJsonPointer 别名（兼容） */
export const parseJsonPointer = parsePointer;

/**
 * 从数据模型中解析 JSON Pointer 路径
 *
 * @param binding - 包含 path 属性的对象
 * @param data - 数据模型
 * @returns 路径对应的值，不存在时返回 undefined
 */
export function resolvePath(binding: { path: string }, data: Record<string, unknown>): unknown {
  const tokens = parsePointer(binding.path);
  let current: unknown = data;

  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[token];
  }

  return current;
}
