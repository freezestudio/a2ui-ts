/**
 * @a2ui-ts/shared — A2UI 协议共享工具
 *
 * 协议无关的共享能力：表达式解析/求值、JSON Pointer 路径、类型转换、
 * 国际化规则，以及下沉自 @geo/shared 的通用工具（深合并/JSON 修复/目录创建）。
 * @geo/shared 对这些工具做 re-export 以保持公共 API。
 */
export { ExpressionParser, parseTemplateExpression, parseResultSchema } from './expression-parser.js';
export type { ParseResult } from './expression-parser.js';
export { evaluateExpression } from './evaluate.js';
export type { EvaluateOptions } from './evaluate.js';
export {
  parsePointer,
  serializePointer,
  normalizePath,
  getParentPath,
  isAncestorPath,
  parseJsonPointer,
  resolvePath,
} from './path-utils.js';
export { toStr, toFloat } from './type-utils.js';
export { getLocaleRules, registerLocaleRules, CURRENCY_SYMBOLS } from './locale-config.js';
export type { LocaleFormattingRules } from './locale-config.js';
export { deepMerge, deepClone, FORBIDDEN_KEYS, isSafeKey } from './object-utils.js';
export { normalizeSmartQuotes, removeTrailingCommas, fixPartialJsonFragment, CUTTABLE_KEYS } from './json-healer.js';
