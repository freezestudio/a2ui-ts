import type { ComponentApi } from '../../catalog/types.js';

export const ModalComponentSchema: ComponentApi = {
  name: 'Modal',
  description: '模态对话框组件，由触发组件打开并展示内容',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Modal' },
      trigger: {
        type: 'string',
        description: '触发弹窗的组件 ID，不可内联定义',
      },
      content: {
        type: 'string',
        description: '弹窗内容的组件 ID，不可内联定义',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'trigger', 'content'],
  },
};
