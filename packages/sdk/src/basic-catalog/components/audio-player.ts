import type { ComponentApi } from '../../catalog/types.js';
import { dynamicStringOneOf } from '../schema-helpers.js';

/**
 * 音频播放器
 * {
 *   components: "AudioPlayer",
 *   properties: {
 *     component: {const: 'AudioPlayer}},
 *     url: '' | {path: ''} | {call: '', args: {}},
 *     description: '' | {path: ''} | {call: '', args: {}}
 *   }
 */
export const AudioPlayerComponentSchema: ComponentApi = {
  name: 'AudioPlayer',
  description: '音频播放器组件',
  schema: {
    type: 'object',
    properties: {
      component: { const: 'AudioPlayer' },
      url: {
        description: '音频地址，支持动态字符串绑定',
        oneOf: dynamicStringOneOf(),
      },
      description: {
        description: '音频描述文本，如标题或摘要',
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
