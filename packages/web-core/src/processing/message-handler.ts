import { SurfaceManager, A2UIDescriptor, a2uIDescriptorSchema } from '../state/surface-manager.js';
import { z } from 'zod';
import { A2uiMessageSchema, validateComponentByType } from '../schema/schemas.js';
import {
  UNALLOWED_CHILD,
  UNALLOWED_PARENT,
  checkCompositionConstraints,
  getConstraintResolver,
  type CompositionIssue,
} from '../schema/composition-constraints.js';
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

/** 结构化组件校验错误（code 为 v1.0 renderer→agent 标准错误码） */
export interface ComponentValidationIssue {
  code: 'VALIDATION_FAILED' | typeof UNALLOWED_PARENT | typeof UNALLOWED_CHILD;
  path: string;
  message: string;
}

/** 组件级校验（id/component 类型/属性 schema）→ VALIDATION_FAILED */
function validateComponentLevel(components: A2UIDescriptor[]): ComponentValidationIssue[] {
  const issues: ComponentValidationIssue[] = [];
  const ids = new Set<string>();
  for (const comp of components) {
    if (!comp.id) {
      issues.push({ code: 'VALIDATION_FAILED', path: '/', message: '组件缺少 id 字段' });
      continue;
    }
    if (ids.has(comp.id)) {
      issues.push({ code: 'VALIDATION_FAILED', path: comp.id, message: `重复的组件 ID: "${comp.id}"` });
    }
    ids.add(comp.id);
    if (!comp.component) {
      issues.push({ code: 'VALIDATION_FAILED', path: comp.id, message: `组件 "${comp.id}" 缺少 component 类型` });
      continue;
    }
    // 按组件类型精确校验属性（对齐上游按 catalog schema safeParse）
    const result = validateComponentByType(comp as Record<string, unknown>, comp.component);
    if (!result.valid) {
      issues.push(...result.errors.map((e) => ({ code: 'VALIDATION_FAILED' as const, path: comp.id, message: e })));
    }
  }
  return issues;
}

export function validateComponents(components: A2UIDescriptor[], catalogId?: string): string[] {
  return validateComponentsDetailed(components, catalogId).map((i) => `[${i.path}] ${i.code}: ${i.message}`);
}

/**
 * 结构化组件校验：组件级（VALIDATION_FAILED）+ 组合约束（UNALLOWED_PARENT/UNALLOWED_CHILD，v1.0 #2155）
 *
 * @param components - 组件列表（邻接表）
 * @param catalogId - surface 默认 catalogId（组合约束表按此解析；缺省不做限制）
 */
export function validateComponentsDetailed(
  components: A2UIDescriptor[],
  catalogId?: string,
): ComponentValidationIssue[] {
  const issues = validateComponentLevel(components);
  // 组件级已失败时不再做组合校验（父子关系可能不完整，避免噪音错误）
  if (issues.length > 0) return issues;

  const resolver = getConstraintResolver(catalogId);
  const compositionIssues: CompositionIssue[] = checkCompositionConstraints(components, resolver);
  return issues.concat(compositionIssues);
}

export function isValidMessage(msg: unknown): msg is A2UIMessage {
  return A2uiMessageSchema.safeParse(msg).success;
}

type SendErrorFn = NonNullable<Parameters<typeof processMessage>[3]>['sendError'];

/**
 * 发送组件校验错误：
 * - VALIDATION_FAILED → 聚合为一条（保持既有行为）
 * - UNALLOWED_PARENT / UNALLOWED_CHILD → 每条单独发送（v1.0 #2155 标准码，path 为违规组件 ID）
 */
function sendComponentIssues(
  renderer: { sendError: SendErrorFn } | undefined,
  surfaceId: string,
  issues: ComponentValidationIssue[],
): void {
  if (!renderer) return;
  for (const issue of issues) {
    if (issue.code === 'VALIDATION_FAILED') continue;
    renderer.sendError({ code: issue.code, message: issue.message, surfaceId, path: issue.path });
  }
  const validationFailed = issues.filter((i) => i.code === 'VALIDATION_FAILED');
  if (validationFailed.length > 0) {
    renderer.sendError(
      new A2uiValidationError(`组件校验失败: ${validationFailed.map((e) => `[${e.path}] ${e.message}`).join('; ')}`, {
        surfaceId,
        path: '/components',
      }).toSendErrorPayload(),
    );
  }
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
      const compErrors = validateComponentsDetailed(cs.components, cs.catalogId);
      if (compErrors.length > 0) {
        sendComponentIssues(renderer, cs.surfaceId, compErrors);
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
    const compErrors = validateComponentsDetailed(
      uc.components || [],
      surfaceManager.surfaces.value.get(uc.surfaceId)?.catalogId,
    );
    if (compErrors.length > 0) {
      sendComponentIssues(renderer, uc.surfaceId, compErrors);
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
