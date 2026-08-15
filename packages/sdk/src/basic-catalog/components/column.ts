import type { ComponentApi } from '../../catalog/types.js';

export const ColumnComponentSchema: ComponentApi = {
  name: 'Column',
  description: '垂直布局容器，子组件从上到下排列',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Column' },
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
        enum: ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'],
        description: '主轴对齐方式',
      },
      align: {
        type: 'string',
        enum: ['center', 'end', 'start', 'stretch'],
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
