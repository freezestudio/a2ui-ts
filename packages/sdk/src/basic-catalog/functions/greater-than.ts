import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为浮点数，无法转换时抛出错误 */
function toFloat(val: unknown): number {
  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`无法转换为数字: ${String(val as string | number | bigint | symbol)}`);
  }
  return n;
}

/** greaterThan — 大于 */
export const greaterThanFunction: FunctionApi = createFunctionApi(
  'greaterThan',
  {
    type: 'object',
    properties: {
      a: { description: '第一个数值' },
      b: { description: '第二个数值' },
    },
    required: ['a', 'b'],
  },
  {
    description: '检查 a 是否大于 b',
    returnType: 'boolean',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({ a: z.number(), b: z.number() }),
    execute: (args) => {
      return toFloat(args.a) > toFloat(args.b);
    },
  },
);
