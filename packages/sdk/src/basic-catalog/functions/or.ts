import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { DynamicBooleanSchema } from '../../schema/common-types.js';
import { coerceDynamicBoolean } from '@freezestudio/a2ui-shared';

/** 将值按 A2UI v1.0 DynamicBoolean 规则转为布尔值 */
function toBool(val: unknown): boolean {
  return coerceDynamicBoolean(val);
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
        items: { $ref: 'common_types.json#/$defs/DynamicBoolean' },
        minItems: 2,
      },
    },
    required: ['values'],
  },
  {
    description: '对所有布尔值执行逻辑或运算',
    returnType: 'boolean',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ values: z.array(DynamicBooleanSchema).min(2) }),
    execute: (args) => {
      const values = args.values as unknown[];
      return values.some((v) => toBool(v));
    },
  },
);
