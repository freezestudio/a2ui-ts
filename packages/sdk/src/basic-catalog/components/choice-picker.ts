import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const ChoicePickerComponentSchema: ComponentApi = {
  name: 'ChoicePicker',
  description: '选项选择器组件，支持多种展示样式',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'ChoicePicker' },
      label: {
        description: '选项组标签文本',
        oneOf: dynamicStringOneOf(),
      },
      options: {
        type: 'array',
        description: '可选项列表',
        items: {
          type: 'object',
          properties: {
            value: { type: 'string', description: '选项值' },
            label: {
              description: '选项显示文本',
              oneOf: dynamicStringOneOf(),
            },
          },
          required: ['value', 'label'],
        },
      },
      value: {
        description: '当前选中的值列表',
        oneOf: [
          { type: 'array', items: { type: 'string' } },
          { type: 'object', properties: { path: { type: 'string' } } },
          {
            type: 'object',
            properties: { call: { type: 'string' }, args: { type: 'object', additionalProperties: true } },
            required: ['call'],
          },
        ],
      },
      displayStyle: {
        type: 'string',
        enum: ['checkbox', 'chips'],
        description: '展示样式',
      },
      filterable: {
        type: 'boolean',
        description: '是否显示搜索输入框以过滤选项',
      },
      variant: {
        type: 'string',
        enum: ['multipleSelection', 'mutuallyExclusive'],
        description: '选择模式：多选或单选',
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
    required: ['component', 'options', 'value'],
  },
};
