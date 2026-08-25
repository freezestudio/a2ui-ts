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
 * 函数返回类型（对齐官方 catalog_definition.json#/$defs/FunctionDefinition.returnType）
 */
export const FUNCTION_RETURN_TYPES = [
  'string',
  'number',
  'boolean',
  'array',
  'object',
  'validationResult',
  'any',
  'void',
] as const;
export type FunctionReturnType = (typeof FUNCTION_RETURN_TYPES)[number];

/**
 * 函数执行边界（对齐官方 catalog_definition.json#/$defs/FunctionDefinition.allowedCallers）
 */
export const FUNCTION_ALLOWED_CALLERS = ['rendererOnly', 'agentOnly', 'rendererOrAgent'] as const;
export type FunctionAllowedCallers = (typeof FUNCTION_ALLOWED_CALLERS)[number];

/**
 * 函数定义 — 描述函数接口（对齐官方 catalog_definition.json#/$defs/FunctionDefinition）
 *
 * 官方约束：
 * - returnType 枚举 8 种取值
 * - allowedCallers 枚举 3 种取值，默认 rendererOnly
 * - requiresUserActivation=true 时 allowedCallers 必须为 rendererOnly
 */
export const FunctionDefinitionSchema = z
  .strictObject({
    /** 函数唯一名称 */
    name: z.string(),
    /** 函数描述 */
    description: z.string().optional(),
    /** 参数 JSON Schema */
    parameters: z.record(z.string(), z.unknown()),
    /** 返回类型（默认 any） */
    returnType: z.enum(FUNCTION_RETURN_TYPES).optional(),
    /** 允许的调用方（默认 rendererOnly） */
    allowedCallers: z.enum(FUNCTION_ALLOWED_CALLERS).optional(),
    /** 是否要求用户激活上下文（默认 false） */
    requiresUserActivation: z.boolean().optional(),
  })
  .superRefine((fn, ctx) => {
    if (fn.requiresUserActivation === true && fn.allowedCallers !== 'rendererOnly' && fn.allowedCallers !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'requiresUserActivation=true 时 allowedCallers 必须为 rendererOnly',
        path: ['allowedCallers'],
      });
    }
  });
export type FunctionDefinition = z.infer<typeof FunctionDefinitionSchema>;

// ============================================================================
// 内联 Catalog
// ============================================================================

/**
 * 内联 Catalog 定义（对齐官方 catalog_definition.json 顶层结构）
 */
export const InlineCatalogSchema = z.strictObject({
  $schema: z.string().optional(),
  $id: z.string().optional(),
  protocolVersion: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  /** Catalog 唯一标识符 */
  catalogId: z.string(),
  instructions: z.string().optional(),
  /** 组件定义（以组件类型为 key 的 JSON Schema 映射） */
  components: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  /** 函数定义（以函数名为 key 的 JSON Schema 映射，v1.0） */
  functions: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  /** 仅允许 anyComponent / anyFunction */
  $defs: z.record(z.string(), z.unknown()).optional(),
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
