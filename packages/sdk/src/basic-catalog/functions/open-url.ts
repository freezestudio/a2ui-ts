import { z } from 'zod';
import { createFunctionApi } from '../../catalog/types.js';
import type { FunctionApi } from '../../catalog/types.js';

/** openUrl — 打开 URL（需用户激活上下文，仅用户交互触发的 Action 中可执行） */
export const openUrlFunction: FunctionApi = createFunctionApi(
  'openUrl',
  {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要打开的 URL' },
    },
    required: ['url'],
  },
  {
    description: '打开指定的 URL（需要用户激活上下文：仅可在用户交互如点击/提交触发的 Action 中执行）',
    returnType: 'void',
    allowedCallers: 'rendererOnly',
    requiresUserActivation: true,
    argsSchema: z.object({ url: z.string() }),
    execute: () => {
      return undefined;
    },
  },
);
