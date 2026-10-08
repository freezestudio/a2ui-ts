/**
 * 正则安全检测（ReDoS / CWE-1333）
 *
 * 对齐上游 web_core `safe_regex.ts`（#2366）：使用 `redos-detector` 检测
 * 灾难性回溯模式（如 `(a+)+b`），并限制模式长度，避免在每次输入校验时冻结主线程。
 */
import { isSafePattern } from 'redos-detector';

/** 正则安全检测选项 */
export interface SafeRegexOptions {
  /** 允许的最大模式长度（默认 256） */
  maxPatternLength?: number;
}

/** 正则输入值最大长度（默认 4096），防止超长输入触发回溯 */
export const MAX_REGEX_INPUT_LENGTH = 4096;

/**
 * 判断正则模式是否安全（无灾难性回溯风险）。
 *
 * 同时检测原始模式与锚定形式（`^(?:pattern)$`），以便检出未锚定的
 * 尾部嵌套量词（如 `(a+)+`）。
 *
 * @returns 模式安全可用时返回 true；不安全或语法非法时返回 false
 */
export function isSafeRegex(pattern: string, options: SafeRegexOptions = {}): boolean {
  if (pattern === null || pattern === undefined || typeof pattern !== 'string') {
    return true;
  }
  if (pattern.length === 0) {
    return true;
  }

  const maxPatternLength = options.maxPatternLength ?? 256;
  if (pattern.length > maxPatternLength) {
    return false;
  }

  try {
    // 先确认宿主 JS 引擎能编译该模式
    new RegExp(pattern);
    return isSafePattern(pattern).safe && isSafePattern(`^(?:${pattern})$`).safe;
  } catch {
    return false;
  }
}
