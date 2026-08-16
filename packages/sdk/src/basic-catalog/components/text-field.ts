import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const TextFieldComponentSchema: ComponentApi = {
  name: 'TextField',
  description: '文本输入组件，支持多种变体和客户端校验',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'TextField' },
      label: {
        description: '标签文本',
        oneOf: dynamicStringOneOf(),
      },
      value: {
        description: '当前输入值',
        oneOf: dynamicStringOneOf(),
      },
      variant: {
        type: 'string',
        enum: ['longText', 'number', 'shortText', 'obscured'],
        description: '输入变体',
      },
      placeholder: {
        description: '输入框占位符文本',
        oneOf: dynamicStringOneOf(),
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
          required: ['condition'],
        },
      },
    },
    required: ['component', 'label'],
  },
};
