/**
 * A2A 集成模块入口
 *
 * 启用状态：**未启用**。本模块提供 A2A 扩展协商与 Part 转换的类型/工具，
 * 但当前 apps/server 走内部 WebSocket/SSE 直连，未消费本模块（无 A2A server、
 * 无 Part 转换链路）。若未来接入 A2A 生态（多 agent 标准协议），需补充
 * A2A server + Part 转换管道（对齐上游 agent_sdks/python/adk/）。
 */

export {
  A2UI_MIME_TYPE,
  createA2uiPart,
  isA2uiPart,
  extractA2uiParts,
  getA2uiData,
  a2uiMessagesToPart,
  partToA2uiMessages,
} from './parts.js';
export {
  A2UI_EXTENSION_URI,
  A2UI_EXTENSION_URI_V1_0,
  A2UI_EXTENSION_VERSION,
  createA2uiExtension,
  isA2uiExtension,
  extractA2uiParams,
  negotiateA2uiVersion,
  a2uiServerCapabilitiesSchema,
  agentExtensionSchema,
} from './extension.js';
export type { A2uiServerCapabilities, AgentExtension } from './extension.js';
export {
  a2aTextPartSchema,
  a2aDataPartSchema,
  a2aRawPartSchema,
  a2aUrlPartSchema,
  a2aPartSchema,
  a2aTaskStateSchema,
  a2aTaskStatusSchema,
  a2aTaskSchema,
} from './types.js';
export type {
  A2APart,
  A2ATextPart,
  A2ADataPart,
  A2ARawPart,
  A2AUrlPart,
  A2ATask,
  A2ATaskStatus,
  A2ATaskState,
} from './types.js';
