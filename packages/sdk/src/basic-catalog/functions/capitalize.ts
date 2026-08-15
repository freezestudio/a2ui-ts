import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

const CapitalizeArgsSchema = z.object({
  value: z.union([z.string(), z.object({ path: z.string() })]),
});

/** 将字符串首字母大写 */
export const capitalizeFunction: FunctionApi = createFunctionApi(
  'capitalize',
  {
    type: 'object',
    properties: {
      value: {
        description: '要转换的字符串',
        oneOf: [{ type: 'string' }, { type: 'object', properties: { path: { type: 'string' } } }],
      },
    },
    required: ['value'],
  },
  {
    description: '将输入字符串转换为大写格式（首字母大写）',
    returnType: 'string',
    callableFrom: 'rendererOnly',
    argsSchema: CapitalizeArgsSchema,
    execute: (args) => {
      const value = args.value;
      if (typeof value !== 'string') return value;
      if (value.length === 0) return value;
      return value.charAt(0).toUpperCase() + value.slice(1);
    },
  },
);
