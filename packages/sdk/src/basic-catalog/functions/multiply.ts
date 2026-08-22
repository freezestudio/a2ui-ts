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

/** multiply — 乘法 */
export const multiplyFunction: FunctionApi = createFunctionApi(
  'multiply',
  {
    type: 'object',
    properties: {
      a: { description: '被乘数' },
      b: { description: '乘数' },
    },
    required: ['a', 'b'],
  },
  {
    description: '两个数值相乘',
    returnType: 'number',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ a: z.number(), b: z.number() }),
    execute: (args) => {
      const res = toFloat(args.a) * toFloat(args.b);
      return Number.isInteger(res) ? res : res;
    },
  },
);
