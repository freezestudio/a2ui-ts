/**
 * A2UI v1.0 Renderer 到 Agent 消息类型
 * 对应 JSON Schema: renderer_to_agent.json
 * v1.0 #2210 双向函数调用: functionResponse → rendererFunctionResponse，
 * 新增 callAgentFunction（renderer 发起远程函数调用），action 增加 userMessage。
 */

import { z } from 'zod';
import { SPEC_VERSION } from './constants.js';
import { CallIdSchema, MetadataSchema, FunctionCallSchema, FunctionResponseSchema } from './common-types.js';

// ============================================================================
// Renderer 动作消息 ['action', 'version']
// ============================================================================

/**
 * Renderer 动作消息体
 * v1.0 #2228: 新增 userMessage（人类可读描述）
 * v1.0 #2210: 移除 wantResponse/actionId（响应机制由 callAgentFunction 替代）
 */
export const ClientActionPayloadSchema = z.object({
  name: z.string(),
  userMessage: z.string().optional(),
  surfaceId: z.string(),
  sourceComponentId: z.string(),
  timestamp: z.string(),
  context: z.record(z.string(), z.unknown()),
  metadata: MetadataSchema,
});
export type ClientActionPayload = z.infer<typeof ClientActionPayloadSchema>;

/**
 * Renderer 动作消息
 */
export const A2uiClientActionMessageSchema = z
  .strictObject({
    version: z.literal(SPEC_VERSION),
    action: ClientActionPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiClientActionMessage = z.infer<typeof A2uiClientActionMessageSchema>;

// ============================================================================
// 调用 Agent 函数消息 ['callAgentFunction', 'version']（v1.0 #2210 新增）
// ============================================================================

/**
 * 调用 Agent 函数消息体
 * Renderer 发起对 Agent 端函数的远程调用，Agent 以 agentFunctionResponse 响应
 */
export const CallAgentFunctionPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  functionCallId: CallIdSchema,
  callFunction: FunctionCallSchema,
});
export type CallAgentFunctionPayload = z.infer<typeof CallAgentFunctionPayloadSchema>;

export const A2uiClientCallAgentFunctionMessageSchema = z
  .strictObject({
    version: z.literal(SPEC_VERSION),
    callAgentFunction: CallAgentFunctionPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiClientCallAgentFunctionMessage = z.infer<typeof A2uiClientCallAgentFunctionMessageSchema>;

// ============================================================================
// 渲染端函数响应消息 ['rendererFunctionResponse', 'version']（v1.0 #2210 重构）
// ============================================================================

/**
 * 渲染端函数响应消息体
 * Renderer 响应 Agent CallRendererFunction 消息的函数执行结果（成功或失败）
 */
export const RendererFunctionResponsePayloadSchema = FunctionResponseSchema;
export type RendererFunctionResponsePayload = z.infer<typeof RendererFunctionResponsePayloadSchema>;

export const A2uiRendererFunctionResponseMessageSchema = z
  .strictObject({
    version: z.literal(SPEC_VERSION),
    rendererFunctionResponse: RendererFunctionResponsePayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiRendererFunctionResponseMessage = z.infer<typeof A2uiRendererFunctionResponseMessageSchema>;

// ============================================================================
// Renderer 错误消息 ['error', 'version']
// ============================================================================

/**
 * 校验失败错误
 */
export const ValidationFailedErrorSchema = z.strictObject({
  code: z.literal('VALIDATION_FAILED'),
  surfaceId: z.string(),
  path: z.string(),
  message: z.string(),
});
export type ValidationFailedError = z.infer<typeof ValidationFailedErrorSchema>;

/**
 * 通用错误
 * v1.0: surfaceId 和 functionCallId 互斥
 */
export const GenericErrorSchema = z
  .looseObject({
    code: z.string().refine((c) => c !== 'VALIDATION_FAILED'),
    message: z.string(),
    surfaceId: z.string().optional(),
    functionCallId: CallIdSchema.optional(),
  })
  .refine(
    (data) => {
      const hasSurfaceId = data.surfaceId !== undefined;
      const hasFunctionCallId = data.functionCallId !== undefined;
      return hasSurfaceId !== hasFunctionCallId;
    },
    { message: 'Either surfaceId or functionCallId must be provided, but not both' },
  );
export type GenericError = z.infer<typeof GenericErrorSchema>;

/**
 * 错误消息体 — 两种错误类型的联合
 */
export const ClientErrorPayloadSchema = z.union([ValidationFailedErrorSchema, GenericErrorSchema]);
export type ClientErrorPayload = z.infer<typeof ClientErrorPayloadSchema>;

/**
 * Renderer 错误消息
 */
export const A2uiClientErrorMessageSchema = z
  .strictObject({
    version: z.literal(SPEC_VERSION),
    error: ClientErrorPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiClientErrorMessage = z.infer<typeof A2uiClientErrorMessageSchema>;

// ============================================================================
// 消息联合类型
// ============================================================================

/**
 * Renderer 到 Agent 消息 — 4 种消息类型（v1.0 #2210 双向函数调用）
 */
export const A2uiClientMessageSchema = z.union([
  A2uiClientActionMessageSchema,
  A2uiClientCallAgentFunctionMessageSchema,
  A2uiRendererFunctionResponseMessageSchema,
  A2uiClientErrorMessageSchema,
]);
export type A2uiClientMessage = z.infer<typeof A2uiClientMessageSchema>;

/**
 * Renderer 到 Agent 消息列表
 */
export const A2uiClientMessageListSchema = z.array(A2uiClientMessageSchema);
export type A2uiClientMessageList = z.infer<typeof A2uiClientMessageListSchema>;

/**
 * Renderer 到 Agent 消息列表包装器
 */
export const A2uiClientMessageListWrapperSchema = z.object({
  messages: A2uiClientMessageListSchema,
});
export type A2uiClientMessageListWrapper = z.infer<typeof A2uiClientMessageListWrapperSchema>;

// ============================================================================
// 消息类型判断工具
// ============================================================================

/** 判断是否为动作消息 */
export function isClientActionMessage(msg: unknown): msg is A2uiClientActionMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'action' in msg;
}

/** 判断是否为 callAgentFunction 消息（v1.0 #2210） */
export function isCallAgentFunctionMessage(msg: unknown): msg is A2uiClientCallAgentFunctionMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'callAgentFunction' in msg;
}

/** 判断是否为渲染端函数响应消息（v1.0 #2210） */
export function isRendererFunctionResponseMessage(msg: unknown): msg is A2uiRendererFunctionResponseMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'rendererFunctionResponse' in msg;
}

/** 判断是否为错误消息 */
export function isClientErrorMessage(msg: unknown): msg is A2uiClientErrorMessage {
  return typeof msg === 'object' && msg !== null && 'version' in msg && 'error' in msg;
}

/** 判断是否为校验失败错误 */
export function isValidationFailedError(error: unknown): error is ValidationFailedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as Record<string, unknown>).code === 'VALIDATION_FAILED'
  );
}
