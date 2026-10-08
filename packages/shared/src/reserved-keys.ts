/**
 * 保留协议指令键（v1.0 #2692 / #2891：`@` 前缀）
 *
 * v1.0 将协议级动态指令前缀改为 `@`：
 * - `@path`（DataBinding）与 `@call`（FunctionCall）是合法的保留指令；
 * - 动态对象中任何其它未转义的单 `@` 键（匹配 `^@([^@]|$)`）都必须拒绝；
 * - 普通对象中需要表达以 `@` 开头的字面量键时，必须前缀加倍转义（`"@@path"` → `"@path"`）。
 */

/** 合法的保留指令集合 */
export const RESERVED_DIRECTIVES: ReadonlySet<string> = new Set(['@path', '@call']);

/**
 * 判断键是否为「未转义的单 `@` 键」（匹配 `^@([^@]|$)`）。
 * 前缀加倍（`@@...`）视为转义，返回 false。
 */
export function isSingleAtKey(key: string): boolean {
  return key.startsWith('@') && !key.startsWith('@@');
}

/**
 * 去转义普通对象键：`@@path` → `@path`；其余键原样返回。
 */
export function unescapeObjectKey(key: string): string {
  return key.startsWith('@@') ? key.slice(1) : key;
}

/**
 * 校验动态对象键集合：任何未转义且非合法指令的单 `@` 键都非法。
 *
 * @throws {Error} 当发现未识别的保留键
 */
export function assertNoUnknownReservedKeys(keys: Iterable<string>): void {
  for (const key of keys) {
    if (isSingleAtKey(key) && !RESERVED_DIRECTIVES.has(key)) {
      throw new Error(
        `Unrecognized reserved protocol directive '${key}'. Reserved keys must be ${[...RESERVED_DIRECTIVES].join(
          ', ',
        )}, or escaped with prefix doubling (e.g. '@${key}').`,
      );
    }
  }
}
