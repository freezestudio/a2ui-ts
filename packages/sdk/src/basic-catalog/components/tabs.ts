import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const TabsComponentSchema: ComponentApi = {
  name: 'Tabs',
  description: '标签页组件，每个标签页关联一个子组件',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Tabs' },
      tabs: {
        type: 'array',
        minItems: 1,
        description: '标签页列表，每项包含标题和子组件 ID',
        items: {
          type: 'object',
          properties: {
            title: {
              description: '标签页标题',
              oneOf: dynamicStringOneOf(),
            },
            child: {
              type: 'string',
              description: '标签页内子组件的 ID，不可内联定义',
            },
          },
          required: ['title', 'child'],
        },
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'tabs'],
  },
};
