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

/** endsWith — 以...结束 */
export const endsWithFunction: FunctionApi = createFunctionApi(
  'endsWith',
  {
    type: 'object',
    properties: {
      string: { description: '被检查的字符串' },
      suffix: { description: '后缀字符串' },
    },
    required: ['string', 'suffix'],
  },
  {
    description: '检查字符串是否以指定的后缀结束',
    returnType: 'boolean',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      string: z.string(),
      suffix: z.string(),
    }),
    execute: (args) => {
      return toStr(args.string).endsWith(toStr(args.suffix));
    },
  },
);
