/**
 * Catalog 类型定义
 * 对应 Python: catalog/components.py + catalog/functions.py
 *
 * ComponentApi — 框架无关的组件 API 定义
 * FunctionApi — 函数 API 定义（含可选执行实现）
 */

import { z, type ZodType } from 'zod';

// ============================================================================
// 组件 API
// ============================================================================

/**
 * 组件 API 定义
 * 描述一个组件的类型信息，不绑定具体实现
 */
export const componentApiSchema = z.object({
  /** 组件名称（如 'Text', 'Button'） */
  name: z.string(),
  /** 组件 JSON Schema 定义 */
  schema: z.record(z.string(), z.unknown()),
  /** 组件描述（用于 prompt 生成） */
  description: z.string().optional(),
});
export type ComponentApi = z.infer<typeof componentApiSchema>;

/**
 * Catalog 组件公共属性
 * 每个 catalog 组件在 ComponentCommon 基础上的额外属性
 */
export const catalogComponentCommonSchema = z.object({
  /** 布局权重 */
  weight: z.number().optional(),
});
export type CatalogComponentCommon = z.infer<typeof catalogComponentCommonSchema>;

/**
 * 从组件 payload 创建 ComponentApi
 * 提取组件名称并包装 schema
 */
export function createComponentApi(name: string, schema: Record<string, unknown>, description?: string): ComponentApi {
  return { name, schema, description };
}

// ============================================================================
// 函数 API
// ============================================================================

/**
 * 函数执行上下文
 */
export const functionContextSchema = z.object({
  /** 当前 Surface ID */
  surfaceId: z.string().optional(),
  /** 当前组件 ID */
  componentId: z.string().optional(),
  /** 数据模型值 */
  dataModel: z.record(z.string(), z.unknown()).optional(),
  /** 是否正在执行 Action（用户交互触发的执行链，跨 await 保持） */
  isExecutingAction: z.boolean().optional(),
  /** Action 意图分类：activation（click/tap/submit）/ passive（blur/change 等） */
  actionIntent: z.enum(['activation', 'passive']).optional(),
});
export type FunctionContext = z.infer<typeof functionContextSchema>;

/**
 * 函数 API 定义
 * 描述函数的类型信息，可选携带执行实现
 */
export interface FunctionApi {
  /** 函数名称 */
  name: string;
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>;
  /** 函数描述 */
  description?: string;
  /** 返回类型元数据（v1.0 #2220 新增 validationResult） */
  returnType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'validationResult' | 'any' | 'void';
  /** 授权调用者（allowedCallers，上游 #2238 由 callableFrom 改名）：rendererOnly(仅渲染端) | agentOnly(仅Agent端) | rendererOrAgent(两端均可) */
  allowedCallers?: 'rendererOnly' | 'agentOnly' | 'rendererOrAgent';
  /** 是否需要用户激活上下文（requiresUserActivation）才能执行：仅用户交互（click/tap/submit）触发时允许 */
  requiresUserActivation?: boolean;
  /** 函数执行实现（可选） */
  execute?: (args: Record<string, unknown>, context: FunctionContext) => unknown;
  /** 参数 Zod 校验器（可选，用于运行时参数校验） */
  argsSchema?: ZodType;
}

/**
 * 创建函数 API
 */
export function createFunctionApi(
  name: string,
  parameters: Record<string, unknown>,
  options?: {
    description?: string;
    returnType?: FunctionApi['returnType'];
    allowedCallers?: FunctionApi['allowedCallers'];
    requiresUserActivation?: FunctionApi['requiresUserActivation'];
    execute?: FunctionApi['execute'];
    argsSchema?: ZodType;
  },
): FunctionApi {
  return {
    name,
    parameters,
    ...options,
  };
}

// ============================================================================
// Catalog 配置
// ============================================================================

/**
 * Catalog 配置 — 用于加载 Catalog 的元数据
 * 对应 agent_sdk_guide.md 中的 CatalogConfig
 */
export const catalogConfigSchema = z.object({
  /**
   * Catalog 唯一标识符
   * basic:   "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
   * minimal: "https://a2ui.org/specification/v1_0/catalogs/minimal/catalog.json",
   */
  catalogId: z.string(),
  /** Catalog 版本（如 'v1_0'） */
  version: z.string(),
  /** Catalog 文件路径（可选，默认使用内置） */
  path: z.string().optional(),
});
export type CatalogConfig = z.infer<typeof catalogConfigSchema>;
