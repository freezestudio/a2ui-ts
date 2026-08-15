import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const DateTimeInputComponentSchema: ComponentApi = {
  name: 'DateTimeInput',
  description: '日期/时间输入组件，支持日期和时间的选择',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'DateTimeInput' },
      value: {
        description: '当前选中的日期/时间值（ISO 8601 格式）',
        oneOf: dynamicStringOneOf(),
      },
      enableDate: {
        type: 'boolean',
        description: '是否启用日期选择',
      },
      enableTime: {
        type: 'boolean',
        description: '是否启用时间选择',
      },
      min: {
        description: '最小允许日期/时间（ISO 8601 格式）',
        oneOf: dynamicStringOneOf(),
      },
      max: {
        description: '最大允许日期/时间（ISO 8601 格式）',
        oneOf: dynamicStringOneOf(),
      },
      label: {
        description: '输入框标签文本',
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
          required: ['condition', 'message'],
        },
      },
    },
    required: ['component', 'value'],
  },
};
