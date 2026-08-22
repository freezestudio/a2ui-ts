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

/** divide — 除法（除零返回 Infinity） */
export const divideFunction: FunctionApi = createFunctionApi(
  'divide',
  {
    type: 'object',
    properties: {
      a: { description: '被除数' },
      b: { description: '除数' },
    },
    required: ['a', 'b'],
  },
  {
    description: '两个数值相除，除零时返回 Infinity 或 -Infinity',
    returnType: 'number',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ a: z.number(), b: z.number() }),
    execute: (args) => {
      const a = toFloat(args.a);
      const b = toFloat(args.b);
      if (b === 0) {
        if (a > 0) return Infinity;
        if (a < 0) return -Infinity;
        return NaN;
      }
      const res = a / b;
      return Number.isInteger(res) ? res : res;
    },
  },
);
