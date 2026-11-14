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

/** 校验结果对象（A2UI v1.0 ValidationResult） */
export interface ValidationResultLike {
  valid: boolean;
  code?: string;
  message?: string;
  severity?: 'error' | 'warning' | 'info';
}

/** 判断是否为带布尔 `valid` 属性的校验结果对象 */
export function isValidationResult(value: unknown): value is ValidationResultLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)['valid'] === 'boolean'
  );
}

/**
 * DynamicBoolean 强制转换（A2UI v1.0 规范）。
 *
 * | 解析值                                      | 结果           |
 * | ------------------------------------------- | -------------- |
 * | boolean                                     | 原值           |
 * | ValidationResult（含布尔 valid）            | `result.valid` |
 * | `"true"` / `"false"`（大小写不敏感）        | true / false   |
 * | 其他字符串（含 ""、"hello"）                | false          |
 * | number 0                                    | false          |
 * | 其他 number                                 | true           |
 * | null / 缺省                                 | false          |
 * | 其他对象 / 数组                             | false          |
 */
export function coerceDynamicBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (isValidationResult(value)) return value.valid;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' ? true : normalized === 'false' ? false : false;
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

/**
 * CheckRule.condition 强制转换（A2UI v1.0 规范）。
 *
 * - `true` → `{valid: true}`
 * - `false` → `{valid: false, message: <CheckRule.message>, severity: 'error'}`
 * - `ValidationResult` → 保留；`valid: false` 时缺失 message 用兜底、缺失 severity 用 `error`
 * - 其他值按 DynamicBoolean 规则转换
 */
export function coerceValidationResult(value: unknown, fallbackMessage?: string): ValidationResultLike {
  if (isValidationResult(value)) {
    if (value.valid) return { ...value, valid: true };
    return {
      ...value,
      valid: false,
      message: value.message ?? fallbackMessage,
      severity: value.severity ?? 'error',
    };
  }
  if (coerceDynamicBoolean(value)) return { valid: true };
  return {
    valid: false,
    ...(fallbackMessage !== undefined ? { message: fallbackMessage } : {}),
    severity: 'error',
  };
}
