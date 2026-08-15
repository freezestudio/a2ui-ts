/**
 * A2UI Eval 校验器
 * 基于 @a2ui-ts/sdk 的消息校验 + 自定义业务规则
 *
 * 校验层次：
 * 1. 原始文本解析（提取 <a2ui-json> 标签中的 JSON）
 * 2. Zod 协议信封校验（A2uiMessageSchema）
 * 3. Surface 生命周期校验（create → update → delete 顺序）
 * 4. 组件完整性（root 存在、ID 唯一、引用完整）
 * 5. 函数调用名校验（对照 Catalog）
 * 6. 组件属性校验（AJV 对照 Catalog Schema）
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { A2uiValidator, A2uiMessageSchema, BasicCatalog } from '@a2ui-ts/sdk';
import type { GeneratedResult, ValidatedResult, ValidationResultError } from './types.js';
import type { A2uiMessage } from '@a2ui-ts/sdk';

// ============================================================================
// 内部工具
// ============================================================================

/** 规范化 Unicode 智能引号 */
function normalizeSmartQuotes(input: string): string {
  return input
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

/** 移除 JSON 中闭合括号前的尾部逗号 */
function removeTrailingCommas(input: string): string {
  return input.replace(/,(?=\s*[\]}])/g, '');
}

/** 解析 JSON，自动包装单对象为数组 */
function parseJsonOrWrap(input: string): unknown[] | null {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.debug('[A2uiValidator] JSON 解析失败:', err);
    return null;
  }
}

/** 从 LLM 原始输出中提取 A2UI JSON（带修复） */
function extractA2uiJson(rawText: string): unknown[] | null {
  const normalized = normalizeSmartQuotes(rawText);

  // 优先查找 <a2ui-json> 标签
  const tagStart = normalized.indexOf('<a2ui-json>');
  const tagEnd = normalized.indexOf('</a2ui-json>');
  if (tagStart !== -1 && tagEnd !== -1) {
    const jsonStr = normalized.slice(tagStart + '<a2ui-json>'.length, tagEnd).trim();
    let result = parseJsonOrWrap(jsonStr);
    if (!result) {
      result = parseJsonOrWrap(removeTrailingCommas(jsonStr));
    }
    return result;
  }

  // 回退：尝试匹配 JSON 数组
  const jsonMatch = normalized.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    let result = parseJsonOrWrap(jsonMatch[0]);
    if (!result) {
      result = parseJsonOrWrap(removeTrailingCommas(jsonMatch[0]));
    }
    return result;
  }
  return null;
}

/** 从消息中提取所有组件（兼容 createSurface 内联 + updateComponents） */
function extractAllComponents(messages: A2uiMessage[]): Array<{ msgIndex: number; components: unknown[] }> {
  const result: Array<{ msgIndex: number; components: unknown[] }> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Record<string, unknown>;
    const msgType = getMessageType(msg);

    let components: unknown[] | undefined;
    if (msgType === 'updateComponents') {
      const payload = msg.updateComponents as Record<string, unknown> | undefined;
      components = payload?.components as unknown[] | undefined;
    } else if (msgType === 'createSurface') {
      const payload = msg.createSurface as Record<string, unknown> | undefined;
      if (payload && Array.isArray(payload.components)) {
        components = payload.components;
      }
    }

    if (components) {
      result.push({ msgIndex: i, components });
    }
  }
  return result;
}

/** 判断消息类型 */
function getMessageType(msg: Record<string, unknown>): string {
  if ('createSurface' in msg) return 'createSurface';
  if ('updateComponents' in msg) return 'updateComponents';
  if ('updateDataModel' in msg) return 'updateDataModel';
  if ('deleteSurface' in msg) return 'deleteSurface';
  if ('callRendererFunction' in msg) return 'callRendererFunction';
  if ('agentFunctionResponse' in msg) return 'agentFunctionResponse';
  return 'unknown';
}

/** 获取消息中的 surfaceId */
function getSurfaceId(msg: Record<string, unknown>): string | undefined {
  for (const key of ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface']) {
    const payload = msg[key];
    if (payload && typeof payload === 'object') {
      const sid = (payload as Record<string, unknown>).surfaceId;
      if (typeof sid === 'string') return sid;
    }
  }
  return undefined;
}

// ============================================================================
// Validator
// ============================================================================

export class Validator {
  private sdkValidator: A2uiValidator;
  private ajv: Ajv;
  private catalogSchemas: Map<string, Record<string, unknown>> = new Map();

  constructor() {
    this.sdkValidator = new A2uiValidator();
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /** 加载 Catalog Schema 用于组件属性校验 */
  private async loadCatalogSchemas(): Promise<void> {
    if (this.catalogSchemas.size > 0) return;

    const catalog = BasicCatalog.getFullInstance();
    for (const [name, comp] of catalog.getComponents()) {
      this.catalogSchemas.set(name, comp.schema);
    }
  }

  /** 校验一组生成结果 */
  async run(results: GeneratedResult[]): Promise<ValidatedResult[]> {
    await this.loadCatalogSchemas();

    const validated: ValidatedResult[] = [];
    for (const result of results) {
      validated.push(await this.validateSingle(result));
    }
    return validated;
  }

  /** 校验单条生成结果 */
  private async validateSingle(result: GeneratedResult): Promise<ValidatedResult> {
    const errors: ValidationResultError[] = [];

    // 1. 解析原始文本
    const messages = extractA2uiJson(result.rawText);
    if (!messages) {
      errors.push({
        path: '',
        message: '无法从输出中解析出 A2UI JSON 消息数组',
      });
      return { ...result, validationErrors: errors };
    }

    // 更新 result 的 components
    const enrichedResult = { ...result, components: messages };

    // 2. Zod 信封校验
    for (let i = 0; i < messages.length; i++) {
      const parseResult = A2uiMessageSchema.safeParse(messages[i]);
      if (!parseResult.success) {
        for (const issue of parseResult.error.issues) {
          errors.push({
            path: `[${i}]${issue.path.length ? '.' + issue.path.join('.') : ''}`,
            message: issue.message,
          });
        }
      }
    }

    // 3. Surface 生命周期校验
    errors.push(...this.validateSurfaceLifecycle(messages as A2uiMessage[]));

    // 4. 组件完整性校验（含 createSurface 内联组件）
    errors.push(...this.validateComponentsIntegrity(messages as A2uiMessage[]));

    // 5. 函数调用名校验（组件内 + callRendererFunction 消息）
    errors.push(...this.validateFunctionNames(messages as A2uiMessage[]));

    // 6. 数据绑定路径校验
    errors.push(...this.validateDataBindings(messages as A2uiMessage[]));

    // 7. Action 结构校验
    errors.push(...this.validateActions(messages as A2uiMessage[]));

    // 8. callRendererFunction 消息校验（v1.0 #2210）
    errors.push(...this.validateCallRendererFunctionMessages(messages as A2uiMessage[]));

    // 9. agentFunctionResponse 消息校验（v1.0 #2210）
    errors.push(...this.validateAgentFunctionResponseMessages(messages as A2uiMessage[]));

    // 10. 组件属性 AJV 校验
    const schemaErrors = await this.validateComponentSchemas(messages as A2uiMessage[]);
    errors.push(...schemaErrors);

    return { ...enrichedResult, validationErrors: errors };
  }

  /** Surface 生命周期校验 */
  private validateSurfaceLifecycle(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];
    const createdSurfaces = new Set<string>();
    const deletedSurfaces = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as Record<string, unknown>;
      const type = getMessageType(msg);
      const surfaceId = getSurfaceId(msg);

      if (!surfaceId) continue;

      switch (type) {
        case 'createSurface': {
          if (createdSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].createSurface`,
              message: `Surface "${surfaceId}" 重复创建`,
            });
          }
          if (deletedSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].createSurface`,
              message: `Surface "${surfaceId}" 已被删除后重新创建`,
            });
          }
          createdSurfaces.add(surfaceId);
          break;
        }
        case 'updateComponents':
        case 'updateDataModel': {
          if (!createdSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].${type}`,
              message: `Surface "${surfaceId}" 尚未创建就执行了 ${type}`,
            });
          }
          if (deletedSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].${type}`,
              message: `Surface "${surfaceId}" 已被删除后执行了 ${type}`,
            });
          }
          break;
        }
        case 'deleteSurface': {
          if (!createdSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].deleteSurface`,
              message: `Surface "${surfaceId}" 尚未创建就被删除`,
            });
          }
          if (deletedSurfaces.has(surfaceId)) {
            errors.push({
              path: `[${i}].deleteSurface`,
              message: `Surface "${surfaceId}" 重复删除`,
            });
          }
          deletedSurfaces.add(surfaceId);
          break;
        }
      }
    }
    return errors;
  }

  /** 组件完整性校验（兼容 createSurface 内联 + updateComponents） */
  private validateComponentsIntegrity(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];

    for (const { msgIndex, components } of extractAllComponents(messages)) {
      // 使用 SDK 的校验器做完整性检查
      this.invokeSdkValidation(messages[msgIndex], msgIndex, errors);

      // 额外的重复 ID 检测
      this.checkDuplicateComponentIds(components as Array<Record<string, unknown>>, msgIndex, errors);

      // 引用完整性检测
      this.checkReferenceIntegrity(components as Array<Record<string, unknown>>, msgIndex, errors);
    }

    return errors;
  }

  /** 调用 SDK 校验器（兼容 createSurface 内联 + updateComponents） */
  private invokeSdkValidation(msg: Record<string, unknown>, msgIndex: number, errors: ValidationResultError[]): void {
    const msgType = getMessageType(msg);
    // SDK 的 validateComponents 只接受 updateComponents 格式
    // createSurface 消息需要包装为 updateComponents 结构
    const wrappedMsg =
      msgType === 'createSurface' ? { updateComponents: (msg as Record<string, unknown>).createSurface } : msg;
    const sdkResult = this.sdkValidator.validateComponents(
      wrappedMsg as Parameters<typeof this.sdkValidator.validateComponents>[0],
    );
    for (const err of sdkResult.errors) {
      errors.push({
        path: `[${msgIndex}]${err.path ? '.' + err.path : ''}`,
        message: err.message,
      });
    }
  }

  /** 检测重复组件 ID */
  private checkDuplicateComponentIds(
    components: Array<Record<string, unknown>>,
    msgIndex: number,
    errors: ValidationResultError[],
  ): void {
    const idSet = new Set<string>();
    for (const comp of components) {
      const id = comp.id;
      if (typeof id !== 'string') continue;
      if (idSet.has(id)) {
        errors.push({
          path: `[${msgIndex}].updateComponents.components.${id}`,
          message: `组件 ID "${id}" 重复`,
        });
      }
      idSet.add(id);
    }
  }

  /** 引用完整性检测 */
  private checkReferenceIntegrity(
    components: Array<Record<string, unknown>>,
    msgIndex: number,
    errors: ValidationResultError[],
  ): void {
    const componentIds = new Set<string>();
    for (const comp of components) {
      if (typeof comp.id === 'string') {
        componentIds.add(comp.id);
      }
    }

    for (const comp of components) {
      const id = comp.id;
      if (typeof id !== 'string') continue;

      const childRefs = this.extractChildRefs(comp);
      for (const refId of childRefs) {
        if (!componentIds.has(refId)) {
          errors.push({
            path: `[${msgIndex}].updateComponents.components.${id}`,
            message: `组件 "${id}" 引用了不存在的子组件 "${refId}"`,
          });
        }
      }
    }
  }

  /** 提取组件中的子组件引用 */
  private extractChildRefs(comp: Record<string, unknown>): string[] {
    const refs: string[] = [];
    for (const [key, value] of Object.entries(comp)) {
      if (key === 'id' || key === 'component') continue;
      if (key === 'children' && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') refs.push(item);
        }
      } else if (typeof value === 'object' && value !== null && 'componentId' in value) {
        const cid = (value as Record<string, unknown>).componentId;
        if (typeof cid === 'string') refs.push(cid);
      }
    }
    return refs;
  }

  /** 函数调用名校验（组件内 + callRendererFunction 消息） */
  private validateFunctionNames(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];
    const catalog = BasicCatalog.getFullInstance();
    const validFunctions = new Set(catalog.getFunctionNames().map((n) => n.toLowerCase()));

    // 校验组件中的函数调用
    for (const { msgIndex, components } of extractAllComponents(messages)) {
      for (const comp of components as Array<Record<string, unknown>>) {
        const compId = comp.id;
        if (typeof compId !== 'string') continue;

        this.walkForFunctionCalls(comp, (funcName, fieldPath) => {
          if (!validFunctions.has(funcName.toLowerCase())) {
            errors.push({
              path: `[${msgIndex}].components.${compId}.${fieldPath}`,
              message: `未知函数调用: "${funcName}"`,
            });
          }
        });
      }
    }

    // 校验 callRendererFunction 消息（v1.0 #2210）
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as Record<string, unknown>;
      if (getMessageType(msg) !== 'callRendererFunction') continue;

      const crf = msg.callRendererFunction as Record<string, unknown> | undefined;
      const callFn = crf?.callFunction as Record<string, unknown> | undefined;
      const fnName = callFn?.call as string | undefined;
      if (fnName && !validFunctions.has(fnName.toLowerCase())) {
        errors.push({
          path: `[${i}].callRendererFunction.callFunction.call`,
          message: `callRendererFunction 调用了未知函数: "${fnName}"`,
        });
      }
    }

    return errors;
  }

  /** 递归遍历组件属性，查找函数调用 */
  private walkForFunctionCalls(
    obj: Record<string, unknown>,
    callback: (funcName: string, path: string) => void,
    pathPrefix = '',
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id' || key === 'component') continue;
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        'call' in value &&
        typeof (value as Record<string, unknown>).call === 'string'
      ) {
        callback((value as Record<string, unknown>).call as string, currentPath);
        const args = (value as Record<string, unknown>).args;
        if (typeof args === 'object' && args !== null) {
          this.walkForFunctionCalls(args as Record<string, unknown>, callback, `${currentPath}.args`);
        }
      } else if (Array.isArray(value)) {
        for (let idx = 0; idx < value.length; idx++) {
          const item = value[idx];
          if (typeof item === 'object' && item !== null) {
            this.walkForFunctionCalls(item as Record<string, unknown>, callback, `${currentPath}[${idx}]`);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        this.walkForFunctionCalls(value as Record<string, unknown>, callback, currentPath);
      }
    }
  }

  /** 校验 JSON Pointer 是否合法（RFC 6901） */
  private isValidJsonPointer(path: string): boolean {
    if (path === '') return true;
    if (!path.startsWith('/')) return false;
    if (path === '/') return true;
    // 每个 segment 不能为空（不能有连续的 /）
    const segments = path.slice(1).split('/');
    return segments.every((s) => s.length > 0 || s === '');
  }

  /** callRendererFunction 消息结构校验（v1.0 #2210） */
  private validateCallRendererFunctionMessages(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as Record<string, unknown>;
      if (getMessageType(msg) !== 'callRendererFunction') continue;

      const crf = msg.callRendererFunction as Record<string, unknown> | undefined;
      if (!crf) {
        errors.push({ path: `[${i}].callRendererFunction`, message: 'callRendererFunction 消息缺少负载' });
        continue;
      }

      const callFn = crf.callFunction as Record<string, unknown> | undefined;
      if (!callFn) {
        errors.push({
          path: `[${i}].callRendererFunction.callFunction`,
          message: 'callRendererFunction 缺少 callFunction 负载',
        });
        continue;
      }

      if (typeof callFn.call !== 'string') {
        errors.push({
          path: `[${i}].callRendererFunction.callFunction.call`,
          message: 'callFunction.call 必须是字符串',
        });
      }

      if (typeof callFn.catalogId !== 'string') {
        errors.push({
          path: `[${i}].callRendererFunction.callFunction.catalogId`,
          message: 'callFunction.catalogId 必须是字符串（v1.0 #2210 必填）',
        });
      }

      if (typeof crf.functionCallId !== 'string') {
        errors.push({
          path: `[${i}].callRendererFunction.functionCallId`,
          message: 'callRendererFunction 消息缺少 functionCallId',
        });
      }
    }

    return errors;
  }

  /** agentFunctionResponse 消息结构校验（v1.0 #2210） */
  private validateAgentFunctionResponseMessages(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as Record<string, unknown>;
      if (getMessageType(msg) !== 'agentFunctionResponse') continue;

      const ar = msg.agentFunctionResponse as Record<string, unknown> | undefined;
      if (!ar) {
        errors.push({ path: `[${i}].agentFunctionResponse`, message: 'agentFunctionResponse 消息缺少负载' });
        continue;
      }

      if (typeof ar.functionCallId !== 'string') {
        errors.push({
          path: `[${i}].agentFunctionResponse.functionCallId`,
          message: 'agentFunctionResponse 缺少 functionCallId',
        });
      }

      const hasValue = 'value' in ar;
      const hasError = 'error' in ar;
      if (!hasValue && !hasError) {
        errors.push({ path: `[${i}].agentFunctionResponse`, message: 'agentFunctionResponse 必须包含 value 或 error' });
      }

      if (hasError) {
        const errObj = ar.error as Record<string, unknown> | undefined;
        if (!errObj || typeof errObj.code !== 'string' || typeof errObj.message !== 'string') {
          errors.push({
            path: `[${i}].agentFunctionResponse.error`,
            message: 'agentFunctionResponse.error 必须包含 code 和 message',
          });
        }
      }
    }

    return errors;
  }

  /** 数据绑定路径校验（JSON Pointer RFC 6901） */
  private validateDataBindings(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];

    for (const { msgIndex, components } of extractAllComponents(messages)) {
      for (const comp of components as Array<Record<string, unknown>>) {
        this.walkForDataBindings(comp, (bindingPath, fieldPath, compId) => {
          if (!this.isValidJsonPointer(bindingPath)) {
            errors.push({
              path: `[${msgIndex}].components.${compId}.${fieldPath}`,
              message: `无效的数据绑定路径: "${bindingPath}"（必须符合 RFC 6901 JSON Pointer）`,
            });
          }
        });
      }
    }

    return errors;
  }

  /** 递归遍历组件属性，查找 DataBinding（{ path: string } 结构） */
  private walkForDataBindings(
    obj: Record<string, unknown>,
    callback: (path: string, fieldPath: string, compId: string) => void,
    pathPrefix = '',
    compId?: string,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id' && typeof value === 'string') {
        compId = value;
        continue;
      }
      if (key === 'component') continue;

      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        'path' in value &&
        typeof (value as Record<string, unknown>).path === 'string'
      ) {
        callback((value as Record<string, unknown>).path as string, currentPath, compId ?? '?');
      } else if (Array.isArray(value)) {
        for (let idx = 0; idx < value.length; idx++) {
          const item = value[idx];
          if (typeof item === 'object' && item !== null) {
            this.walkForDataBindings(item as Record<string, unknown>, callback, `${currentPath}[${idx}]`, compId);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        this.walkForDataBindings(value as Record<string, unknown>, callback, currentPath, compId);
      }
    }
  }

  /** Action 结构校验 */
  private validateActions(messages: A2uiMessage[]): ValidationResultError[] {
    const errors: ValidationResultError[] = [];

    for (const { msgIndex, components } of extractAllComponents(messages)) {
      for (const comp of components as Array<Record<string, unknown>>) {
        this.walkForActions(comp, (action, fieldPath) => {
          const hasEvent = typeof action.event === 'object' && action.event !== null;
          const hasFunctionCall = typeof action.functionCall === 'object' && action.functionCall !== null;

          if (!hasEvent && !hasFunctionCall) {
            errors.push({
              path: `[${msgIndex}].components.${comp.id != null ? String(comp.id as string) : '?'}.${fieldPath}`,
              message: 'Action 必须包含 event 或 functionCall',
            });
            return;
          }

          if (hasEvent) {
            const event = action.event as Record<string, unknown>;
            if (typeof event.name !== 'string' || event.name.length === 0) {
              errors.push({
                path: `[${msgIndex}].components.${String((comp.id as string) ?? '?')}.${fieldPath}.event.name`,
                message: 'Action.event.name 必须是字符串且不为空',
              });
            }
          }

          if (hasFunctionCall) {
            const fc = action.functionCall as Record<string, unknown>;
            if (typeof fc.call !== 'string') {
              errors.push({
                path: `[${msgIndex}].components.${String((comp.id as string) ?? '?')}.${fieldPath}.functionCall.call`,
                message: 'Action.functionCall.call 必须是字符串',
              });
            }
          }
        });
      }
    }

    return errors;
  }

  /** 递归遍历组件，查找 Action 对象 */
  private walkForActions(
    obj: Record<string, unknown>,
    callback: (action: Record<string, unknown>, path: string) => void,
    pathPrefix = '',
  ): void {
    const action = obj.action;
    if (typeof action === 'object' && action !== null && !Array.isArray(action)) {
      callback(action as Record<string, unknown>, pathPrefix ? `${pathPrefix}.action` : 'action');
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key === 'id' || key === 'component' || key === 'action') continue;
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      if (Array.isArray(value)) {
        for (let idx = 0; idx < value.length; idx++) {
          const item = value[idx];
          if (typeof item === 'object' && item !== null) {
            this.walkForActions(item as Record<string, unknown>, callback, `${currentPath}[${idx}]`);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        this.walkForActions(value as Record<string, unknown>, callback, currentPath);
      }
    }
  }

  /** 组件属性 AJV Schema 校验（兼容 createSurface 内联 + updateComponents） */
  private async validateComponentSchemas(messages: A2uiMessage[]): Promise<ValidationResultError[]> {
    const errors: ValidationResultError[] = [];

    for (const { msgIndex, components } of extractAllComponents(messages)) {
      for (const comp of components as Array<Record<string, unknown>>) {
        const compType = comp.component;
        if (typeof compType !== 'string') continue;

        const schema = this.catalogSchemas.get(compType);
        if (!schema) continue;

        const compId = typeof comp.id === 'string' ? comp.id : '?';

        try {
          const validate = this.ajv.compile(schema);
          const valid = validate(comp);
          if (!valid && validate.errors) {
            for (const ajvErr of validate.errors) {
              errors.push({
                path: `[${msgIndex}].components.${compId}.${ajvErr.instancePath || ''}`,
                message: `${ajvErr.message ?? 'Schema 校验失败'} (${ajvErr.keyword})`,
              });
            }
          }
        } catch (err) {
          console.warn('[A2uiValidator] Schema 编译失败，跳过:', err);
        }
      }
    }

    return errors;
  }
}
