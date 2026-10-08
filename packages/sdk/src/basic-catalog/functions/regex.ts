import { z } from 'zod';
import { isSafeRegex, MAX_REGEX_INPUT_LENGTH } from '@freezestudio/a2ui-shared';
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
      // ReDoS 防护（CWE-1333）：拒绝灾难性回溯模式与超长输入
      if (!isSafeRegex(pattern)) {
        return { valid: false, message: '正则表达式不安全（潜在 ReDoS 风险）' };
      }
      if (value.length > MAX_REGEX_INPUT_LENGTH) {
        return { valid: false, message: `输入长度超过上限 (${MAX_REGEX_INPUT_LENGTH})` };
      }
      try {
        return new RegExp(pattern).test(value) ? { valid: true } : { valid: false, message: '格式不匹配' };
      } catch (err) {
        console.debug('[fnRegex] 正则表达式无效:', pattern, err);
        return { valid: false, message: '正则表达式无效' };
      }
    },
  },
);
