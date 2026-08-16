import { z } from 'zod';
import { evaluateExpression } from '@freezestudio/a2ui-shared';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** 将值转为字符串 */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val as string | number | bigint | symbol);
}

/** formatString — 字符串模板插值 */
export const formatStringFunction: FunctionApi = createFunctionApi(
  'formatString',
  {
    type: 'object',
    properties: {
      value: { description: '模板字符串，使用 ${key} 作为占位符' },
    },
    required: ['value'],
  },
  {
    description: '对字符串模板进行插值替换，将 ${key} 替换为对应参数值',
    returnType: 'string',
    callableFrom: 'rendererOnly',
    argsSchema: z.object({
      value: z.string(),
    }),
    execute: (args, context) => {
      const template = toStr(args.value);
      if (!template) return '';
      const dataModel =
        context.dataModel && typeof context.dataModel === 'object' && !Array.isArray(context.dataModel)
          ? (context.dataModel as Record<string, unknown>)
          : args;
      return evaluateExpression(template, dataModel, { strict: false });
    },
  },
);
