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

/** 将值转为字符串 */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

/** pluralize — 复数选择 */
export const pluralizeFunction: FunctionApi = createFunctionApi(
  'pluralize',
  {
    type: 'object',
    properties: {
      value: { description: '用于判断复数类别的数值' },
      zero: { description: '零类别的文本（可选）' },
      one: { description: '单数类别的文本（可选）' },
      two: { description: '双数类别的文本（可选）' },
      few: { description: '少数量类别的文本（可选）' },
      many: { description: '多数量类别的文本（可选）' },
      other: { description: '默认/其他类别的文本' },
    },
    required: ['value', 'other'],
  },
  {
    description: '根据数值选择正确的复数形式',
    returnType: 'string',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      value: z.number(),
      zero: z.string().optional(),
      one: z.string().optional(),
      two: z.string().optional(),
      few: z.string().optional(),
      many: z.string().optional(),
      other: z.string(),
    }),
    execute: (args) => {
      const val = toFloat(args.value);
      const rules = getLocaleRules();

      let category = 'other';
      if (val === 0 && args.zero != null) {
        category = 'zero';
      } else if (val === 1 && args.one != null) {
        category = 'one';
      } else if (val === 2 && args.two != null) {
        category = 'two';
      } else if (rules.pluralCategorySelector) {
        category = rules.pluralCategorySelector(val);
      }

      const result = (args as Record<string, unknown>)[category] ?? args.other ?? '';
      return toStr(result);
    },
  },
);
