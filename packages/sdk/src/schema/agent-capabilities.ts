/**
 * A2UI v1.0 Agent 能力声明类型
 * 对应 JSON Schema: agent_capabilities.json
 * 对应 Python: schema/agent_capabilities.py（在 A2A 集成层）
 */

import { z } from 'zod/v4';
import { SPEC_VERSION } from './constants.js';

// ============================================================================
// v1.0 Agent 能力
// ============================================================================

/**
 * v1.0 协议版本的 Agent 能力声明
 */
export const V10ServerCapabilitiesSchema = z.object({
  /** Agent 支持的 Catalog ID 列表 */
  supportedCatalogIds: z.array(z.string()).optional(),
  /** 是否接受 Renderer 的内联 Catalog */
  acceptsInlineCatalogs: z.boolean().default(false),
});
export type V10ServerCapabilities = z.infer<typeof V10ServerCapabilitiesSchema>;

/**
 * A2UI Agent 能力声明
 * Agent 通过 Agent Card 或其他传输协议向 Renderer 展示
 */
export const A2uiServerCapabilitiesSchema = z.strictObject({
  [SPEC_VERSION]: V10ServerCapabilitiesSchema,
});
export type A2uiServerCapabilities = z.infer<typeof A2uiServerCapabilitiesSchema>;

// ============================================================================
// 工具类型
// ============================================================================

/** 从 Agent 能力中提取 v1.0 版本的能力声明 */
export function getV10ServerCapabilities(caps: A2uiServerCapabilities): V10ServerCapabilities | undefined {
  return caps[SPEC_VERSION];
}
