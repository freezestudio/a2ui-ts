import type { ComponentApi } from '../../catalog/types.js';

export const DividerComponentSchema: ComponentApi = {
  name: 'Divider',
  description: '分割线组件，用于视觉分隔',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Divider' },
      axis: {
        type: 'string',
        enum: ['horizontal', 'vertical'],
        description: '分割线方向',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component'],
  },
};
