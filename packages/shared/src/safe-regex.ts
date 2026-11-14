/**
 * 正则安全检测（A2UI v1.0 regex 方言 + 静态安全规则）
 *
 * 对齐上游 `web_core/src/common/regex_subset.ts`（#3854）：解析 A2UI 可移植正则子集，
 * 并执行 4 条静态安全检查：
 *   1. 模式长度 > 256 code points
 *   2. 上界 > 1 的量词作用于包含无界量词的子表达式
 *   3. 无界量词作用于首字符集重叠的 alternation
 *   4. 相邻的无界量词字符集重叠
 *
 * 运行时匹配还应使用 `new RegExp(pattern, 'u')`，并限制输入值 ≤ 4096 code points。
 */
import {
  analyzeRegex,
  countCodePoints,
  MAX_REGEX_PATTERN_CODE_POINTS,
  MAX_REGEX_VALUE_CODE_POINTS,
} from './regex-subset.js';

/** 正则安全检测选项 */
export interface SafeRegexOptions {
  /** 允许的最大模式长度（默认 256 code points） */
  maxPatternLength?: number;
}

/** 正则输入值最大长度（默认 4096 code points），防止超长输入触发回溯 */
export const MAX_REGEX_INPUT_LENGTH = MAX_REGEX_VALUE_CODE_POINTS;

/**
 * 判断正则模式是否符合 A2UI regex 方言且通过静态安全检查。
 *
 * @returns 模式可用时返回 true；语法不受支持或存在回溯风险时返回 false
 */
export function isSafeRegex(pattern: string, options: SafeRegexOptions = {}): boolean {
  if (pattern === null || pattern === undefined || typeof pattern !== 'string') {
    return true;
  }
  if (pattern.length === 0) {
    return true;
  }

  const maxPatternLength = options.maxPatternLength ?? MAX_REGEX_PATTERN_CODE_POINTS;
  if (countCodePoints(pattern) > maxPatternLength) {
    return false;
  }

  return analyzeRegex(pattern).ok;
}

export { analyzeRegex, countCodePoints, MAX_REGEX_PATTERN_CODE_POINTS, MAX_REGEX_VALUE_CODE_POINTS };
