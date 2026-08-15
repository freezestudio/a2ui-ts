import type { ComponentApi } from '../../catalog/types.js';

export const ListComponentSchema: ComponentApi = {
  name: 'List',
  description: '可滚动列表容器组件',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'List' },
      children: {
        description: '子组件 ID 列表或动态模板',
        oneOf: [
          { type: 'array', items: { type: 'string' } },
          {
            type: 'object',
            properties: {
              componentId: { type: 'string' },
              path: { type: 'string' },
            },
            required: ['componentId', 'path'],
          },
        ],
      },
      direction: {
        type: 'string',
        enum: ['vertical', 'horizontal'],
        description: '列表排列方向',
      },
      align: {
        type: 'string',
        enum: ['start', 'center', 'end', 'stretch'],
        description: '交叉轴对齐方式',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'children'],
  },
};
