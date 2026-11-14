/**
 * A2UI 渲染核心错误类型
 *
 * 对齐上游 web_core `errors.ts` 的错误体系与 v1.0 renderer→agent
 * error 消息结构（code + surfaceId + path），替代字符串拼接错误码。
 */

/** 结构化错误明细（RFC 6901 JSON Pointer 路径） */
export interface A2uiErrorDetail {
  path: string;
  message: string;
  code?: string;
}

/** RPC 生命周期错误码（对齐上游 web_core `RpcErrorCode`） */
export const RpcErrorCode = {
  INVALID_FUNCTION_CALL: 'INVALID_FUNCTION_CALL',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  CANCELLED: 'CANCELLED',
  DISPOSED: 'DISPOSED',
  DUPLICATE: 'DUPLICATE',
  NO_LISTENER: 'NO_LISTENER',
  TIMEOUT: 'TIMEOUT',
  TOO_MANY_PENDING: 'TOO_MANY_PENDING',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;
export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

/** 错误载荷（对齐 renderer_to_agent error 消息字段） */
export interface A2uiErrorPayload {
  code: string;
  message: string;
  surfaceId?: string;
  path?: string;
  functionCallId?: string;
  /** 结构化明细（校验类错误可选） */
  details?: A2uiErrorDetail[];
}

/** A2UI 渲染核心错误基类 */
export class A2uiError extends Error {
  readonly code: string;
  readonly surfaceId?: string;
  readonly path?: string;
  readonly functionCallId?: string;
  readonly details?: A2uiErrorDetail[];

  constructor(payload: A2uiErrorPayload) {
    super(payload.message);
    this.name = 'A2uiError';
    this.code = payload.code;
    this.surfaceId = payload.surfaceId;
    this.path = payload.path;
    this.functionCallId = payload.functionCallId;
    this.details = payload.details;
  }

  /** 转为 v1.0 标准校验错误消息（供 LLM 自纠） */
  toStandardMessage(): string {
    const parts = [this.code];
    if (this.surfaceId) parts.push(`surfaceId=${this.surfaceId}`);
    if (this.path) parts.push(`path=${this.path}`);
    if (this.functionCallId) parts.push(`functionCallId=${this.functionCallId}`);
    parts.push(this.message);
    return parts.join(' | ');
  }

  /** 转为 sendError 载荷 */
  toSendErrorPayload(): A2uiErrorPayload {
    return {
      code: this.code,
      message: this.message,
      surfaceId: this.surfaceId,
      path: this.path,
      functionCallId: this.functionCallId,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

/** 组件/消息校验失败（v1.0 标准错误码 VALIDATION_FAILED / UNALLOWED_PARENT / UNALLOWED_CHILD） */
export class A2uiValidationError extends A2uiError {
  constructor(
    message: string,
    options?: {
      surfaceId?: string;
      path?: string;
      functionCallId?: string;
      details?: A2uiErrorDetail[];
      code?: 'VALIDATION_FAILED' | 'UNALLOWED_PARENT' | 'UNALLOWED_CHILD';
    },
  ) {
    super({
      code: options?.code ?? 'VALIDATION_FAILED',
      message,
      surfaceId: options?.surfaceId,
      path: options?.path,
      functionCallId: options?.functionCallId,
      details: options?.details,
    });
    this.name = 'A2uiValidationError';
  }
}

/** 数据绑定/数据模型访问错误 */
export class A2uiDataError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string; functionCallId?: string }) {
    super({
      code: 'DATA_ERROR',
      message,
      surfaceId: options?.surfaceId,
      path: options?.path,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiDataError';
  }
}

/** 表达式求值错误 */
export class A2uiExpressionError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string; functionCallId?: string }) {
    super({
      code: 'EXPRESSION_ERROR',
      message,
      surfaceId: options?.surfaceId,
      path: options?.path,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiExpressionError';
  }
}

/** 状态（surface/组件生命周期）错误 */
export class A2uiStateError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string }) {
    super({ code: 'STATE_ERROR', message, surfaceId: options?.surfaceId, path: options?.path });
    this.name = 'A2uiStateError';
  }
}

/** 完整性错误（悬空引用、循环、状态不一致等） */
export class A2uiIntegrityError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string; functionCallId?: string }) {
    super({
      code: 'INTEGRITY_ERROR',
      message,
      surfaceId: options?.surfaceId,
      path: options?.path,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiIntegrityError';
  }
}

/** 递归/深度超限错误 */
export class A2uiRecursionError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string }) {
    super({ code: 'RECURSION_LIMIT_EXCEEDED', message, surfaceId: options?.surfaceId, path: options?.path });
    this.name = 'A2uiRecursionError';
  }
}

/** Catalog 解析错误 */
export class A2uiCatalogError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; path?: string; functionCallId?: string }) {
    super({
      code: 'CATALOG_NOT_FOUND',
      message,
      surfaceId: options?.surfaceId,
      path: options?.path,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiCatalogError';
  }
}

/** RPC 生命周期错误（callAgentFunction / callRendererFunction） */
export class A2uiRpcError extends A2uiError {
  constructor(
    message: string,
    code: string = RpcErrorCode.UNKNOWN_ERROR,
    functionCallId?: string,
    options?: { surfaceId?: string; path?: string; details?: A2uiErrorDetail[]; cause?: unknown },
  ) {
    super({
      code,
      message,
      functionCallId,
      surfaceId: options?.surfaceId,
      path: options?.path,
      details: options?.details,
    });
    this.name = 'A2uiRpcError';
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** 函数调用错误 */
export class A2uiFunctionError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; functionCallId?: string; code?: string }) {
    super({
      code: options?.code ?? 'FUNCTION_EXECUTION_ERROR',
      message,
      surfaceId: options?.surfaceId,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiFunctionError';
  }
}

/** 安全违规（requiresUserActivation 函数在无用户激活上下文时被调用） */
export class A2uiSecurityError extends A2uiError {
  constructor(message: string, options?: { surfaceId?: string; functionCallId?: string }) {
    super({
      code: 'SECURITY_VIOLATION',
      message,
      surfaceId: options?.surfaceId,
      functionCallId: options?.functionCallId,
    });
    this.name = 'A2uiSecurityError';
  }
}
