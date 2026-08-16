/**
 * A2UI v1.0 Agent 到 Renderer 消息类型
 * 对应 JSON Schema: agent_to_renderer.json
 * v1.0 #2210 双向函数调用: CallFunctionMessage → CallRendererFunctionMessage,
 * ActionResponseMessage → AgentFunctionResponseMessage
 */

import { z } from 'zod';
import { SPEC_VERSION } from './constants.js';
import {
  ComponentIdSchema,
  CallIdSchema,
  MetadataSchema,
  FunctionResponseSchema,
  AccessibilityAttributesSchema,
} from './common-types.js';
import { SURFACE_COMPONENT } from './composition-checker.js';

// ============================================================================
// 组件 Payload Schema
// ============================================================================

/**
 * 组件 Payload — 从 catalog 的 anyComponent 验证
 *
 * 信封级校验（对齐规范 agent_to_renderer.json#/$defs/Component）：
 * - ComponentCommon：id 必填，catalogId / accessibility / metadata 可选
 * - `component` 出现时禁止为协议保留的 "Surface"（component.not.const: "Surface"）；
 *   组件类型本身由 catalog 校验（anyComponent），信封层不强制
 * - 其余组件特定属性（text / children / action 等）依赖 catalog 校验，此处宽松透传
 */
export const ComponentPayloadSchema = z.looseObject({
  id: ComponentIdSchema,
  component: z
    .string()
    .refine((c) => c !== SURFACE_COMPONENT, {
      message: `协议保留组件名 "${SURFACE_COMPONENT}" 禁止出现在消息组件中（仅作为隐式 surface 根容器）`,
    })
    .optional(),
  catalogId: z.string().optional(),
  accessibility: AccessibilityAttributesSchema.optional(),
  metadata: MetadataSchema,
});
export type ComponentPayload = z.infer<typeof ComponentPayloadSchema>;

/**
 * 组件列表（v1.0 提取为独立定义）
 * 每个组件先做信封级校验（id/component/metadata 等），再交由 catalog 校验组件特定属性。
 */
export const ComponentsListSchema = z.array(ComponentPayloadSchema).min(1);
export type ComponentsList = z.infer<typeof ComponentsListSchema>;

// ============================================================================
// Agent -> Renderer 消息定义
// ============================================================================

/**
 * 创建表面消息体
 * v1.0: 删除 theme/surfaceProperties，新增 components/dataModel
 */
export const CreateSurfacePayloadSchema = z.strictObject({
  surfaceId: z.string(),
  catalogId: z.string().optional(),
  sendDataModel: z.boolean().optional(),
  components: ComponentsListSchema.optional(),
  dataModel: z.record(z.string(), z.unknown()).optional(),
  metadata: MetadataSchema,
});
export type CreateSurfacePayload = z.infer<typeof CreateSurfacePayloadSchema>;

/**
 * 创建表面消息
 */
export const CreateSurfaceMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  createSurface: CreateSurfacePayloadSchema,
});
export type CreateSurfaceMessage = z.infer<typeof CreateSurfaceMessageSchema>;

/**
 * 更新组件消息体
 */
export const UpdateComponentsPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  components: ComponentsListSchema,
});
export type UpdateComponentsPayload = z.infer<typeof UpdateComponentsPayloadSchema>;

/**
 * 更新组件消息
 */
export const UpdateComponentsMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  updateComponents: UpdateComponentsPayloadSchema,
});
export type UpdateComponentsMessage = z.infer<typeof UpdateComponentsMessageSchema>;

/**
 * 更新数据模型消息体
 */
export const UpdateDataModelPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  path: z.string().optional(),
  value: z.unknown(),
});
export type UpdateDataModelPayload = z.infer<typeof UpdateDataModelPayloadSchema>;

/**
 * 更新数据模型消息
 */
export const UpdateDataModelMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  updateDataModel: UpdateDataModelPayloadSchema,
});
export type UpdateDataModelMessage = z.infer<typeof UpdateDataModelMessageSchema>;

/**
 * 删除表面消息体
 */
export const DeleteSurfacePayloadSchema = z.strictObject({
  surfaceId: z.string(),
});
export type DeleteSurfacePayload = z.infer<typeof DeleteSurfacePayloadSchema>;

/**
 * 删除表面消息
 */
export const DeleteSurfaceMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  deleteSurface: DeleteSurfacePayloadSchema,
});
export type DeleteSurfaceMessage = z.infer<typeof DeleteSurfaceMessageSchema>;

/**
 * 调用渲染端函数消息（v1.0 #2210 重构，原名 CallFunctionMessage）
 * Agent 主动向 Renderer 发起函数调用
 */
export const CallRendererFunctionPayloadSchema = z.strictObject({
  functionCallId: CallIdSchema,
  callFunction: z.strictObject({
    call: z.string(),
    catalogId: z.string(),
    args: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type CallRendererFunctionPayload = z.infer<typeof CallRendererFunctionPayloadSchema>;

export const CallRendererFunctionMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  callRendererFunction: CallRendererFunctionPayloadSchema,
});
export type CallRendererFunctionMessage = z.infer<typeof CallRendererFunctionMessageSchema>;

/**
 * Agent 函数响应消息（v1.0 #2210 重构，原名 ActionResponseMessage）
 * Agent 对 Renderer 发起的 callAgentFunction 的响应
 */
export const AgentFunctionResponsePayloadSchema = FunctionResponseSchema;
export type AgentFunctionResponsePayload = z.infer<typeof AgentFunctionResponsePayloadSchema>;

export const AgentFunctionResponseMessageSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  agentFunctionResponse: AgentFunctionResponsePayloadSchema,
});
export type AgentFunctionResponseMessage = z.infer<typeof AgentFunctionResponseMessageSchema>;

// ============================================================================
// 消息联合类型
// ============================================================================

/**
 * Agent 到 Renderer 消息 — 6 种消息类型的联合（v1.0）
 */
export const A2uiMessageSchema = z.union([
  CreateSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
  DeleteSurfaceMessageSchema,
  CallRendererFunctionMessageSchema,
  AgentFunctionResponseMessageSchema,
]);
export type A2uiMessage = z.infer<typeof A2uiMessageSchema>;

/**
 * Agent 到 Renderer 消息列表
 */
export const A2uiMessageListSchema = z.array(A2uiMessageSchema);
export type A2uiMessageList = z.infer<typeof A2uiMessageListSchema>;

/**
 * Agent 到 Renderer 消息列表包装器
 */
export const A2uiMessageListWrapperSchema = z.strictObject({
  messages: A2uiMessageListSchema,
});
export type A2uiMessageListWrapper = z.infer<typeof A2uiMessageListWrapperSchema>;

// ============================================================================
// 消息类型判断工具
// ============================================================================

/** 判断是否为 CreateSurface 消息 */
export function isCreateSurfaceMessage(msg: unknown): msg is CreateSurfaceMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'createSurface' in msg;
}

/** 判断是否为 UpdateComponents 消息 */
export function isUpdateComponentsMessage(msg: unknown): msg is UpdateComponentsMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'updateComponents' in msg;
}

/** 判断是否为 UpdateDataModel 消息 */
export function isUpdateDataModelMessage(msg: unknown): msg is UpdateDataModelMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'updateDataModel' in msg;
}

/** 判断是否为 DeleteSurface 消息 */
export function isDeleteSurfaceMessage(msg: unknown): msg is DeleteSurfaceMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'deleteSurface' in msg;
}

/** 判断是否为 CallRendererFunction 消息（v1.0 #2210） */
export function isCallRendererFunctionMessage(msg: unknown): msg is CallRendererFunctionMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'callRendererFunction' in msg;
}

/** 判断是否为 AgentFunctionResponse 消息（v1.0 #2210） */
export function isAgentFunctionResponseMessage(msg: unknown): msg is AgentFunctionResponseMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'agentFunctionResponse' in msg;
}
