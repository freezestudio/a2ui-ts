import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为浮点数，无法转换时抛出错误 */
function toFloat(val: unknown): number {
  const n = Number(val);
  if (Number.isNaN(n)) {
    throw new Error(`无法转换为数字: ${String(val as string | number | bigint | symbol)}`);
  }
  return n;
}

/** numeric — 数字范围检查 */
export const numericFunction: FunctionApi = createFunctionApi(
  'numeric',
  {
    type: 'object',
    properties: {
      value: { description: '要检查的数值' },
      min: { type: 'number', description: '最小值（可选）' },
      max: { type: 'number', description: '最大值（可选）' },
    },
    required: ['value'],
    anyOf: [{ required: ['min'] }, { required: ['max'] }],
  },
  {
    description: '检查数值是否在指定范围内，返回 ValidationResult',
    returnType: 'validationResult',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({
      value: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    execute: (args) => {
      const val = toFloat(args.value);
      const min = args.min != null ? toFloat(args.min) : undefined;
      const max = args.max != null ? toFloat(args.max) : undefined;
      if (min !== undefined && val < min) return { valid: false, message: `数值不能小于 ${min}` };
      if (max !== undefined && val > max) return { valid: false, message: `数值不能大于 ${max}` };
      return { valid: true };
    },
  },
);
