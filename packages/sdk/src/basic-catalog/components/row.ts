import type { ComponentApi } from '../../catalog/types.js';

export const RowComponentSchema: ComponentApi = {
  name: 'Row',
  description: '水平布局容器，子组件从左到右排列',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Row' },
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
      justify: {
        type: 'string',
        enum: ['center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'start', 'stretch'],
        description: '主轴对齐方式',
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
