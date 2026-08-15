import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const TextComponentSchema: ComponentApi = {
  name: 'Text',
  description: '文本展示组件，支持标题、正文、字幕等变体',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Text' },
      text: {
        description: '文本内容，支持动态字符串绑定',
        oneOf: dynamicStringOneOf(),
      },
      variant: {
        type: 'string',
        enum: ['caption', 'body'],
        description: '文本变体（正文/字幕）',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'text'],
  },
};
