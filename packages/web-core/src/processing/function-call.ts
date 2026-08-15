import type { DataBinding, FunctionCall } from './data-binding.js';
import { isDataBinding, isFunctionCall, resolvePath } from './data-binding.js';
import { evaluateExpression } from '@freezestudio/a2ui-shared';
import { A2uiSecurityError } from '../common/errors.js';
import { createRendererLogger } from '../common/logger.js';
const logger = createRendererLogger('function-call');

const KNOWN_FUNCTIONS = new Set([
  'capitalize',
  'required',
  'regex',
  'length',
  'numeric',
  'email',
  'formatString',
  'formatNumber',
  'formatCurrency',
  'formatDate',
  'pluralize',
  'openUrl',
  'and',
  'or',
  'not',
  'add',
  'subtract',
  'multiply',
  'divide',
  'equals',
  'notEquals',
  'greaterThan',
  'lessThan',
  'contains',
  'startsWith',
  'endsWith',
  '@index',
]);

const FUNCTION_CALLABLE_FROM: Record<string, 'rendererOnly' | 'agentOnly' | 'rendererOrAgent'> = {
  openUrl: 'rendererOnly',
  '@index': 'rendererOnly',
};

/** 需要用户激活上下文（requiresUserActivation）才能执行的函数 */
const FUNCTION_REQUIRES_ACTIVATION = new Set<string>(['openUrl']);

/**
 * Action 意图分类（对齐上游 user_initiated_functions 提案）：
 * - activation：可信物理用户交互（click/touchend/submit/Enter/Space），允许 requiresUserActivation 函数
 * - passive：被动事件（blur/focus/input/change），阻止 requiresUserActivation 函数
 */
export type ActionIntent = 'activation' | 'passive';

/** 函数执行上下文中的激活状态字段名 */
export const ACTION_CONTEXT_KEYS = {
  isExecutingAction: 'isExecutingAction',
  actionIntent: 'actionIntent',
} as const;

/** 函数是否声明 requiresUserActivation */
export function getFunctionRequiresActivation(name: string): boolean {
  return FUNCTION_REQUIRES_ACTIVATION.has(name);
}

/**
 * 断言函数在用户激活上下文中执行（requiresUserActivation 门禁）
 *
 * 非交互触发（布局渲染、字符串插值、被动事件、agent 远程调用）一律拒绝。
 */
function assertUserActivation(name: string, context?: Record<string, unknown>): void {
  if (!FUNCTION_REQUIRES_ACTIVATION.has(name)) return;
  const isActivated = context?.[ACTION_CONTEXT_KEYS.isExecutingAction] === true;
  const intent = context?.[ACTION_CONTEXT_KEYS.actionIntent];
  if (!isActivated || intent !== 'activation') {
    throw new A2uiSecurityError(
      `Execution blocked: Function '${name}' requires a user activation Action context (e.g. click, tap, submit). ` +
        `It cannot be executed during layout rendering, interpolation, passive events (blur/change), or agent invocation.`,
    );
  }
}

export function getFunctionCallableFrom(name: string): 'rendererOnly' | 'agentOnly' | 'rendererOrAgent' | undefined {
  if (FUNCTION_CALLABLE_FROM[name]) return FUNCTION_CALLABLE_FROM[name];
  return KNOWN_FUNCTIONS.has(name) ? 'rendererOnly' : undefined;
}

export function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name);
}

function toFloat(val: unknown): number {
  const n = Number(val);
  if (Number.isNaN(n))
    throw new Error(
      `无法转换为数字: ${typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | bigint | symbol)}`,
    );
  return n;
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

const localeConfigs: Record<string, { decimal: string; group: string; months: string[]; days: string[] }> = {
  en: {
    decimal: '.',
    group: ',',
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  zh: {
    decimal: '.',
    group: ',',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    days: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
  },
};

function getLocale(locale?: string): (typeof localeConfigs)['en'] {
  const lang = locale?.slice(0, 2) || 'en';
  return localeConfigs[lang] || localeConfigs['en'];
}

export function resolveDynamicValue(
  value: unknown,
  dataModel: Record<string, unknown>,
  context?: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 20) {
    logger.debug('动态值递归过深', { depth });
    return value;
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => resolveDynamicValue(item, dataModel, context, depth + 1));
  }
  if (isDataBinding(value)) {
    const binding = value as DataBinding;
    return resolvePath(binding, dataModel, context);
  }
  if (isFunctionCall(value)) {
    return callFunction(value as FunctionCall, dataModel, depth + 1, context);
  }
  return value;
}

export function resolveDynamicString(
  value: unknown,
  dataModel: Record<string, unknown>,
  context?: Record<string, unknown>,
): string {
  const resolved = resolveDynamicValue(value, dataModel, context);
  if (resolved == null) return '';
  if (typeof resolved === 'object') return JSON.stringify(resolved);
  return String(resolved as string | number | bigint | symbol);
}

export function callFunction(
  fn: FunctionCall,
  dataModel: Record<string, unknown>,
  depth = 0,
  context?: Record<string, unknown>,
): unknown {
  assertUserActivation(fn.call, context);
  const args = fn.args || {};
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args)) {
    resolvedArgs[key] = resolveDynamicValue(val, dataModel, context, depth + 1);
  }

  let result: unknown;
  switch (fn.call) {
    case 'capitalize':
      result = fnCapitalize(resolvedArgs);
      break;
    case 'required':
      result = fnRequired(resolvedArgs);
      break;
    case 'regex':
      result = fnRegex(resolvedArgs);
      break;
    case 'length':
      result = fnLength(resolvedArgs);
      break;
    case 'numeric':
      result = fnNumeric(resolvedArgs);
      break;
    case 'email':
      result = fnEmail(resolvedArgs);
      break;
    case 'formatString':
      result = fnFormatString(resolvedArgs, dataModel, depth);
      break;
    case 'formatNumber':
      result = fnFormatNumber(resolvedArgs);
      break;
    case 'formatCurrency':
      result = fnFormatCurrency(resolvedArgs);
      break;
    case 'formatDate':
      result = fnFormatDate(resolvedArgs);
      break;
    case 'pluralize':
      result = fnPluralize(resolvedArgs);
      break;
    case 'openUrl':
      result = fnOpenUrl(resolvedArgs);
      break;
    case 'and':
      result = fnAnd(resolvedArgs);
      break;
    case 'or':
      result = fnOr(resolvedArgs);
      break;
    case 'not':
      result = fnNot(resolvedArgs);
      break;
    case 'add':
      result = fnAdd(resolvedArgs);
      break;
    case 'subtract':
      result = fnSubtract(resolvedArgs);
      break;
    case 'multiply':
      result = fnMultiply(resolvedArgs);
      break;
    case 'divide':
      result = fnDivide(resolvedArgs);
      break;
    case 'equals':
      result = fnEquals(resolvedArgs);
      break;
    case 'notEquals':
      result = fnNotEquals(resolvedArgs);
      break;
    case 'greaterThan':
      result = fnGreaterThan(resolvedArgs);
      break;
    case 'lessThan':
      result = fnLessThan(resolvedArgs);
      break;
    case 'contains':
      result = fnContains(resolvedArgs);
      break;
    case 'startsWith':
      result = fnStartsWith(resolvedArgs);
      break;
    case 'endsWith':
      result = fnEndsWith(resolvedArgs);
      break;
    case '@index': {
      if (context?.['caller'] === 'agent') {
        throw new Error('系统函数 @index 不允许 agent 调用');
      }
      const index = context?.['@index'];
      if (index === undefined) {
        throw new Error('@index 只能在列表模板渲染中使用');
      }
      const indexArgs = fn.args ?? {};
      const offset = typeof indexArgs['offset'] === 'number' ? indexArgs['offset'] : 0;
      result = (index as number) + offset;
      break;
    }
    default:
      result = `[未知函数: ${fn.call}]`;
  }

  return result;
}

function fnCapitalize(args: Record<string, unknown>): string {
  const value = toStr(args['value']);
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** 校验函数返回结构（v1.0 #2220 ValidationResult） */
interface ValidationResult {
  valid: boolean;
  message?: string;
  code?: string;
}

function fnRequired(args: Record<string, unknown>): ValidationResult {
  const v = args['value'];
  if (v === null || v === undefined) return { valid: false, message: '该字段不能为空' };
  if (typeof v === 'string' && v === '') return { valid: false, message: '该字段不能为空' };
  if (Array.isArray(v) && v.length === 0) return { valid: false, message: '该字段不能为空' };
  return { valid: true };
}

function fnRegex(args: Record<string, unknown>): ValidationResult {
  const value = toStr(args['value']);
  const pattern = toStr(args['pattern']);
  if (!pattern) return { valid: false, message: '缺少正则表达式模式' };
  try {
    return new RegExp(pattern).test(value) ? { valid: true } : { valid: false, message: '格式不匹配' };
  } catch {
    return { valid: false, message: '正则表达式无效' };
  }
}

function fnLength(args: Record<string, unknown>): ValidationResult {
  const value = toStr(args['value']);
  const min = args['min'] != null ? Number(args['min']) : null;
  const max = args['max'] != null ? Number(args['max']) : null;
  if (min !== null && value.length < min) return { valid: false, message: `长度不能小于 ${min}` };
  if (max !== null && value.length > max) return { valid: false, message: `长度不能大于 ${max}` };
  return { valid: true };
}

function fnNumeric(args: Record<string, unknown>): ValidationResult {
  try {
    const value = toFloat(args['value']);
    const min = args['min'] != null ? toFloat(args['min']) : null;
    const max = args['max'] != null ? toFloat(args['max']) : null;
    if (min !== null && value < min) return { valid: false, message: `数值不能小于 ${min}` };
    if (max !== null && value > max) return { valid: false, message: `数值不能大于 ${max}` };
    return { valid: true };
  } catch {
    return { valid: false, message: '必须为数字' };
  }
}

function fnEmail(args: Record<string, unknown>): ValidationResult {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(toStr(args['value']))
    ? { valid: true }
    : { valid: false, message: '邮箱格式不正确' };
}

function fnFormatString(args: Record<string, unknown>, dataModel: Record<string, unknown>, depth = 0): string {
  const template = toStr(args['value']);
  return evaluateExpression(template, dataModel, {
    strict: true,
    callFunction: (fn, ctx) => callFunction(fn as FunctionCall, ctx, depth + 1),
  });
}

function fnFormatNumber(args: Record<string, unknown>): string {
  try {
    const value = toFloat(args['value']);
    const decimals = args['decimals'] != null ? Number(args['decimals']) : undefined;
    const grouping = args['grouping'] !== false;
    const locale = args['locale'] as string | undefined;
    const lc = getLocale(locale);
    const str = decimals != null ? value.toFixed(decimals) : String(value);
    if (!grouping) return str;
    const parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, lc.group);
    return parts.join(lc.decimal);
  } catch {
    return '';
  }
}

function fnFormatCurrency(args: Record<string, unknown>): string {
  try {
    const value = toFloat(args['value']);
    const currency = toStr(args['currency']);
    const locale = args['locale'] as string | undefined;
    try {
      return new Intl.NumberFormat(locale || 'en-US', { style: 'currency', currency }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  } catch {
    return '';
  }
}

function fnFormatDate(args: Record<string, unknown>): string {
  const val = args['value'];
  const fmt = toStr(args['format'] || 'yyyy-MM-dd');
  if (!val) return '';
  try {
    const dateInput =
      typeof val === 'string' ? val.replace('Z', '+00:00') : String(val as string | number | bigint | symbol);
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return '';
    const tokens = /yyyy|yy|MMMM|MMM|MM|M|EEEE|E|dd|d|HH|H|hh|h|mm|ss|a/g;
    return fmt.replace(tokens, (tok) => {
      switch (tok) {
        case 'yyyy':
          return String(dt.getFullYear());
        case 'yy':
          return String(dt.getFullYear()).slice(-2);
        case 'MMMM':
          return getLocale().months[dt.getMonth()];
        case 'MMM':
          return getLocale().months[dt.getMonth()].slice(0, 3);
        case 'MM':
          return String(dt.getMonth() + 1).padStart(2, '0');
        case 'M':
          return String(dt.getMonth() + 1);
        case 'EEEE':
          return getLocale().days[(dt.getDay() + 6) % 7];
        case 'E':
          return getLocale().days[(dt.getDay() + 6) % 7].slice(0, 3);
        case 'dd':
          return String(dt.getDate()).padStart(2, '0');
        case 'd':
          return String(dt.getDate());
        case 'HH':
          return String(dt.getHours()).padStart(2, '0');
        case 'H':
          return String(dt.getHours());
        case 'hh':
          return String(dt.getHours() % 12 || 12).padStart(2, '0');
        case 'h':
          return String(dt.getHours() % 12 || 12);
        case 'mm':
          return String(dt.getMinutes()).padStart(2, '0');
        case 'ss':
          return String(dt.getSeconds()).padStart(2, '0');
        case 'a':
          return dt.getHours() < 12 ? 'AM' : 'PM';
        default:
          return tok;
      }
    });
  } catch {
    return '';
  }
}

function fnPluralize(args: Record<string, unknown>): string {
  try {
    const value = toFloat(args['value']);
    // 与 SDK 对齐：使用 CLDR 复数类别（zero/one/two/few/many/other），
    // 而非仅 zero/one/other，保证跨端复数选择行为一致
    const category = new Intl.PluralRules().select(value);
    return toStr(args[category] || args['other'] || '');
  } catch {
    return '';
  }
}

function fnOpenUrl(args: Record<string, unknown>): string {
  const url = toStr(args['url']);
  if (!url) return '';
  const absoluteUrl = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost').href;
  const parsedUrl = new URL(absoluteUrl);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error(`Invalid URL scheme: ${parsedUrl.protocol}`);
  }
  if (typeof window !== 'undefined') {
    window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
  }
  return '';
}

function fnAnd(args: Record<string, unknown>): boolean {
  const values = args['values'];
  if (!Array.isArray(values)) return false;
  return values.every(Boolean);
}

function fnOr(args: Record<string, unknown>): boolean {
  const values = args['values'];
  if (!Array.isArray(values)) return false;
  return values.some(Boolean);
}

function fnNot(args: Record<string, unknown>): boolean {
  return !args['value'];
}
function fnAdd(args: Record<string, unknown>): number {
  return toFloat(args['a'] ?? args['value']) + toFloat(args['b'] ?? 0);
}
function fnSubtract(args: Record<string, unknown>): number {
  return toFloat(args['a'] ?? args['value']) - toFloat(args['b'] ?? 0);
}
function fnMultiply(args: Record<string, unknown>): number {
  return toFloat(args['a'] ?? args['value']) * toFloat(args['b'] ?? 1);
}
function fnDivide(args: Record<string, unknown>): number {
  return toFloat(args['a'] ?? args['value']) / toFloat(args['b'] ?? 1);
}
function fnEquals(args: Record<string, unknown>): boolean {
  return args['a'] === args['b'];
}
function fnNotEquals(args: Record<string, unknown>): boolean {
  return args['a'] !== args['b'];
}
function fnGreaterThan(args: Record<string, unknown>): boolean {
  return toFloat(args['a']) > toFloat(args['b']);
}
function fnLessThan(args: Record<string, unknown>): boolean {
  return toFloat(args['a']) < toFloat(args['b']);
}
function fnContains(args: Record<string, unknown>): boolean {
  return toStr(args['string']).includes(toStr(args['substring']));
}
function fnStartsWith(args: Record<string, unknown>): boolean {
  return toStr(args['string']).startsWith(toStr(args['prefix']));
}
function fnEndsWith(args: Record<string, unknown>): boolean {
  return toStr(args['string']).endsWith(toStr(args['suffix']));
}
