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

/** startsWith — 以...开始 */
export const startsWithFunction: FunctionApi = createFunctionApi(
  'startsWith',
  {
    type: 'object',
    properties: {
      string: { description: '被检查的字符串' },
      prefix: { description: '前缀字符串' },
    },
    required: ['string', 'prefix'],
  },
  {
    description: '检查字符串是否以指定的前缀开始',
    returnType: 'boolean',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({
      string: z.string(),
      prefix: z.string(),
    }),
    execute: (args) => {
      return toStr(args.string).startsWith(toStr(args.prefix));
    },
  },
);
