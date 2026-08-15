import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf, dynamicBooleanOneOf } from '../schema-helpers.js';

export const CheckBoxComponentSchema: ComponentApi = {
  name: 'CheckBox',
  description: '复选框组件，支持标签和客户端校验',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'CheckBox' },
      label: {
        description: '复选框旁边的标签文本',
        oneOf: dynamicStringOneOf(),
      },
      value: {
        description: '当前选中状态（true 为选中，false 为未选中）',
        oneOf: dynamicBooleanOneOf(),
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
      checks: {
        type: 'array',
        description: '校验规则列表',
        items: {
          type: 'object',
          properties: {
            condition: { description: 'DynamicBoolean 条件' },
            message: { type: 'string' },
          },
          required: ['condition', 'message'],
        },
      },
    },
    required: ['component', 'label', 'value'],
  },
};
