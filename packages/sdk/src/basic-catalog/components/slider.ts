import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf, dynamicNumberOneOf } from '../schema-helpers.js';

export const SliderComponentSchema: ComponentApi = {
  name: 'Slider',
  description: '滑块组件，用于在指定范围内选择数值',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Slider' },
      label: {
        description: '滑块标签文本',
        oneOf: dynamicStringOneOf(),
      },
      min: {
        type: 'number',
        description: '滑块最小值',
      },
      max: {
        type: 'number',
        description: '滑块最大值',
      },
      value: {
        description: '当前滑块值',
        oneOf: dynamicNumberOneOf(),
      },
      steps: {
        type: 'integer',
        minimum: 1,
        description: '滑块的离散步数',
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
    required: ['component', 'value', 'max'],
  },
};
