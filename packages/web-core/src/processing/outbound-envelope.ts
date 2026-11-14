/**
 * 统一出站消息信封（对齐上游 #4078 `unifiedOutbound`）
 *
 * 开启后 renderer 的 action / error / callAgentFunction / rendererFunctionResponse
 * 统一通过一个 outboundListener 发出，宿主只需注册一个发送回调。
 */

import type { ClientActionPayload } from '../schema/schemas.js';
import type { RendererErrorMessage } from './message-error-mapper.js';
import type { CallAgentFunctionEnvelope } from '../rpc/rpc-handler.js';

/** v1.0 rendererFunctionResponse 信封 */
export interface RendererFunctionResponseEnvelope {
  version: '1.0';
  rendererFunctionResponse: {
    functionCallId: string;
    value?: unknown;
    error?: { code: string; message: string };
  };
}

/** v1.0 action 信封 */
export interface OutboundActionMessage {
  version: '1.0';
  action: ClientActionPayload;
}

/** 统一出站消息联合 */
export type OutboundMessage =
  | CallAgentFunctionEnvelope
  | RendererFunctionResponseEnvelope
  | OutboundActionMessage
  | RendererErrorMessage;

/** 统一出站监听器 */
export type OutboundMessageListener = (message: OutboundMessage) => void | Promise<void>;

/**
 * 把 action 载荷包装为 v1.0 renderer→agent action 信封。
 */
export function toOutboundActionMessage(action: ClientActionPayload, version: '1.0' = '1.0'): OutboundActionMessage {
  return { version, action };
}

/** 把 rendererFunctionResponse 载荷包装为 v1.0 信封 */
export function toOutboundFunctionResponse(
  response: RendererFunctionResponseEnvelope['rendererFunctionResponse'],
): RendererFunctionResponseEnvelope {
  return { version: '1.0', rendererFunctionResponse: response };
}
