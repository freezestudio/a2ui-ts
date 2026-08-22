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

/** length — 字符串长度检查 */
export const lengthFunction: FunctionApi = createFunctionApi(
  'length',
  {
    type: 'object',
    properties: {
      value: { description: '要检查的字符串' },
      min: { type: 'integer', minimum: 0, description: '最小长度（可选）' },
      max: { type: 'integer', minimum: 0, description: '最大长度（可选）' },
    },
    required: ['value'],
    anyOf: [{ required: ['min'] }, { required: ['max'] }],
  },
  {
    description: '检查字符串长度是否在指定范围内，返回 ValidationResult',
    returnType: 'validationResult',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({
      value: z.string(),
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
    execute: (args) => {
      const str = toStr(args.value);
      const len = str.length;
      const min = args.min != null ? Number(args.min) : undefined;
      const max = args.max != null ? Number(args.max) : undefined;
      if (min !== undefined && len < min) return { valid: false, message: `长度不能小于 ${min}` };
      if (max !== undefined && len > max) return { valid: false, message: `长度不能大于 ${max}` };
      return { valid: true };
    },
  },
);
