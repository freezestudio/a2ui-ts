/**
 * A2UI 主题 Schema 定义
 * 对应 Python: basic_catalog/styles.py
 * @deprecated 主题支持已移除，保留仅供向后兼容
 */

import { z } from 'zod';

/**
 * 主题参数 Schema
 * 用于 CreateSurface 消息中的 theme 字段校验
 * @deprecated 主题支持已从协议中移除
 */
export const ThemeSchema = z.object({
  /** 主色调（十六进制颜色） */
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  /** Agent 图标 URL */
  iconUrl: z.string().url().optional(),
  /** Agent 显示名称 */
  agentDisplayName: z.string().optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Minimal Catalog 的主题 Schema
 * 来自 catalog.json 的 $defs/theme
 */
export const MinimalThemeSchema = {
  type: 'object',
  properties: {
    primaryColor: {
      type: 'string',
      pattern: '^#[0-9a-fA-F]{6}$',
    },
  },
  additionalProperties: true,
} as const;

export const FullThemeSchema = {
  type: 'object',
  properties: {
    primaryColor: {
      type: 'string',
      description: 'The primary brand color used for highlights',
      pattern: '^#[0-9a-fA-F]{6}$',
    },
    iconUrl: {
      type: 'string',
      format: 'uri',
      description: 'A URL for an image',
    },
    agentDisplayName: {
      type: 'string',
      description: '',
    },
  },
  additionalProperties: true,
};
