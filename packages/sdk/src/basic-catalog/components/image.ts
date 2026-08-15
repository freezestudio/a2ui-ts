import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const ImageComponentSchema: ComponentApi = {
  name: 'Image',
  description: '图片展示组件，支持多种尺寸和适配方式',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Image' },
      url: {
        description: '图片地址，支持动态字符串绑定',
        oneOf: dynamicStringOneOf(),
      },
      description: {
        description: '图片无障碍描述文本',
        oneOf: dynamicStringOneOf(),
      },
      fit: {
        type: 'string',
        enum: ['contain', 'cover', 'fill', 'none', 'scaleDown'],
        description: '图片适配方式，对应 CSS object-fit 属性',
      },
      variant: {
        type: 'string',
        enum: ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'],
        description: '图片尺寸和样式变体',
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'url'],
  },
};
