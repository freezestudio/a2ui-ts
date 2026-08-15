import { SurfaceManager, A2UIDescriptor, a2uIDescriptorSchema } from '../state/surface-manager.js';
import { z } from 'zod';
import { A2uiMessageSchema, validateComponentByType } from '../schema/schemas.js';
import { A2uiValidationError } from '../common/errors.js';
import { createRendererLogger } from '../common/logger.js';
const logger = createRendererLogger('message-handler');

const PENDING_MAX = 100;
const PENDING_TIMEOUT_MS = 30000;
const PENDING_BUFFER = new Map<string, unknown[]>();
const PENDING_TIMERS = new Map<string, ReturnType<typeof setTimeout>>();

export function clearAllPending(): void {
  for (const timer of PENDING_TIMERS.values()) clearTimeout(timer);
  PENDING_BUFFER.clear();
  PENDING_TIMERS.clear();
}

function enqueuePending(surfaceId: string, message: unknown): void {
  if (!PENDING_BUFFER.has(surfaceId)) {
    PENDING_BUFFER.set(surfaceId, []);
  }
  const buffer = PENDING_BUFFER.get(surfaceId)!;
  if (buffer.length < PENDING_MAX) buffer.push(message);

  const existing = PENDING_TIMERS.get(surfaceId);
  if (existing) clearTimeout(existing);
  PENDING_TIMERS.set(
    surfaceId,
    setTimeout(() => {
      PENDING_BUFFER.delete(surfaceId);
      PENDING_TIMERS.delete(surfaceId);
    }, PENDING_TIMEOUT_MS),
  );
}

function flushPending(surfaceId: string, surfaceManager: SurfaceManager): void {
  const timer = PENDING_TIMERS.get(surfaceId);
  if (timer) {
    clearTimeout(timer);
    PENDING_TIMERS.delete(surfaceId);
  }
  const buffer = PENDING_BUFFER.get(surfaceId);
  if (buffer && buffer.length > 0) {
    logger.debug('flush pending', { surfaceId, count: buffer.length });
    for (const msg of buffer) processMessage(msg as A2UIMessage, surfaceManager);
    PENDING_BUFFER.delete(surfaceId);
  }
}

// 仅 basic 官方 catalog；自定义 catalog（如行业扩展）由宿主应用解析
const KNOWN_CATALOGS = ['https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json'];

export type A2UIMessage = z.infer<typeof A2uiMessageSchema>;

export const looseMessageSchema = z.object({
  version: z.string().optional(),
  createSurface: z
    .object({
      surfaceId: z.string(),
      catalogId: z.string().optional(),
      surfaceProperties: z.record(z.string(), z.unknown()).optional(),
      sendDataModel: z.boolean().optional(),
      components: z.array(a2uIDescriptorSchema).optional(),
      dataModel: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  updateComponents: z.object({ surfaceId: z.string(), components: z.array(a2uIDescriptorSchema) }).optional(),
  updateDataModel: z.object({ surfaceId: z.string(), path: z.string().optional(), value: z.unknown() }).optional(),
  deleteSurface: z.object({ surfaceId: z.string() }).optional(),
  callRendererFunction: z
    .object({
      functionCallId: z.string(),
      callFunction: z.object({
        call: z.string(),
        catalogId: z.string(),
        args: z.record(z.string(), z.unknown()).optional(),
      }),
    })
    .optional(),
  agentFunctionResponse: z
    .object({
      functionCallId: z.string(),
      value: z.unknown().optional(),
      error: z.object({ code: z.string(), message: z.string() }).optional(),
    })
    .optional(),
});
type LooseMessage = z.infer<typeof looseMessageSchema>;

export function resolveCatalog(catalogId: string): string | undefined {
  if (KNOWN_CATALOGS.includes(catalogId)) return catalogId;
  return KNOWN_CATALOGS.find((k) => catalogId.startsWith(k));
}

export function validateComponents(components: A2UIDescriptor[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const comp of components) {
    if (!comp.id) {
      errors.push('组件缺少 id 字段');
      continue;
    }
    if (ids.has(comp.id)) {
      errors.push(`重复的组件 ID: "${comp.id}"`);
    }
    ids.add(comp.id);
    if (!comp.component) {
      errors.push(`组件 "${comp.id}" 缺少 component 类型`);
      continue;
    }
    // 按组件类型精确校验属性（对齐上游按 catalog schema safeParse）
    const result = validateComponentByType(comp as Record<string, unknown>, comp.component);
    if (!result.valid) {
      errors.push(...result.errors.map((e) => `[${comp.id}] ${e}`));
    }
  }
  return errors;
}

export function isValidMessage(msg: unknown): msg is A2UIMessage {
  return A2uiMessageSchema.safeParse(msg).success;
}

export function processMessage(
  message: LooseMessage,
  surfaceManager: SurfaceManager,
  onFunctionResponse?: (response: {
    functionCallId: string;
    value?: unknown;
    error?: { code: string; message: string };
  }) => void,
  renderer?: {
    sendError: (error: {
      code: string;
      message: string;
      surfaceId?: string;
      path?: string;
      functionCallId?: string;
    }) => void;
  },
): void {
  const msgType = message.createSurface
    ? 'createSurface'
    : message.updateComponents
      ? 'updateComponents'
      : message.updateDataModel
        ? 'updateDataModel'
        : message.deleteSurface
          ? 'deleteSurface'
          : message.callRendererFunction
            ? 'callRendererFunction'
            : message.agentFunctionResponse
              ? 'agentFunctionResponse'
              : 'unknown';

  const surfaceId =
    message.createSurface?.surfaceId ||
    message.updateComponents?.surfaceId ||
    message.updateDataModel?.surfaceId ||
    message.deleteSurface?.surfaceId;

  logger.debug('processMessage', { type: msgType, surfaceId });

  if (message.createSurface) {
    const cs = message.createSurface;
    logger.debug('createSurface', { surfaceId: cs.surfaceId, catalogId: cs.catalogId });
    surfaceManager.handleCreateSurface(cs.surfaceId, cs.catalogId, cs.surfaceProperties, cs.sendDataModel);
    flushPending(cs.surfaceId, surfaceManager);
    if (cs.components) {
      surfaceManager.handleUpdateComponents(cs.surfaceId, cs.components);
    }
    if (cs.dataModel) {
      surfaceManager.handleUpdateDataModel(cs.surfaceId, undefined, cs.dataModel);
    }
  } else if (message.updateComponents) {
    const uc = message.updateComponents;
    const surfaceExists = surfaceManager.surfaces.value.has(uc.surfaceId);
    if (!surfaceExists) {
      enqueuePending(uc.surfaceId, message);
      return;
    }
    const compErrors = validateComponents(uc.components || []);
    if (compErrors.length > 0) {
      renderer?.sendError(
        new A2uiValidationError(`组件校验失败: ${compErrors.map((e) => String(e)).join('; ')}`, {
          surfaceId: uc.surfaceId,
          path: '/components',
        }).toSendErrorPayload(),
      );
    }
    surfaceManager.handleUpdateComponents(uc.surfaceId, uc.components);
  } else if (message.updateDataModel) {
    const ud = message.updateDataModel;
    surfaceManager.handleUpdateDataModel(ud.surfaceId, ud.path, ud.value);
  } else if (message.deleteSurface) {
    surfaceManager.handleDeleteSurface(message.deleteSurface.surfaceId);
  } else if (message.callRendererFunction) {
    const crf = message.callRendererFunction;
    const callId = crf.functionCallId;
    if (callId) {
      surfaceManager.handleCallRendererFunction(
        {
          functionCallId: callId,
          call: crf.callFunction.call,
          args: crf.callFunction.args,
        },
        onFunctionResponse,
      );
    }
  } else if (message.agentFunctionResponse) {
    // agentFunctionResponse 是 agent 对 renderer 发起 callAgentFunction 的响应，
    // 由上层（renderer）按 functionCallId 路由到等待方；此处无操作。
    logger.debug('agentFunctionResponse 已接收', {
      functionCallId: message.agentFunctionResponse.functionCallId,
    });
  }
}
