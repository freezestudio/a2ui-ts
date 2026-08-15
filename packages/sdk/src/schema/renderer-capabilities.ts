/**
 * A2UI v1.0 Renderer 能力声明类型
 * 对应 JSON Schema: renderer_capabilities.json
 * 对应 Python: schema/renderer_capabilities.py
 */

import { z } from 'zod';
import { SPEC_VERSION } from './constants.js';

// ============================================================================
// 函数定义
// ============================================================================

/**
 * 函数定义 — 描述函数接口
 */
export const FunctionDefinitionSchema = z.strictObject({
  /** 函数唯一名称 */
  name: z.string(),
  /** 函数描述 */
  description: z.string().optional(),
  /** 参数 JSON Schema */
  parameters: z.record(z.string(), z.unknown()),
});
export type FunctionDefinition = z.infer<typeof FunctionDefinitionSchema>;

// ============================================================================
// 内联 Catalog
// ============================================================================

/**
 * 内联 Catalog 定义
 * Renderer 在能力声明中提供的组件和函数集合
 * {
 *   $schema: '',
 *   $id: '',
 *   $defs: {},
 *   title: '',
 *   description: '',
 *   catalogId: '',
 *   instructions: '',
 *   components: {},
 *   functions: {},
 * }
 */
export const InlineCatalogSchema = z.strictObject({
  /** Catalog 唯一标识符 */
  catalogId: z.string(),
  /** 组件定义（以组件类型为 key 的 JSON Schema 映射） */
  components: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  /** 函数定义列表 */
  functions: z.array(FunctionDefinitionSchema).optional(),
});
export type InlineCatalog = z.infer<typeof InlineCatalogSchema>;

// ============================================================================
// v1.0 Renderer 能力
// ============================================================================

/**
 * v1.0 协议版本的 Renderer 能力声明
 */
export const V10CapabilitiesSchema = z.strictObject({
  /** 支持的 Catalog ID 列表 */
  supportedCatalogIds: z.array(z.string()),
  /** 内联 Catalog 列表（仅在 Agent 声明 acceptsInlineCatalogs 时提供） */
  inlineCatalogs: z.array(InlineCatalogSchema).optional(),
});
export type V10Capabilities = z.infer<typeof V10CapabilitiesSchema>;

/**
 * A2UI Renderer 能力声明
 * Renderer 通过 A2A 元数据发送给 Agent
 */
export const A2uiClientCapabilitiesSchema = z.strictObject({
  [SPEC_VERSION]: V10CapabilitiesSchema,
});
export type A2uiClientCapabilities = z.infer<typeof A2uiClientCapabilitiesSchema>;

// ============================================================================
// 工具类型
// ============================================================================

/** 从 Renderer 能力中提取 v1.0 版本的能力声明 */
export function getV10Capabilities(caps: A2uiClientCapabilities): V10Capabilities | undefined {
  return caps[SPEC_VERSION];
}
