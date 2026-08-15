import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

export const VideoComponentSchema: ComponentApi = {
  name: 'Video',
  description: '视频展示组件',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'Video' },
      url: {
        description: '视频地址，支持动态字符串绑定',
        oneOf: dynamicStringOneOf(),
      },
      posterUrl: {
        description: '视频封面图地址',
        oneOf: dynamicStringOneOf(),
      },
      weight: {
        type: 'number',
        description: '组件在布局中的权重值',
      },
    },
    required: ['component', 'url'],
  },
};
