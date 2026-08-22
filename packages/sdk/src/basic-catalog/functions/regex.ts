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

/** regex — 正则匹配 */
export const regexFunction: FunctionApi = createFunctionApi(
  'regex',
  {
    type: 'object',
    properties: {
      value: { description: '要匹配的字符串' },
      pattern: { type: 'string', description: '正则表达式模式' },
    },
    required: ['value', 'pattern'],
  },
  {
    description: '检查字符串是否匹配指定的正则表达式，返回 ValidationResult',
    returnType: 'validationResult',
    allowedCallers: 'rendererOnly',
    argsSchema: z.object({
      value: z.string(),
      pattern: z.string(),
    }),
    execute: (args) => {
      const value = toStr(args.value);
      const pattern = toStr(args.pattern);
      try {
        return new RegExp(pattern).test(value) ? { valid: true } : { valid: false, message: '格式不匹配' };
      } catch (err) {
        console.debug('[fnRegex] 正则表达式无效:', pattern, err);
        return { valid: false, message: '正则表达式无效' };
      }
    },
  },
);
