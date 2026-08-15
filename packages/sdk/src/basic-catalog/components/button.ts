import type { ComponentApi } from '../../catalog/types.js';

export const ButtonComponentSchema: ComponentApi = {
  name: 'Button',
  description: '按钮组件，点击触发服务端事件或客户端函数',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Button' },
      child: {
        type: 'string',
        description: '按钮内嵌的子组件 ID（通常是 Text 组件）',
      },
      variant: {
        type: 'string',
        enum: ['default', 'primary', 'borderless'],
        description: '按钮变体',
      },
      action: {
        description: '按钮动作定义',
        oneOf: [
          {
            type: 'object',
            properties: {
              event: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '事件名称' },
                  context: { type: 'object', additionalProperties: true },
                  wantResponse: { type: 'boolean' },
                  responsePath: { type: 'string' },
                },
                required: ['name'],
              },
            },
            required: ['event'],
          },
          {
            type: 'object',
            properties: {
              functionCall: {
                type: 'object',
                properties: {
                  call: { type: 'string' },
                  args: { type: 'object' },
                },
                required: ['call'],
              },
            },
            required: ['functionCall'],
          },
        ],
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
    required: ['component', 'child', 'action'],
  },
};
