import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为字符串 */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

/** contains — 包含 */
export const containsFunction: FunctionApi = createFunctionApi(
  'contains',
  {
    type: 'object',
    properties: {
      string: { description: '被搜索的字符串' },
      substring: { description: '要搜索的子字符串' },
    },
    required: ['string', 'substring'],
  },
  {
    description: '检查字符串是否包含指定的子字符串',
    returnType: 'boolean',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      string: z.string(),
      substring: z.string(),
    }),
    execute: (args) => {
      return toStr(args.string).includes(toStr(args.substring));
    },
  },
);
