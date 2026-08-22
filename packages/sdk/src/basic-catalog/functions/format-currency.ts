import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { getLocaleRules, CURRENCY_SYMBOLS } from '../locale-config.js';

/** 将值转为浮点数，无法转换时抛出错误 */
function toFloat(val: unknown): number {
  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`无法转换为数字: ${String(val as string | number | bigint | symbol)}`);
  }
  return n;
}

/** 按语言环境格式化数字 */
function formatNumericLocale(
  value: number,
  decimals: number | undefined,
  grouping: boolean,
  locale?: string | null,
): string {
  const rules = getLocaleRules(locale);

  let rawStr: string;
  if (decimals !== undefined) {
    rawStr = value.toFixed(decimals);
    if (grouping) {
      const parts = rawStr.split('.');
      parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      rawStr = parts.join('.');
    }
  } else {
    if (grouping) {
      rawStr = value.toLocaleString('en-US');
    } else {
      rawStr = String(value);
    }
  }

  if (rules.decimalSeparator !== '.' || (grouping && rules.groupingSeparator !== ',')) {
    if (rules.decimalSeparator === ',') {
      return rawStr.replace(',', '~').replace('.', ',').replace('~', rules.groupingSeparator);
    } else if (rules.decimalSeparator !== '.') {
      return rawStr.replace(',', rules.groupingSeparator).replace('.', rules.decimalSeparator);
    }
  }
  return rawStr;
}

/** formatCurrency — 货币格式化 */
export const formatCurrencyFunction: FunctionApi = createFunctionApi(
  'formatCurrency',
  {
    type: 'object',
    properties: {
      value: { description: '金额数值' },
      currency: { type: 'string', description: 'ISO 4217 货币代码（如 USD, EUR）' },
      decimals: { type: 'number', description: '小数位数（默认 2）' },
      grouping: { type: 'boolean', description: '是否使用千分位分组（默认 true）' },
    },
    required: ['value', 'currency'],
  },
  {
    description: '将数值格式化为货币格式，包含货币符号和语言环境分隔符',
    returnType: 'string',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({
      value: z.number(),
      currency: z.string(),
      decimals: z.number().optional(),
      grouping: z.boolean().optional(),
    }),
    execute: (args) => {
      const val = toFloat(args.value);
      const currency = String((args.currency ?? 'USD') as string | number | bigint | symbol).toUpperCase();
      const decimals = args.decimals != null ? Number(args.decimals) : 2;
      const grouping = args.grouping === undefined ? true : Boolean(args.grouping);
      const rules = getLocaleRules();

      const numStr = formatNumericLocale(val, decimals, grouping);
      const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

      const space =
        rules.currencySpaceSeparated || (symbol.length > 1 && !['$', '£', '€', '¥'].includes(symbol)) ? ' ' : '';

      if (rules.currencySymbolAfter) {
        return `${numStr}${space}${symbol}`;
      }
      return `${symbol}${space}${numStr}`;
    },
  },
);
