import { ExpressionParser } from './expression-parser.js';
import { resolvePath } from './path-utils.js';
import { toStr } from './type-utils.js';

/**
 * evaluateExpression 选项
 */
export interface EvaluateOptions {
  /** 严格模式，解析失败时抛出错误（默认 true） */
  strict?: boolean;
  /** 函数调用回调 */
  callFunction?: (fn: { call: string; args: Record<string, unknown> }, context: Record<string, unknown>) => unknown;
}

/**
 * 解析并求值模板表达式
 *
 * @param template - 模板字符串，包含 ${...} 插值
 * @param context - 数据模型上下文
 * @param options - 选项（strict 模式、callFunction 回调）
 * @returns 求值后的字符串
 */
export function evaluateExpression(
  template: string,
  context: Record<string, unknown>,
  options: EvaluateOptions = {},
): string {
  const { strict = true, callFunction: callFn } = options;

  try {
    const parser = new ExpressionParser();
    const parts = parser.parse(template);

    return parts
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'number' || typeof part === 'boolean') return toStr(part);
        if ('path' in part) {
          const val = resolvePath(part, context);
          return val != null ? toStr(val) : '';
        }
        if ('call' in part && callFn) {
          const result = callFn(part, context);
          return result != null ? toStr(result) : '';
        }
        return toStr(part);
      })
      .join('');
  } catch (error) {
    if (strict) throw error;
    return template;
  }
}
