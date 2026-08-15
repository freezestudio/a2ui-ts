import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { getLocaleRules } from '../locale-config.js';

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

/** formatNumber — 数字格式化 */
export const formatNumberFunction: FunctionApi = createFunctionApi(
  'formatNumber',
  {
    type: 'object',
    properties: {
      value: { description: '要格式化的数字' },
      decimals: { type: 'number', description: '小数位数（可选）' },
      grouping: { type: 'boolean', description: '是否使用千分位分组（默认 true）' },
    },
    required: ['value'],
  },
  {
    description: '格式化数字，支持小数位数和千分位分组',
    returnType: 'string',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      value: z.number(),
      decimals: z.number().optional(),
      grouping: z.boolean().optional(),
    }),
    execute: (args) => {
      const val = toFloat(args.value);
      const decimals = args.decimals != null ? Number(args.decimals) : undefined;
      const grouping = args.grouping === undefined ? true : Boolean(args.grouping);
      return formatNumericLocale(val, decimals, grouping);
    },
  },
);
