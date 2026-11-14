import { describe, it, expect } from 'vite-plus/test';
import { A2uiExpressionError, A2uiRpcError, A2uiValidationError, RpcErrorCode } from '../common/errors.js';
import {
  extractEnvelopeErrorContext,
  mapErrorToRendererMessage,
  normalizeJsonPointer,
} from './message-error-mapper.js';

describe('normalizeJsonPointer', () => {
  it('保留合法 JSON Pointer', () => {
    expect(normalizeJsonPointer('/components/0/text')).toBe('/components/0/text');
  });

  it('转换点号/数组下标并裁剪信封前缀', () => {
    expect(normalizeJsonPointer('updateComponents.components[0].text')).toBe('/components/0/text');
  });

  it('空路径返回 undefined', () => {
    expect(normalizeJsonPointer('')).toBeUndefined();
    expect(normalizeJsonPointer(undefined)).toBeUndefined();
  });
});

describe('extractEnvelopeErrorContext', () => {
  it('从 updateComponents 提取 surfaceId', () => {
    expect(extractEnvelopeErrorContext({ version: '1.0', updateComponents: { surfaceId: 's1' } })).toMatchObject({
      surfaceId: 's1',
      actionType: 'updateComponents',
      version: '1.0',
    });
  });

  it('从 callRendererFunction 提取 functionCallId', () => {
    expect(
      extractEnvelopeErrorContext({
        version: '1.0',
        callRendererFunction: { functionCallId: 'f1', surfaceId: 's1' },
      }),
    ).toMatchObject({ functionCallId: 'f1', surfaceId: 's1', isCallRendererFunction: true });
  });

  it('非对象返回 fallback 版本', () => {
    expect(extractEnvelopeErrorContext('nope')).toEqual({ version: '1.0' });
  });
});

describe('mapErrorToRendererMessage', () => {
  it('校验错误 → VALIDATION_FAILED + RFC 6901 path', () => {
    const mapped = mapErrorToRendererMessage(
      new A2uiValidationError('bad text', { surfaceId: 's1', path: 'updateComponents.components.0.text' }),
      { surfaceId: 's1', actionType: 'updateComponents' },
    );
    expect(mapped).toEqual({
      version: '1.0',
      error: { code: 'VALIDATION_FAILED', surfaceId: 's1', path: '/components/0/text', message: 'bad text' },
    });
  });

  it('缺省 path 补 /', () => {
    const mapped = mapErrorToRendererMessage(new A2uiValidationError('bad'), { surfaceId: 's1' });
    expect(mapped.error).toMatchObject({ code: 'VALIDATION_FAILED', path: '/' });
  });

  it('组合约束错误保留 UNALLOWED_PARENT/CHILD', () => {
    const mapped = mapErrorToRendererMessage(
      new A2uiValidationError('bad parent', { code: 'UNALLOWED_PARENT', surfaceId: 's1', path: '/comp' }),
    );
    expect(mapped.error).toMatchObject({ code: 'UNALLOWED_PARENT', path: '/comp' });
  });

  it('表达式错误 → EXPRESSION_ERROR', () => {
    const mapped = mapErrorToRendererMessage(
      new A2uiExpressionError('no binding', { surfaceId: 's1', path: '/components/0/text' }),
    );
    expect(mapped.error).toMatchObject({ code: 'EXPRESSION_ERROR', surfaceId: 's1' });
  });

  it('RPC 错误带 functionCallId', () => {
    const mapped = mapErrorToRendererMessage(new A2uiRpcError('timeout', RpcErrorCode.TIMEOUT, 'f1'), {
      isCallRendererFunction: true,
    });
    expect(mapped).toEqual({
      version: '1.0',
      error: { code: 'TIMEOUT', functionCallId: 'f1', message: 'timeout' },
    });
  });

  it('callRendererFunction 上下文的普通错误映射为 RPC 错误', () => {
    const mapped = mapErrorToRendererMessage(new Error('boom'), {
      actionType: 'callRendererFunction',
      functionCallId: 'f1',
    });
    expect(mapped.error).toEqual({
      code: RpcErrorCode.INVALID_FUNCTION_CALL,
      functionCallId: 'f1',
      message: 'boom',
    });
  });

  it('未知错误 → INTERNAL_ERROR', () => {
    const mapped = mapErrorToRendererMessage(new Error('boom'), { surfaceId: 's1' });
    expect(mapped.error).toMatchObject({ code: 'INTERNAL_ERROR', surfaceId: 's1', message: 'boom' });
  });
});
