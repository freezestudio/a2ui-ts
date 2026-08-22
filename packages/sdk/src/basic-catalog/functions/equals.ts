import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** equals — 等于 */
export const equalsFunction: FunctionApi = createFunctionApi(
  'equals',
  {
    type: 'object',
    properties: {
      a: { description: '第一个值' },
      b: { description: '第二个值' },
    },
    required: ['a', 'b'],
  },
  {
    description: '检查两个值是否相等',
    returnType: 'boolean',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({ a: z.unknown(), b: z.unknown() }),
    execute: (args) => {
      return args.a === args.b;
    },
  },
);
