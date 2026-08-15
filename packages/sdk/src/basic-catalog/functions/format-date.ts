import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';
import { getLocaleRules } from '../locale-config.js';

/** 日期格式化 token 正则 */
const DATE_TOKENS = /yyyy|yy|MMMM|MMM|MM|M|EEEE|E|dd|d|HH|H|hh|h|mm|ss|a/g;

/** formatDate — 日期格式化 */
export const formatDateFunction: FunctionApi = createFunctionApi(
  'formatDate',
  {
    type: 'object',
    properties: {
      value: { description: '要格式化的日期（ISO 字符串或 Date 对象）' },
      format: { type: 'string', description: '日期格式模式（如 yyyy-MM-dd, HH:mm）' },
    },
    required: ['value', 'format'],
  },
  {
    description: '按照指定的格式模式格式化日期，支持 TR35 token',
    returnType: 'string',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      value: z.union([z.string(), z.date(), z.number()]),
      format: z.string(),
    }),
    execute: (args) => {
      const val = args.value;
      const fmt = String((args.format ?? 'yyyy-MM-dd') as string | number | bigint | symbol);
      if (!val) return '';
      try {
        const dateInput =
          typeof val === 'string' ? val.replace('Z', '+00:00') : String(val as string | number | bigint | symbol);
        const dt = new Date(dateInput);
        if (isNaN(dt.getTime())) return '';

        const rules = getLocaleRules();

        return fmt.replace(DATE_TOKENS, (tok) => {
          switch (tok) {
            case 'yyyy':
              return String(dt.getFullYear());
            case 'yy':
              return String(dt.getFullYear()).slice(-2);
            case 'MMMM':
              return rules.monthsLong[dt.getMonth() + 1] ?? '';
            case 'MMM':
              return rules.monthsShort[dt.getMonth() + 1] ?? '';
            case 'MM':
              return String(dt.getMonth() + 1).padStart(2, '0');
            case 'M':
              return String(dt.getMonth() + 1);
            case 'EEEE':
              return rules.weekdaysLong[(dt.getDay() + 6) % 7] ?? '';
            case 'E':
              return rules.weekdaysShort[(dt.getDay() + 6) % 7] ?? '';
            case 'dd':
              return String(dt.getDate()).padStart(2, '0');
            case 'd':
              return String(dt.getDate());
            case 'HH':
              return String(dt.getHours()).padStart(2, '0');
            case 'H':
              return String(dt.getHours());
            case 'hh': {
              const hr = dt.getHours() % 12;
              return String(hr || 12).padStart(2, '0');
            }
            case 'h': {
              const hr = dt.getHours() % 12;
              return String(hr || 12);
            }
            case 'mm':
              return String(dt.getMinutes()).padStart(2, '0');
            case 'ss':
              return String(dt.getSeconds()).padStart(2, '0');
            case 'a':
              return dt.getHours() < 12 ? 'AM' : 'PM';
            default:
              return tok;
          }
        });
      } catch (err) {
        console.debug('[fnFormatDate] 日期格式化失败:', err);
        return '';
      }
    },
  },
);
