import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** notEquals — 不等于 */
export const notEqualsFunction: FunctionApi = createFunctionApi(
  'notEquals',
  {
    type: 'object',
    properties: {
      a: { description: '第一个值' },
      b: { description: '第二个值' },
    },
    required: ['a', 'b'],
  },
  {
    description: '检查两个值是否不相等',
    returnType: 'boolean',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ a: z.unknown(), b: z.unknown() }),
    execute: (args) => {
      return args.a !== args.b;
    },
  },
);
