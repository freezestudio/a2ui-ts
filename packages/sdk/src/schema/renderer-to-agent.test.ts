import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  A2uiClientActionMessageSchema,
  A2uiClientErrorMessageSchema,
  A2uiClientMessageSchema,
  A2uiClientCallAgentFunctionMessageSchema,
  A2uiRendererFunctionResponseMessageSchema,
  ValidationFailedErrorSchema,
  GenericErrorSchema,
  isClientActionMessage,
  isClientErrorMessage,
  isValidationFailedError,
  isCallAgentFunctionMessage,
  isRendererFunctionResponseMessage,
} from './renderer-to-agent.js';
import { SPEC_VERSION } from './constants.js';

// 合法动作消息工厂
function makeActionMessage(overrides = {}) {
  return {
    version: SPEC_VERSION,
    action: {
      name: 'click',
      surfaceId: 's1',
      sourceComponentId: 'btn1',
      timestamp: '2024-01-01T00:00:00Z',
      context: { key: 'value' },
    },
    ...overrides,
  };
}

// 合法错误消息工厂（ValidationFailed）
function makeValidationErrorMessage() {
  return {
    version: SPEC_VERSION,
    error: {
      code: 'VALIDATION_FAILED',
      surfaceId: 's1',
      path: '/email',
      message: '邮箱格式不正确',
    },
  };
}

// 合法通用错误消息工厂
function makeGenericErrorMessage() {
  return {
    version: SPEC_VERSION,
    error: {
      code: 'RENDER_ERROR',
      surfaceId: 's1',
      message: '渲染失败',
    },
  };
}

describe('renderer-to-agent', () => {
  // ==========================================================================
  // A2uiClientActionMessageSchema
  // ==========================================================================
  describe('A2uiClientActionMessageSchema', () => {
    it('应解析合法动作消息', () => {
      const msg = makeActionMessage();
      const result = A2uiClientActionMessageSchema.parse(msg);
      assert.equal(result.version, SPEC_VERSION);
      assert.equal(result.action.name, 'click');
      assert.equal(result.action.surfaceId, 's1');
      assert.equal(result.action.sourceComponentId, 'btn1');
      assert.equal(result.action.timestamp, '2024-01-01T00:00:00Z');
      assert.deepEqual(result.action.context, { key: 'value' });
    });

    it('应拒绝缺少必填字段', () => {
      const msg = makeActionMessage({
        action: { name: 'click', surfaceId: 's1' },
      });
      assert.throws(() => A2uiClientActionMessageSchema.parse(msg));
    });

    it('应拒绝错误版本号', () => {
      const msg = makeActionMessage({ version: 'v999' });
      assert.throws(() => A2uiClientActionMessageSchema.parse(msg));
    });

    it('应拒绝额外顶层字段（strict）', () => {
      const msg = { ...makeActionMessage(), extra: true };
      assert.throws(() => A2uiClientActionMessageSchema.parse(msg));
    });

    it('context 应接受空对象', () => {
      const msg = makeActionMessage({
        action: {
          name: 'ev',
          surfaceId: 's1',
          sourceComponentId: 'c1',
          timestamp: '2024-01-01T00:00:00Z',
          context: {},
        },
      });
      const result = A2uiClientActionMessageSchema.parse(msg);
      assert.deepEqual(result.action.context, {});
    });
  });

  // ==========================================================================
  // A2uiClientErrorMessageSchema — ValidationFailed
  // ==========================================================================
  describe('A2uiClientErrorMessageSchema - ValidationFailed', () => {
    it('应解析合法校验失败错误', () => {
      const msg = makeValidationErrorMessage();
      const result = A2uiClientErrorMessageSchema.parse(msg);
      assert.equal(result.error.code, 'VALIDATION_FAILED');
      assert.equal(result.error.surfaceId, 's1');
    });

    it('ValidationFailedErrorSchema 应拒绝缺少 path', () => {
      const err = { code: 'VALIDATION_FAILED', surfaceId: 's1', message: 'err' };
      assert.throws(() => ValidationFailedErrorSchema.parse(err));
    });

    it('ValidationFailedErrorSchema 应拒绝额外属性（strict）', () => {
      const err = {
        code: 'VALIDATION_FAILED',
        surfaceId: 's1',
        path: '/x',
        message: 'err',
        extra: 1,
      };
      assert.throws(() => ValidationFailedErrorSchema.parse(err));
    });

    it('应解析 UNALLOWED_PARENT 校验失败错误（v1.0 #2155）', () => {
      const err = { code: 'UNALLOWED_PARENT', surfaceId: 'main', path: '/components/1', message: 'x' };
      const result = ValidationFailedErrorSchema.parse(err);
      assert.equal(result.code, 'UNALLOWED_PARENT');
    });

    it('应解析 UNALLOWED_CHILD 校验失败错误（v1.0 #2155）', () => {
      const err = { code: 'UNALLOWED_CHILD', surfaceId: 'main', path: '/components/0', message: 'x' };
      const result = ValidationFailedErrorSchema.parse(err);
      assert.equal(result.code, 'UNALLOWED_CHILD');
    });

    it('应拒绝非校验码进入 ValidationFailed 分支（strict 枚举）', () => {
      const err = { code: 'FUNCTION_FAILED', surfaceId: 's1', path: '/x', message: 'x' };
      assert.throws(() => ValidationFailedErrorSchema.parse(err));
    });

    it('UNALLOWED_PARENT 错误消息应通过 A2uiClientErrorMessageSchema', () => {
      const msg = {
        version: SPEC_VERSION,
        error: { code: 'UNALLOWED_PARENT', surfaceId: 'main', path: '/c', message: 'x' },
      };
      const result = A2uiClientErrorMessageSchema.parse(msg);
      assert.equal(result.error.code, 'UNALLOWED_PARENT');
    });
  });

  // ==========================================================================
  // A2uiClientErrorMessageSchema — GenericError
  // ==========================================================================
  describe('A2uiClientErrorMessageSchema - GenericError', () => {
    it('应解析合法通用错误', () => {
      const msg = makeGenericErrorMessage();
      const result = A2uiClientErrorMessageSchema.parse(msg);
      assert.equal(result.error.code, 'RENDER_ERROR');
      assert.equal(result.error.surfaceId, 's1');
    });

    it('GenericError 应允许 functionCallId 代替 surfaceId', () => {
      const err = {
        code: 'RENDER_ERROR',
        functionCallId: 'call-1',
        message: '函数执行失败',
      };
      const result = GenericErrorSchema.parse(err);
      assert.equal(result.functionCallId, 'call-1');
    });

    it('GenericError 应拒绝同时包含 surfaceId 和 functionCallId', () => {
      const err = {
        code: 'RENDER_ERROR',
        surfaceId: 's1',
        functionCallId: 'call-1',
        message: 'err',
      };
      assert.throws(() => GenericErrorSchema.parse(err));
    });

    it('GenericError 应拒绝同时缺少 surfaceId 和 functionCallId', () => {
      const err = {
        code: 'RENDER_ERROR',
        message: 'err',
      };
      assert.throws(() => GenericErrorSchema.parse(err));
    });

    it('GenericErrorSchema 应允许额外属性（passthrough）', () => {
      const err = {
        code: 'CUSTOM',
        surfaceId: 's1',
        message: 'something',
        detail: { info: 'extra' },
      };
      const result = GenericErrorSchema.parse(err);
      assert.equal(result.code, 'CUSTOM');
    });

    it('GenericErrorSchema 应拒绝缺少 code', () => {
      assert.throws(() => GenericErrorSchema.parse({ surfaceId: 's1', message: 'm' }));
    });
  });

  // ==========================================================================
  // A2uiRendererFunctionResponseMessageSchema (v1.0 #2210 重构)
  // ==========================================================================
  describe('A2uiRendererFunctionResponseMessageSchema', () => {
    it('应解析合法函数响应消息（value）', () => {
      const msg = {
        version: SPEC_VERSION,
        rendererFunctionResponse: {
          functionCallId: 'call-1',
          value: 42,
        },
      };
      const result = A2uiRendererFunctionResponseMessageSchema.parse(msg);
      assert.equal(result.rendererFunctionResponse.functionCallId, 'call-1');
      assert.equal(result.rendererFunctionResponse.value, 42);
    });

    it('应解析带 error 的响应（#2210 FunctionResponse 支持 error）', () => {
      const msg = {
        version: SPEC_VERSION,
        rendererFunctionResponse: {
          functionCallId: 'call-1',
          error: { code: 'EXECUTION_FAILED', message: 'Service unavailable' },
        },
      };
      const result = A2uiRendererFunctionResponseMessageSchema.parse(msg);
      assert.equal((result.rendererFunctionResponse.error as { code: string }).code, 'EXECUTION_FAILED');
    });

    it('应拒绝缺少 functionCallId', () => {
      const msg = {
        version: SPEC_VERSION,
        rendererFunctionResponse: { value: 'ok' },
      };
      assert.throws(() => A2uiRendererFunctionResponseMessageSchema.parse(msg));
    });

    it('应拒绝错误版本号', () => {
      const msg = {
        version: 'v999',
        rendererFunctionResponse: { functionCallId: 'c1', value: null },
      };
      assert.throws(() => A2uiRendererFunctionResponseMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // A2uiClientCallAgentFunctionMessageSchema (v1.0 #2210 新增)
  // ==========================================================================
  describe('A2uiClientCallAgentFunctionMessageSchema', () => {
    it('应解析合法 callAgentFunction 消息', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: {
          surfaceId: 'surface_123',
          functionCallId: 'call-agent-1',
          callFunction: { call: 'pingAgent' },
        },
      };
      const result = A2uiClientCallAgentFunctionMessageSchema.parse(msg);
      assert.equal(result.callAgentFunction.surfaceId, 'surface_123');
      assert.equal(result.callAgentFunction.functionCallId, 'call-agent-1');
      assert.equal(result.callAgentFunction.callFunction.call, 'pingAgent');
    });

    it('应拒绝缺少 surfaceId', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: { functionCallId: 'c1', callFunction: { call: 'fn' } },
      };
      assert.throws(() => A2uiClientCallAgentFunctionMessageSchema.parse(msg));
    });

    it('应拒绝缺少 functionCallId', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: { surfaceId: 's1', callFunction: { call: 'fn' } },
      };
      assert.throws(() => A2uiClientCallAgentFunctionMessageSchema.parse(msg));
    });

    it('应拒绝缺少 callFunction', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: { surfaceId: 's1', functionCallId: 'c1' },
      };
      assert.throws(() => A2uiClientCallAgentFunctionMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // A2uiClientMessageSchema — 联合类型
  // ==========================================================================
  describe('A2uiClientMessageSchema', () => {
    it('应解析动作消息', () => {
      const result = A2uiClientMessageSchema.parse(makeActionMessage());
      assert.ok('action' in result);
    });

    it('应解析错误消息', () => {
      const result = A2uiClientMessageSchema.parse(makeValidationErrorMessage());
      assert.ok('error' in result);
    });

    it('应解析渲染端函数响应消息（v1.0 #2210）', () => {
      const msg = {
        version: SPEC_VERSION,
        rendererFunctionResponse: { functionCallId: 'c1', value: 'ok' },
      };
      const result = A2uiClientMessageSchema.parse(msg);
      assert.ok('rendererFunctionResponse' in result);
    });

    it('应解析 callAgentFunction 消息（v1.0 #2210）', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: { surfaceId: 's1', functionCallId: 'c1', callFunction: { call: 'fn' } },
      };
      const result = A2uiClientMessageSchema.parse(msg);
      assert.ok('callAgentFunction' in result);
    });

    it('应拒绝无法匹配的格式', () => {
      assert.throws(() => A2uiClientMessageSchema.parse({ version: SPEC_VERSION }));
    });
  });

  // ==========================================================================
  // 类型判断函数
  // ==========================================================================
  describe('isClientActionMessage', () => {
    it('动作消息应返回 true', () => {
      assert.equal(isClientActionMessage(makeActionMessage()), true);
    });

    it('错误消息应返回 false', () => {
      assert.equal(isClientActionMessage(makeValidationErrorMessage()), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isClientActionMessage(null), false);
    });

    it('字符串应返回 false', () => {
      assert.equal(isClientActionMessage('msg'), false);
    });
  });

  describe('isClientErrorMessage', () => {
    it('错误消息应返回 true', () => {
      assert.equal(isClientErrorMessage(makeValidationErrorMessage()), true);
    });

    it('通用错误消息应返回 true', () => {
      assert.equal(isClientErrorMessage(makeGenericErrorMessage()), true);
    });

    it('动作消息应返回 false', () => {
      assert.equal(isClientErrorMessage(makeActionMessage()), false);
    });

    it('undefined 应返回 false', () => {
      assert.equal(isClientErrorMessage(undefined), false);
    });
  });

  describe('isValidationFailedError', () => {
    it('VALIDATION_FAILED 错误应返回 true', () => {
      const err = { code: 'VALIDATION_FAILED', surfaceId: 's1', path: '/x', message: 'err' };
      assert.equal(isValidationFailedError(err), true);
    });

    it('通用错误应返回 false', () => {
      const err = { code: 'RENDER_ERROR', surfaceId: 's1', message: 'fail' };
      assert.equal(isValidationFailedError(err), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isValidationFailedError(null), false);
    });

    it('字符串应返回 false', () => {
      assert.equal(isValidationFailedError('err'), false);
    });

    it('缺少 code 应返回 false', () => {
      assert.equal(isValidationFailedError({ surfaceId: 's1' }), false);
    });
  });

  describe('isRendererFunctionResponseMessage', () => {
    it('函数响应消息应返回 true', () => {
      const msg = {
        version: SPEC_VERSION,
        rendererFunctionResponse: { functionCallId: 'c1', value: 'ok' },
      };
      assert.equal(isRendererFunctionResponseMessage(msg), true);
    });

    it('动作消息应返回 false', () => {
      assert.equal(isRendererFunctionResponseMessage(makeActionMessage()), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isRendererFunctionResponseMessage(null), false);
    });
  });

  describe('isCallAgentFunctionMessage', () => {
    it('callAgentFunction 消息应返回 true', () => {
      const msg = {
        version: SPEC_VERSION,
        callAgentFunction: { surfaceId: 's1', functionCallId: 'c1', callFunction: { call: 'fn' } },
      };
      assert.equal(isCallAgentFunctionMessage(msg), true);
    });

    it('动作消息应返回 false', () => {
      assert.equal(isCallAgentFunctionMessage(makeActionMessage()), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isCallAgentFunctionMessage(null), false);
    });
  });
});
