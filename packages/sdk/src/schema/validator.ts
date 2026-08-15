/**
 * A2UI v1.0 校验器 — 基于 Zod 的协议消息校验
 * 对应 Python: validating/validator.py
 *
 * 校验层次：
 * 1. Zod 协议信封校验（消息结构是否合法）
 * 2. 组件完整性检查（ID 唯一性、root 存在性、悬空引用）
 * 3. 拓扑分析（循环引用、可达性、深度限制）
 * 4. 路径语法检查
 * 5. 函数调用深度检查
 */

import { z } from 'zod';
import { A2uiClientMessageSchema, A2uiMessageSchema } from './index.js';
import type { UpdateComponentsMessage } from './index.js';
import { checkComponentIntegrity, checkFunctionCallDepth, checkPathSyntax } from './integrity-checker.js';
import { extractRefFields, analyzeTopology, topologyConfigSchema } from './topology-analyzer.js';
import { checkCompositionConstraints } from './composition-checker.js';
import { isUpdateComponentsMessage } from './agent-to-renderer.js';
import type { Catalog } from '../catalog/catalog.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 校验错误
 */
export const validationErrorSchema = z.object({
  /** 错误路径（组件 ID 或 JSON Pointer） */
  path: z.string(),
  /** 错误消息 */
  message: z.string(),
  /** 期望值 */
  expected: z.unknown().optional(),
  /** 实际值 */
  actual: z.unknown().optional(),
});
export type ValidationError = z.infer<typeof validationErrorSchema>;

/**
 * 校验结果
 */
export const validationResultSchema = z.object({
  /** 是否有效 */
  valid: z.boolean(),
  /** 错误列表 */
  errors: z.array(validationErrorSchema),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

/**
 * 校验配置
 */
export const validationConfigSchema = z.object({
  /** 是否允许孤立组件 */
  allowOrphanComponents: z.boolean().optional(),
  /** 是否允许缺失 root */
  allowMissingRoot: z.boolean().optional(),
  /** 是否执行拓扑分析 */
  runTopologyAnalysis: z.boolean().optional(),
  /** 是否执行完整性检查 */
  runIntegrityCheck: z.boolean().optional(),
  /** 拓扑分析配置 */
  topologyConfig: topologyConfigSchema.optional(),
});
export type ValidationConfig = z.infer<typeof validationConfigSchema>;

/**
 * 严格校验配置 — 所有检查项启用
 */
export const STRICT_VALIDATION: ValidationConfig = {
  allowOrphanComponents: false,
  allowMissingRoot: false,
  runTopologyAnalysis: true,
  runIntegrityCheck: true,
};

/**
 * 宽松校验配置 — 允许常见不完整情况
 */
export const RELAXED_VALIDATION: ValidationConfig = {
  allowOrphanComponents: true,
  allowMissingRoot: true,
  runTopologyAnalysis: false,
  runIntegrityCheck: false,
};

// ============================================================================
// A2uiValidator
// ============================================================================

/**
 * A2UI 校验器
 */
export class A2uiValidator {
  /**
   * 校验单条 Agent 到 Renderer 消息（Zod 解析）
   * 支持单条消息和消息数组
   */
  validateServerToClientMessage(data: unknown): ValidationResult {
    // 数组格式：逐条校验
    if (Array.isArray(data)) {
      const allErrors: ValidationError[] = [];
      for (let i = 0; i < data.length; i++) {
        const result = A2uiMessageSchema.safeParse(data[i]);
        if (!result.success) {
          for (const issue of result.error.issues) {
            allErrors.push({
              path: `[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
              message: issue.message,
            });
          }
        }
      }
      return { valid: allErrors.length === 0, errors: allErrors };
    }

    // 单条消息格式
    const result = A2uiMessageSchema.safeParse(data);
    if (result.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: formatZodErrors(result.error),
    };
  }

  /**
   * 校验 UpdateComponents 消息中的组件
   * 包含完整性检查和拓扑分析
   */
  validateComponents(message: UpdateComponentsMessage, config: ValidationConfig = STRICT_VALIDATION): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. 先校验消息信封
    const envelopeResult = this.validateServerToClientMessage(message);
    if (!envelopeResult.valid) {
      return envelopeResult;
    }

    const components = message.updateComponents.components;
    const rawComponents = components as unknown as Array<{ id?: string; [key: string]: unknown }>;

    // 2. 完整性检查
    if (config.runIntegrityCheck !== false) {
      const integrityErrors = checkComponentIntegrity(rawComponents, {
        allowMissingRoot: config.allowMissingRoot,
      });
      errors.push(...integrityErrors);

      // 函数调用深度
      const funcDepthErrors = checkFunctionCallDepth(rawComponents);
      errors.push(...funcDepthErrors);

      // 路径语法
      const pathErrors = checkPathSyntax(rawComponents);
      errors.push(...pathErrors);
    }

    // 3. 拓扑分析
    if (config.runTopologyAnalysis !== false && errors.length === 0) {
      const refFields = extractRefFields(rawComponents);
      const { errors: topoErrors } = analyzeTopology(rawComponents, refFields, {
        allowOrphanComponents: config.allowOrphanComponents,
        allowMissingRoot: config.allowMissingRoot,
        ...config.topologyConfig,
      });
      errors.push(...topoErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 校验消息列表
   */
  validateMessageList(messages: unknown[], config: ValidationConfig = STRICT_VALIDATION): ValidationResult {
    const errors: ValidationError[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const result = this.validateServerToClientMessage(msg);

      if (!result.valid) {
        for (const err of result.errors) {
          errors.push({
            path: `[${i}]${err.path ? '.' + err.path : ''}`,
            message: err.message,
          });
        }
        continue;
      }

      // 如果是 UpdateComponents 消息，做组件级别校验
      if (isUpdateComponentsMessage(msg)) {
        const compResult = this.validateComponents(msg, config);
        if (!compResult.valid) {
          for (const err of compResult.errors) {
            errors.push({
              path: `[${i}]${err.path ? '.' + err.path : ''}`,
              message: err.message,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 按 Catalog 校验 UpdateComponents 消息中的组件属性
   *
   * v1.0 规范：组件属性必须符合其所属 catalog 的组件 Schema。
   * 在 validateComponents（ID 完整性/拓扑）基础上增加属性级校验。
   *
   * @param message - UpdateComponents 消息
   * @param catalog - 用于校验组件属性的 Catalog
   * @returns 校验结果
   */
  validateComponentsWithCatalog(message: UpdateComponentsMessage, catalog: Catalog): ValidationResult {
    const baseResult = this.validateComponents(message, STRICT_VALIDATION);
    const errors: ValidationError[] = [...baseResult.errors];

    const components = message.updateComponents.components as unknown as Array<Record<string, unknown>>;
    for (const comp of components) {
      const issues = catalog.validateComponent(comp);
      for (const issue of issues) {
        errors.push({
          path: issue.path,
          message: issue.message,
        });
      }
    }

    // v1.0 组合约束校验：Surface 容器 + allowedParents/allowedChildren（缺省允许所有）
    const compErrors = checkCompositionConstraints(components, (type) => catalog.getCompositionConstraints(type));
    errors.push(...compErrors);

    return { valid: errors.length === 0, errors };
  }

  /**
   * 多 Catalog 校验（v1.0 #2079 mixable catalogs）
   *
   * 组件/函数调用所属 catalog 的解析顺序（对齐规范 evolution_guide.md）：
   *   1. 组件（或函数调用）显式声明的 catalogId
   *   2. surface 默认 catalogId（createSurface.catalogId）
   *   3. 两者皆缺 → 报错（不渲染该组件 / 拒绝该函数调用），不回退到 capabilities
   *
   * 组合约束（allowedParents/allowedChildren）按组件解析出的 catalog 提供。
   *
   * @param message - UpdateComponents 消息
   * @param catalogs - 可用 Catalog 列表（surface 混合目录）
   * @param options - surface 默认 catalogId 与校验配置
   * @returns 校验结果
   */
  validateComponentsWithCatalogs(
    message: UpdateComponentsMessage,
    catalogs: Catalog[],
    options: { surfaceDefaultCatalogId?: string; config?: ValidationConfig } = {},
  ): ValidationResult {
    const baseResult = this.validateComponents(message, options.config ?? STRICT_VALIDATION);
    const errors: ValidationError[] = [...baseResult.errors];

    const components = message.updateComponents.components as unknown as Array<Record<string, unknown>>;

    // 组件 id → 解析出的 Catalog（按组件级 catalogId → surface 默认）
    const catalogByComponent = new Map<string, Catalog>();
    for (const comp of components) {
      const compId = typeof comp['id'] === 'string' ? (comp['id'] as string) : '';
      const { catalog, error } = resolveComponentCatalog(comp, catalogs, options.surfaceDefaultCatalogId);
      if (error) {
        errors.push({ path: compId, message: error });
        continue;
      }
      if (catalog) catalogByComponent.set(compId, catalog);
    }

    // 组件属性校验（按组件解析出的 catalog）
    for (const comp of components) {
      const compId = typeof comp['id'] === 'string' ? (comp['id'] as string) : '';
      const catalog = catalogByComponent.get(compId);
      if (!catalog) continue; // 已在上一步报 catalog 解析错误
      const issues = catalog.validateComponent(comp);
      for (const issue of issues) {
        errors.push({ path: issue.path, message: issue.message });
      }
    }

    // 组合约束校验：组件类型 → 声明该类型的组件解析出的 catalog 的约束
    const compErrors = checkCompositionConstraints(components, (type) => {
      for (const comp of components) {
        if (comp['component'] === type) {
          const compId = typeof comp['id'] === 'string' ? (comp['id'] as string) : '';
          const catalog = catalogByComponent.get(compId);
          if (catalog) return catalog.getCompositionConstraints(type);
        }
      }
      return undefined;
    });
    errors.push(...compErrors);

    return { valid: errors.length === 0, errors };
  }

  /**
   * 校验单条消息（自动检测消息方向）
   * 兼容旧 API
   */
  validateServerToClient(data: unknown): ValidationResult {
    return this.validateServerToClientMessage(data);
  }

  /**
   * 校验 Renderer 到 Agent 消息
   */
  validateClientToServer(data: unknown): ValidationResult {
    const result = A2uiClientMessageSchema.safeParse(data);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: formatZodErrors(result.error),
    };
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 解析组件所属 Catalog（v1.0 #2079 mixable catalogs）
 *
 * 解析顺序（对齐规范 evolution_guide.md）：
 *   1. 组件显式 catalogId（ComponentCommon.catalogId）
 *   2. surface 默认 catalogId（createSurface.catalogId）
 *   3. 两者皆缺 → 返回 error（不回退到 capabilities 声明的 catalogs）
 *
 * @param comp - 组件对象
 * @param catalogs - 可用 Catalog 列表
 * @param surfaceDefaultCatalogId - surface 默认 catalogId（可选）
 * @returns 解析到的 Catalog；未解析时返回 error 说明
 */
export function resolveComponentCatalog(
  comp: Record<string, unknown>,
  catalogs: Catalog[],
  surfaceDefaultCatalogId?: string,
): { catalog: Catalog | undefined; error?: string } {
  const explicit = typeof comp['catalogId'] === 'string' ? (comp['catalogId'] as string) : undefined;
  const catalogId = explicit ?? surfaceDefaultCatalogId;

  if (!catalogId) {
    return {
      catalog: undefined,
      error: '组件未声明 catalogId，且 surface 未提供默认 catalogId（解析顺序：组件级 → surface 默认 → 报错）',
    };
  }

  const catalog = catalogs.find((c) => c.catalogId === catalogId);
  if (!catalog) {
    return {
      catalog: undefined,
      error: `catalog "${catalogId}" 不在可用 catalogs 中（surface 混合目录必须显式提供）`,
    };
  }
  return { catalog };
}

/** 格式化 Zod 错误为 ValidationError 数组 */
function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * 创建校验器实例
 */
export function createValidator(): A2uiValidator {
  return new A2uiValidator();
}
