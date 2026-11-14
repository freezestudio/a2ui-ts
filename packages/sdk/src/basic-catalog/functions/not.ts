import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { coerceDynamicBoolean } from '@freezestudio/a2ui-shared';

/** 将值按 A2UI v1.0 DynamicBoolean 规则转为布尔值 */
function toBool(val: unknown): boolean {
  return coerceDynamicBoolean(val);
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
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ value: z.unknown() }),
    execute: (args) => {
      return !toBool(args.value);
    },
  },
);
