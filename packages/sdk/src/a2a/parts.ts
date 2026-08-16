/**
 * A2A Part 操作工具
 * 对应 A2UI v1.0 扩展规范
 */

import type { A2APart, A2ADataPart } from './types.js';
import { A2UI_MIME_TYPE } from '../schema/constants.js';
export { A2UI_MIME_TYPE };

/**
 * 创建 A2UI DataPart
 * v1.0: data 字段必须是消息数组
 */
export function createA2uiPart(data: unknown[]): A2ADataPart {
  if (!Array.isArray(data)) {
    throw new Error('A2UI DataPart.data 必须是消息数组');
  }
  return {
    content: {
      $case: 'data',
      value: data,
    },
    metadata: {
      mimeType: A2UI_MIME_TYPE,
    },
    mediaType: A2UI_MIME_TYPE,
  };
}

/** 检查 Part 是否为 A2UI DataPart */
export function isA2uiPart(part: unknown): part is A2ADataPart {
  if (!part || typeof part !== 'object') return false;
  const p = part as Record<string, unknown>;
  const content = p['content'] as { $case?: string } | undefined;
  const metadata = p['metadata'] as Record<string, unknown> | undefined;
  return content?.$case === 'data' && metadata?.['mimeType'] === A2UI_MIME_TYPE;
}

/** 从 A2A Parts 中提取所有 A2UI 数据 */
export function extractA2uiParts(parts: A2APart[]): unknown[] {
  return parts.filter(isA2uiPart).map((p) => (p as A2ADataPart).content.value);
}

/** 从 A2UI DataPart 提取数据 */
export function getA2uiData(part: A2ADataPart): unknown {
  return part.content.value;
}

/**
 * 将 A2UI 消息数组转换为 A2A Part
 * v1.0: 必须是数组格式
 */
export function a2uiMessagesToPart(messages: unknown[]): A2ADataPart {
  return createA2uiPart(messages);
}

/**
 * 从 A2A Part 提取 A2UI 消息数组
 * v1.0: 确保返回数组格式
 */
export function partToA2uiMessages(part: unknown): unknown[] | null {
  if (!isA2uiPart(part)) return null;
  const data = getA2uiData(part);
  return Array.isArray(data) ? data : null;
}
