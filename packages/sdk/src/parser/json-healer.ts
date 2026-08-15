import { normalizeSmartQuotes as _nSQ, removeTrailingCommas as _rTC } from '@a2ui-ts/shared';

export const normalizeSmartQuotes = _nSQ;
export const removeTrailingCommas = _rTC;

/** 基于括号栈补全未闭合的 JSON */
export function healJson(raw: string, openBrackets: Array<'{' | '['>): string {
  let healed = raw;
  healed = normalizeSmartQuotes(healed);
  healed = removeTrailingCommas(healed);
  for (let i = openBrackets.length - 1; i >= 0; i--) {
    healed += openBrackets[i] === '{' ? '}' : ']';
  }
  return healed;
}

/** 尝试解析 JSON，支持迭代修复（去逗号、补括号） */
export function tryParseJson(raw: string, openBrackets: Array<'{' | '['>): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    /* 继续修复 */
  }

  const normalized = removeTrailingCommas(normalizeSmartQuotes(raw));
  try {
    return JSON.parse(normalized);
  } catch {
    /* 继续 */
  }

  const healed = healJson(raw, openBrackets);
  try {
    return JSON.parse(healed);
  } catch {
    /* 继续 */
  }

  const healed2 = healJson(normalized, openBrackets);
  try {
    return JSON.parse(healed2);
  } catch {
    return;
  }
}

/** 判断对象是否像组件（有 id 和 component 字段） */
export function isComponentLike(obj: unknown): obj is { id: string; component: string; [key: string]: unknown } {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return typeof record['id'] === 'string' && typeof record['component'] === 'string';
}
