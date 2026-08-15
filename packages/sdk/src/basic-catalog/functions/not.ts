import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为布尔值 */
function toBool(val: unknown): boolean {
  return Boolean(val);
}

/** not — 逻辑非 */
export const notFunction: FunctionApi = createFunctionApi(
  'not',
  {
    type: 'object',
    properties: {
      value: { description: '要取反的布尔值' },
    },
    required: ['value'],
  },
  {
    description: '对布尔值执行逻辑非运算',
    returnType: 'boolean',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({ value: z.unknown() }),
    execute: (args) => {
      return !toBool(args.value);
    },
  },
);
