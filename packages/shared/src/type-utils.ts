/**
 * 将未知类型的值转换为字符串
 *
 * 转换规则：
 * - null/undefined → 空字符串
 * - object → JSON 序列化
 * - boolean → 'true'/'false'
 * - 其他 → String()
 */
export function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

/**
 * 将未知类型的值转换为浮点数
 *
 * @throws 当值无法转换为有效数字时抛出错误
 */
export function toFloat(val: unknown): number {
  if (val === null || val === undefined) {
    throw new Error(`无法转换为数字: ${String(val as unknown as string | number | bigint | symbol)}`);
  }
  const n = Number(val);
  if (Number.isNaN(n)) throw new Error(`无法转换为数字: ${String(val as string | number | bigint | symbol)}`);
  return n;
}
