import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为字符串 */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

/** email — 邮箱格式验证 */
export const emailFunction: FunctionApi = createFunctionApi(
  'email',
  {
    type: 'object',
    properties: {
      value: { description: '要验证的邮箱地址' },
    },
    required: ['value'],
  },
  {
    description: '检查字符串是否符合邮箱格式，返回 ValidationResult',
    returnType: 'validationResult',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({ value: z.string() }),
    execute: (args) => {
      const value = toStr(args.value);
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
        ? { valid: true }
        : { valid: false, message: '邮箱格式不正确' };
    },
  },
);
