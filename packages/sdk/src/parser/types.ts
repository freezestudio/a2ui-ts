/**
 * 增量流式解析器类型定义 — Zod schema + 派生类型
 */

import { z } from 'zod';
import type { RefFieldsMap } from '../schema/topology-analyzer.js';

// ============================================================================
// 括号栈条目
// ============================================================================

export const BraceStackEntrySchema = z.object({
  type: z.enum(['{', '[']),
  startPos: z.number(),
});
export type BraceStackEntry = z.infer<typeof BraceStackEntrySchema>;

// ============================================================================
// 缓存的组件
// ============================================================================

export const CachedComponentSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
  complete: z.boolean(),
});
export type CachedComponent = z.infer<typeof CachedComponentSchema>;

// ============================================================================
// 拓扑追踪状态（含 Set / RefFieldsMap，保留为 plain interface）
// ============================================================================

export interface TopologyState {
  dirty: boolean;
  reachable: Set<string>;
  refFields: RefFieldsMap;
}

// ============================================================================
// 数据模型增量
// ============================================================================

export const DataModelDeltaSchema = z.strictObject({
  path: z.string(),
  value: z.unknown(),
});
export type DataModelDelta = z.infer<typeof DataModelDeltaSchema>;

// ============================================================================
// 部分组件
// ============================================================================

export const PartialComponentSchema = z.strictObject({
  id: z.string(),
  type: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  isPlaceholder: z.boolean(),
});
export type PartialComponent = z.infer<typeof PartialComponentSchema>;

// ============================================================================
// 增量响应部分（可辨识联合）
// ============================================================================

export const IncrementalResponsePartSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.strictObject({
    type: z.literal('a2ui_partial'),
    incremental: z.literal(true),
    surfaceId: z.string(),
    catalogId: z.string().optional(),
    messageType: z.enum(['createSurface', 'updateComponents']),
    components: z.array(PartialComponentSchema),
    dataModelDelta: DataModelDeltaSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('a2ui_json'),
    data: z.unknown().nullable(),
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
  }),
]);
export type IncrementalResponsePart = z.infer<typeof IncrementalResponsePartSchema>;

// ============================================================================
// 解析器配置
// ============================================================================

export const IncrementalParserConfigSchema = z.object({
  autoFix: z.boolean().optional().default(true),
  enableIncrementalYield: z.boolean().optional().default(true),
  placeholderType: z.string().optional().default('placeholder'),
});
export type IncrementalParserConfigInput = z.input<typeof IncrementalParserConfigSchema>;
export type IncrementalParserConfig = z.infer<typeof IncrementalParserConfigSchema>;
