import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { DynamicBooleanSchema } from '../../schema/common-types.js';

/** 将值转为布尔值 */
function toBool(val: unknown): boolean {
  return Boolean(val);
}

/** or — 逻辑或 */
export const orFunction: FunctionApi = createFunctionApi(
  'or',
  {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        description: '要进行逻辑或运算的布尔值列表',
        items: { $ref: '#/$defs/DynamicBoolean' },
        minItems: 2,
      },
    },
    required: ['values'],
  },
  {
    description: '对所有布尔值执行逻辑或运算',
    returnType: 'boolean',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({ values: z.array(DynamicBooleanSchema).min(2) }),
    execute: (args) => {
      const values = args.values as unknown[];
      return values.some((v) => toBool(v));
    },
  },
);
