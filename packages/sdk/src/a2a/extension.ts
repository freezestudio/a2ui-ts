/**
 * A2UI 扩展声明工具
 * 用于在 A2A Agent Card 中声明 A2UI 扩展能力
 * 对应 A2UI v1.0 A2A Extension 规范
 */

import { z } from 'zod';

/** A2UI v1.0 扩展 URI */
export const A2UI_EXTENSION_URI_V1_0 = 'https://a2ui.org/a2a-extension/a2ui/v1.0';

/** @deprecated 使用 A2UI_EXTENSION_URI_V1_0 */
export const A2UI_EXTENSION_URI = A2UI_EXTENSION_URI_V1_0;

/** @deprecated 使用 'v1.0' */
export const A2UI_EXTENSION_VERSION = 'v1.0';

/** A2UI Agent 能力参数 */
export const a2uiServerCapabilitiesSchema = z.object({
  /** 支持的 Catalog ID 列表 */
  supportedCatalogIds: z.array(z.string()).optional(),
  /** 是否接受内联 Catalog */
  acceptsInlineCatalogs: z.boolean().optional(),
});
export type A2uiServerCapabilities = z.infer<typeof a2uiServerCapabilitiesSchema>;

/** A2A 扩展声明 */
export const agentExtensionSchema = z.object({
  uri: z.string(),
  description: z.string(),
  required: z.boolean(),
  params: z.record(z.string(), z.unknown()),
});
export type AgentExtension = z.infer<typeof agentExtensionSchema>;

/**
 * 创建 A2UI 扩展声明（嵌入 A2A Agent Card）
 * @param capabilities - Agent A2UI 能力
 */
export function createA2uiExtension(capabilities: A2uiServerCapabilities = {}): AgentExtension {
  return {
    uri: A2UI_EXTENSION_URI_V1_0,
    description: 'Ability to render A2UI v1.0',
    required: false,
    params: {
      supportedCatalogIds: capabilities.supportedCatalogIds ?? [
        'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
      ],
      acceptsInlineCatalogs: capabilities.acceptsInlineCatalogs ?? false,
    },
  };
}

/** 检测扩展是否为 A2UI 扩展 */
export function isA2uiExtension(ext: AgentExtension): boolean {
  return ext.uri === A2UI_EXTENSION_URI_V1_0;
}

/** 从 AgentExtension 提取 A2UI 参数 */
export function extractA2uiParams(ext: AgentExtension): A2uiServerCapabilities | null {
  if (!isA2uiExtension(ext)) return null;
  return (ext.params as A2uiServerCapabilities) ?? null;
}

/**
 * 版本协商：从 Renderer 请求的扩展列表中选择最佳 A2UI 版本
 * @param requestedExtensions - Renderer 请求的扩展 URI 列表
 * @returns 协商后的扩展 URI，如果不支持则返回 null
 */
export function negotiateA2uiVersion(requestedExtensions: string[]): string | null {
  if (requestedExtensions.includes(A2UI_EXTENSION_URI_V1_0)) {
    return A2UI_EXTENSION_URI_V1_0;
  }
  return null;
}
