import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { DynamicBooleanSchema } from '../../schema/common-types.js';

/** 将值转为布尔值 */
function toBool(val: unknown): boolean {
  return Boolean(val);
}

/** and — 逻辑与 */
export const andFunction: FunctionApi = createFunctionApi(
  'and',
  {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        description: '要进行逻辑与运算的布尔值列表',
        items: { $ref: '#/$defs/DynamicBoolean' },
        minItems: 2,
      },
    },
    required: ['values'],
  },
  {
    description: '对所有布尔值执行逻辑与运算',
    returnType: 'boolean',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ values: z.array(DynamicBooleanSchema).min(2) }),
    execute: (args) => {
      const values = args.values as unknown[];
      return values.every((v) => toBool(v));
    },
  },
);
