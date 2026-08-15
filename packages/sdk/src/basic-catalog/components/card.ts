import type { ComponentApi } from '../../catalog/types.js';

export const CardComponentSchema: ComponentApi = {
  name: 'Card',
  description: '卡片容器组件，包裹单个子组件',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Card' },
      child: {
        type: 'string',
        description: '卡片内单个子组件的 ID，不可内联定义',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'child'],
  },
};
