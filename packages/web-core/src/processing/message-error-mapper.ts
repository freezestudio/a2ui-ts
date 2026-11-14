/**
 * Renderer→Agent 结构化错误映射（对齐上游 web_core #3579）
 *
 * 把内部 `A2uiError` / 未知异常映射为 v1.0 `renderer_to_agent.json#/$defs`
 * 中的 error 信封，并生成 RFC 6901 JSON Pointer 路径。
 */

import { z } from 'zod';
import {
  A2uiCatalogError,
  A2uiDataError,
  A2uiError,
  A2uiExpressionError,
  A2uiFunctionError,
  A2uiIntegrityError,
  A2uiRecursionError,
  A2uiRpcError,
  A2uiStateError,
  A2uiValidationError,
  RpcErrorCode,
} from '../common/errors.js';

/** 校验/组合约束失败的出站错误体 */
export interface ValidationFailedErrorBody {
  readonly code: 'VALIDATION_FAILED' | 'UNALLOWED_PARENT' | 'UNALLOWED_CHILD';
  readonly surfaceId: string;
  readonly path: string;
  readonly message: string;
  readonly functionCallId?: undefined;
}

/** 其他失败的出站错误体 */
export interface GenericErrorBody {
  readonly code: string;
  readonly message: string;
  readonly surfaceId?: string;
  readonly path?: string;
  readonly functionCallId?: string;
  readonly [key: string]: unknown;
}

/** 出站错误体联合 */
export type A2uiRendererError = ValidationFailedErrorBody | GenericErrorBody;

/** 出站 renderer→agent 错误消息信封（本仓库仅 v1.0） */
export interface RendererErrorMessage {
  readonly version: '1.0';
  readonly error: A2uiRendererError;
}

/** 顶层消息键（用于错误上下文与路径前缀裁剪） */
const ACTION_ENVELOPE_KEYS = [
  'createSurface',
  'updateComponents',
  'updateDataModel',
  'deleteSurface',
  'callRendererFunction',
  'agentFunctionResponse',
] as const;

/** 从原始消息提取的错误关联上下文 */
export interface ErrorEnvelopeContext {
  readonly surfaceId?: string;
  readonly functionCallId?: string;
  readonly actionType?: string;
  readonly isCallRendererFunction?: boolean;
  readonly version?: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 在 schema 校验前从原始消息提取 surfaceId / functionCallId / actionType / version。
 */
export function extractEnvelopeErrorContext(rawMessage: unknown, fallbackVersion = '1.0'): ErrorEnvelopeContext {
  if (!isPlainRecord(rawMessage)) {
    return { version: fallbackVersion };
  }

  const version = typeof rawMessage['version'] === 'string' ? rawMessage['version'] : fallbackVersion;
  const actionType = ACTION_ENVELOPE_KEYS.find((key) => Object.hasOwn(rawMessage, key));
  if (!actionType) {
    return { version };
  }

  const isCallRendererFunction = actionType === 'callRendererFunction';
  const payload = rawMessage[actionType];
  if (!isPlainRecord(payload)) {
    return { actionType, isCallRendererFunction, version };
  }

  return {
    surfaceId: typeof payload['surfaceId'] === 'string' ? payload['surfaceId'] : undefined,
    functionCallId: typeof payload['functionCallId'] === 'string' ? payload['functionCallId'] : undefined,
    actionType,
    isCallRendererFunction,
    version,
  };
}

function stripActionPrefix(segments: string[]): string[] {
  if (segments.length > 0 && (ACTION_ENVELOPE_KEYS as readonly string[]).includes(segments[0])) {
    return segments.slice(1);
  }
  return segments;
}

/**
 * 把原始路径规范化成 RFC 6901 JSON Pointer（如 `/components/0/text`），
 * 并裁掉消息信封前缀。
 */
export function normalizeJsonPointer(rawPath: string | undefined): string | undefined {
  if (!rawPath) return undefined;
  if (rawPath.startsWith('/')) return rawPath;
  const converted = rawPath
    .replace(/\[(\d+)\]/g, '/$1')
    .replace(/\./g, '/')
    .replace(/^\/+/, '');
  if (!converted) return '/';
  const segments = stripActionPrefix(converted.split('/').filter(Boolean));
  return segments.length > 0 ? `/${segments.join('/')}` : undefined;
}

function collectLeafZodIssues(issues: readonly z.ZodIssue[], actionType?: string): z.ZodIssue[] {
  const leaves: z.ZodIssue[] = [];
  for (const issue of issues) {
    if (issue.code === 'invalid_union' && 'unionErrors' in issue) {
      const unionIssues = (issue.unionErrors as z.ZodError[]).flatMap((u) => u.issues);
      leaves.push(...collectLeafZodIssues(unionIssues, actionType));
    } else {
      leaves.push(issue);
    }
  }
  if (!actionType) return leaves;
  const matching = leaves.filter((i) => i.path[0] === actionType && i.path.length > 1);
  return matching.length > 0 ? matching : leaves;
}

function extractPathFromZodDetails(details: unknown, actionType?: string): string | undefined {
  let issues: readonly z.ZodIssue[] | undefined;
  if (details instanceof z.ZodError) {
    issues = details.issues;
  } else if (Array.isArray(details) && details.length > 0) {
    const first = details[0] as Record<string, unknown>;
    if (typeof first?.['path'] === 'string') {
      return normalizeJsonPointer(first['path']);
    }
    if (Array.isArray(first?.['path'])) {
      issues = details as z.ZodIssue[];
    }
  }
  if (!issues || issues.length === 0) return undefined;

  const selected = collectLeafZodIssues(issues, actionType)[0];
  if (!selected) return undefined;
  const segments = selected.path.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1'));
  if (selected.code === 'unrecognized_keys' && 'keys' in selected && Array.isArray(selected.keys)) {
    const firstKey = selected.keys[0];
    if (firstKey !== undefined) segments.push(String(firstKey).replace(/~/g, '~0').replace(/\//g, '~1'));
  }
  const stripped = stripActionPrefix(segments);
  return stripped.length > 0 ? `/${stripped.join('/')}` : undefined;
}

function resolveErrorCode(err: unknown): string {
  if (err instanceof A2uiRecursionError) return 'RECURSION_LIMIT_EXCEEDED';
  if (err instanceof A2uiIntegrityError || err instanceof A2uiStateError) return 'INTEGRITY_ERROR';
  if (err instanceof A2uiCatalogError) return 'CATALOG_NOT_FOUND';
  if (err instanceof A2uiDataError) return 'DATA_ERROR';
  if (err instanceof A2uiExpressionError) return 'EXPRESSION_ERROR';
  if (err instanceof A2uiFunctionError) {
    return err.code === 'FUNCTION_EXECUTION_ERROR' ? 'EXECUTION_ERROR' : err.code;
  }
  if (err instanceof A2uiValidationError) {
    return err.code === 'UNALLOWED_PARENT' || err.code === 'UNALLOWED_CHILD' ? err.code : 'VALIDATION_FAILED';
  }
  if (err instanceof A2uiError) return err.code || 'INTERNAL_ERROR';
  return 'INTERNAL_ERROR';
}

/**
 * 把内部错误与消息上下文映射为规范要求的出站 `RendererErrorMessage`。
 */
export function mapErrorToRendererMessage(err: unknown, context: ErrorEnvelopeContext = {}): RendererErrorMessage {
  const a2uiErr = err instanceof A2uiError ? err : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const version = '1.0' as const;

  const functionCallId = a2uiErr?.functionCallId ?? context.functionCallId;
  const isRpcError =
    err instanceof A2uiRpcError ||
    context.isCallRendererFunction === true ||
    context.actionType === 'callRendererFunction' ||
    (functionCallId !== undefined && a2uiErr === undefined);

  if (isRpcError) {
    const rpcCode =
      err instanceof A2uiRpcError ? err.code : err instanceof A2uiError ? err.code : RpcErrorCode.INVALID_FUNCTION_CALL;
    if (functionCallId !== undefined) {
      return { version, error: { code: rpcCode, functionCallId, message } };
    }
    return {
      version,
      error: {
        code: rpcCode,
        surfaceId: a2uiErr?.surfaceId ?? context.surfaceId ?? '',
        message,
      },
    };
  }

  const code = resolveErrorCode(err);
  const surfaceId = a2uiErr?.surfaceId ?? context.surfaceId ?? '';
  let path = normalizeJsonPointer(
    a2uiErr?.path ??
      (err instanceof A2uiValidationError ? extractPathFromZodDetails(err.details, context.actionType) : undefined),
  );
  if (
    path === undefined &&
    (code === 'VALIDATION_FAILED' || code === 'UNALLOWED_PARENT' || code === 'UNALLOWED_CHILD')
  ) {
    path = '/';
  }

  return {
    version,
    error: {
      code,
      surfaceId,
      ...(path !== undefined ? { path } : {}),
      message,
    },
  };
}
