/**
 * JSON 修复工具 — 智能引号归一、尾逗号移除、安全片段修复
 *
 * 原属 @geo/shared，下沉到本包使 A2UI 协议 SDK 可独立复用。
 */

const SMART_DOUBLE_QUOTES = /[\u201c\u201d\u201e\u201f\u2033\u2036]/g;
const SMART_SINGLE_QUOTES = /[\u2018\u2019\u201a\u201b\u2032\u2035]/g;
const TRAILING_COMMA = /,(\s*[}\]])/g;

/**
 * 可安全补全未闭合字符串的键名白名单。
 *
 * 对应上游 Python SDK `DEFAULT_CUTTABLE_KEYS`：
 * 结构键或原子键（id/surfaceId/path 等）禁止补全，
 * 防止截断片段被错误修复为损坏的 JSON 或错误的绑定。
 */
export const CUTTABLE_KEYS = new Set(['literalString', 'valueString', 'label', 'hint', 'caption', 'altText', 'text']);

/** URL 类键名（值以 http/https/data: 开头或键名含 url/link/src/href/image 时不补全） */
const URL_LIKE_KEY_HINTS = ['url', 'link', 'src', 'href', 'image'];

/** 将智能引号归一化为半角引号 */
export function normalizeSmartQuotes(input: string): string {
  return input.replace(SMART_DOUBLE_QUOTES, '"').replace(SMART_SINGLE_QUOTES, "'");
}

/** 移除数组/对象末尾多余的逗号 */
export function removeTrailingCommas(input: string): string {
  return input.replace(TRAILING_COMMA, '$1');
}

/**
 * 修复截断的 JSON 片段：仅补全未闭合的字符串引号与括号。
 *
 * 对应上游 Python SDK `DirectJsonStreamParser._fix_json`：
 * - 单遍扫描跟踪字符串/转义/括号栈，避免误判字符串内的结构字符
 * - 未闭合字符串仅在键名属于 `CUTTABLE_KEYS` 白名单时补全引号
 * - URL 类值（http/https/data: 前缀、data model 中 url/link/src/href/image 键）拒绝修复，
 *   防止截断的路径/URL 绑定被补成坏 JSON
 * - 清理尾逗号并闭合剩余括号
 *
 * @param fragment - 可能截断的 JSON 片段
 * @returns 修复后的片段；无法安全修复时返回空字符串
 */
export function fixPartialJsonFragment(fragment: string): string {
  let fixed = fragment.replace(/\s+$/, '');
  if (!fixed) return '';

  const stack: Array<'{' | '['> = [];
  let inString = false;
  let escaped = false;
  let lastQuoteIdx = -1;

  // 单遍扫描：跟踪字符串与括号状态
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      if (inString) lastQuoteIdx = i;
    } else if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) stack.pop();
      }
    }
  }

  // 1. 补全未闭合字符串（仅白名单键名）
  if (inString) {
    const prefix = fixed.slice(0, lastQuoteIdx).replace(/\s+$/, '');
    if (prefix.endsWith(':')) {
      const keyMatch = /"([^"]+)"\s*:\s*$/.exec(prefix);
      if (keyMatch) {
        const key = keyMatch[1];
        if (!CUTTABLE_KEYS.has(key)) {
          return '';
        }

        // URL 绑定保护：值以 http/https/data: 或 / 开头时拒绝修复
        const stringVal = fixed.slice(lastQuoteIdx + 1);
        if (
          stringVal.startsWith('http://') ||
          stringVal.startsWith('https://') ||
          stringVal.startsWith('data:') ||
          stringVal.startsWith('/')
        ) {
          return '';
        }

        // 向前查找最近的 "key" 赋值，判断是否属于 URL 类数据键
        const prevKeyMatches = /"key"\s*:\s*"([^"]+)"/g.exec(prefix.slice(-200));
        if (prevKeyMatches) {
          const dataKey = prevKeyMatches[1].toLowerCase();
          if (URL_LIKE_KEY_HINTS.some((hint) => dataKey.includes(hint))) {
            return '';
          }
        }
      }
    }
    fixed += '"';
  }

  // 2. 清理尾逗号
  fixed = fixed.replace(/\s+$/, '');
  if (fixed.endsWith(',')) {
    fixed = fixed.slice(0, -1).replace(/\s+$/, '');
  }

  // 3. 闭合剩余括号
  while (stack.length > 0) {
    const opening = stack.pop()!;
    fixed += opening === '{' ? '}' : ']';
  }

  return fixed;
}
