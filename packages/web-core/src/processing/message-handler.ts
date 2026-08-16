import { SurfaceManager, A2UIDescriptor, a2uIDescriptorSchema } from '../state/surface-manager.js';
import { z } from 'zod';
import { A2uiMessageSchema, validateComponentByType } from '../schema/schemas.js';
import { A2uiValidationError } from '../common/errors.js';
import { createRendererLogger } from '../common/logger.js';
const logger = createRendererLogger('message-handler');

export function clearAllPending(): void {
  // v1.0 生命周期：updateComponents 必须先于 surface 创建；不再缓存乱序消息。
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
  return KNOWN_CATALOGS.find((k) => k === catalogId);
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
    const created = surfaceManager.handleCreateSurface(cs.surfaceId, cs.catalogId, cs.sendDataModel);
    if (!created) {
      renderer?.sendError({
        code: 'SURFACE_ALREADY_EXISTS',
        message: `Surface '${cs.surfaceId}' already exists. Delete it before recreating.`,
        surfaceId: cs.surfaceId,
      });
      return;
    }
    if (cs.components) {
      const compErrors = validateComponents(cs.components);
      if (compErrors.length > 0) {
        renderer?.sendError(
          new A2uiValidationError(`组件校验失败: ${compErrors.map((e) => String(e)).join('; ')}`, {
            surfaceId: cs.surfaceId,
            path: '/components',
          }).toSendErrorPayload(),
        );
      } else {
        surfaceManager.handleUpdateComponents(cs.surfaceId, cs.components);
      }
    }
    if (cs.dataModel) {
      surfaceManager.handleUpdateDataModel(cs.surfaceId, undefined, cs.dataModel);
    }
  } else if (message.updateComponents) {
    const uc = message.updateComponents;
    const surfaceExists = surfaceManager.surfaces.value.has(uc.surfaceId);
    if (!surfaceExists) {
      renderer?.sendError({
        code: 'SURFACE_NOT_FOUND',
        message: `Cannot update components on unknown surface '${uc.surfaceId}'.`,
        surfaceId: uc.surfaceId,
      });
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
      return;
    }
    surfaceManager.handleUpdateComponents(uc.surfaceId, uc.components);
  } else if (message.updateDataModel) {
    const ud = message.updateDataModel;
    if (!surfaceManager.surfaces.value.has(ud.surfaceId)) {
      renderer?.sendError({
        code: 'SURFACE_NOT_FOUND',
        message: `Cannot update data model on unknown surface '${ud.surfaceId}'.`,
        surfaceId: ud.surfaceId,
      });
      return;
    }
    surfaceManager.handleUpdateDataModel(ud.surfaceId, ud.path, ud.value);
  } else if (message.deleteSurface) {
    const removed = surfaceManager.handleDeleteSurface(message.deleteSurface.surfaceId);
    if (!removed) {
      renderer?.sendError({
        code: 'SURFACE_NOT_FOUND',
        message: `Cannot delete unknown surface '${message.deleteSurface.surfaceId}'.`,
        surfaceId: message.deleteSurface.surfaceId,
      });
    }
  } else if (message.callRendererFunction) {
    const crf = message.callRendererFunction;
    const callId = crf.functionCallId;
    if (callId) {
      surfaceManager.handleCallRendererFunction(
        {
          functionCallId: callId,
          call: crf.callFunction.call,
          catalogId: crf.callFunction.catalogId,
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
