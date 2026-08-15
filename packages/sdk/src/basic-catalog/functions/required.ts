import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** required — 检查值非空 */
export const requiredFunction: FunctionApi = createFunctionApi(
  'required',
  {
    type: 'object',
    properties: {
      value: { description: '要检查的值' },
    },
    required: ['value'],
  },
  {
    description: '检查值是否非空（不为 null、undefined、空字符串或空数组），返回 ValidationResult',
    returnType: 'validationResult',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({ value: z.unknown() }),
    execute: (args) => {
      const v = args.value;
      if (v === null || v === undefined || v === '') return { valid: false, message: '该字段不能为空' };
      if (Array.isArray(v) && v.length === 0) return { valid: false, message: '该字段不能为空' };
      return { valid: true };
    },
  },
);
