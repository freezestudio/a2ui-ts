import { describe, expect, it } from 'vite-plus/test';
import { fixPartialJsonFragment, CUTTABLE_KEYS } from '../src/json-healer.js';

describe('fixPartialJsonFragment', () => {
  it('补全未闭合的括号', () => {
    expect(fixPartialJsonFragment('{"a": 1')).toBe('{"a": 1}');
    expect(fixPartialJsonFragment('{"a": [1, 2')).toBe('{"a": [1, 2]}');
  });

  it('清理尾逗号', () => {
    expect(fixPartialJsonFragment('{"a": 1,')).toBe('{"a": 1}');
  });

  it('白名单键补全未闭合字符串', () => {
    expect(fixPartialJsonFragment('{"text": "hello')).toBe('{"text": "hello"}');
  });

  it('非白名单键拒绝补全字符串，返回空串', () => {
    expect(fixPartialJsonFragment('{"surfaceId": "abc')).toBe('');
  });

  it('URL 值拒绝补全字符串，返回空串', () => {
    expect(fixPartialJsonFragment('{"valueString": "https://ex')).toBe('');
  });

  it('data: 前缀 URL 拒绝补全', () => {
    expect(fixPartialJsonFragment('{"valueString": "data:image/png;base64,iVB')).toBe('');
  });

  it('以 / 开头的路径绑定拒绝补全', () => {
    expect(fixPartialJsonFragment('{"valueString": "/tilt/sensors')).toBe('');
  });

  it('data model 中 URL 类键拒绝补全', () => {
    expect(fixPartialJsonFragment('{"key": "imageUrl", "valueString": "https://ex')).toBe('');
  });

  it('转义字符不影响括号统计', () => {
    expect(fixPartialJsonFragment('{"text": "a\\"b"')).toBe('{"text": "a\\"b"}');
  });

  it('空输入返回空串', () => {
    expect(fixPartialJsonFragment('')).toBe('');
    expect(fixPartialJsonFragment('   ')).toBe('');
  });

  it('完整 JSON 原样返回', () => {
    expect(fixPartialJsonFragment('{"a": 1, "b": [2, 3]}')).toBe('{"a": 1, "b": [2, 3]}');
  });

  it('CUTTABLE_KEYS 包含协议文本键', () => {
    for (const key of ['text', 'label', 'hint', 'caption', 'altText', 'literalString', 'valueString']) {
      expect(CUTTABLE_KEYS.has(key)).toBe(true);
    }
  });
});
