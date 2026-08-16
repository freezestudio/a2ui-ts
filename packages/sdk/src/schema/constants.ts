/**
 * A2UI v1.0 协议常量定义
 */

import type { ProtocolVersion } from '../core/types.js';

/** 协议版本号 */
export const SPEC_VERSION = 'v1.0' as const;

/** 协议基础 URL */
export const SPEC_BASE_URL = 'https://a2ui.org/specification' as const;

/** A2UI MIME 类型 */
export const A2UI_MIME_TYPE = 'application/a2ui+json' as const;

/** 支持的协议版本 */
export const SUPPORTED_VERSIONS: ProtocolVersion[] = ['v1.0'];

/** Agent → Renderer 消息类型常量（v1.0 #2210 双向函数调用重命名） */
export const MessageType = {
  CreateSurface: 'createSurface',
  UpdateComponents: 'updateComponents',
  UpdateDataModel: 'updateDataModel',
  DeleteSurface: 'deleteSurface',
  CallRendererFunction: 'callRendererFunction',
  AgentFunctionResponse: 'agentFunctionResponse',
} as const;

/** Renderer → Agent 消息类型常量（v1.0 #2210） */
export const ClientMessageType = {
  Action: 'action',
  CallAgentFunction: 'callAgentFunction',
  RendererFunctionResponse: 'rendererFunctionResponse',
  Error: 'error',
} as const;

/** Catalog 相关键名 */
export const CatalogKeys = {
  Components: 'components',
  Functions: 'functions',
} as const;

/** Surface 相关键名 */
export const SurfaceKeys = {
  SurfaceId: 'surfaceId',
  CatalogId: 'catalogId',
  SendDataModel: 'sendDataModel',
} as const;

/** 根组件 ID 约定 */
export const ROOT_ID = 'root' as const;

/** 全局组件最大嵌套深度 */
export const MAX_GLOBAL_DEPTH = 50;

/** 函数调用最大嵌套深度 */
export const MAX_FUNC_CALL_DEPTH = 5;
