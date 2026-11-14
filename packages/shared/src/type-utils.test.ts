import { describe, it, expect } from 'vite-plus/test';
import { toStr, toFloat, coerceDynamicBoolean, coerceValidationResult } from './type-utils.js';

describe('toStr', () => {
  it('null 转为空字符串', () => {
    expect(toStr(null)).toBe('');
  });

  it('undefined 转为空字符串', () => {
    expect(toStr(undefined)).toBe('');
  });

  it('对象转为 JSON', () => {
    expect(toStr({ a: 1 })).toBe('{"a":1}');
  });

  it('布尔值转为字符串', () => {
    expect(toStr(true)).toBe('true');
    expect(toStr(false)).toBe('false');
  });

  it('数字转为字符串', () => {
    expect(toStr(42)).toBe('42');
  });

  it('字符串保持不变', () => {
    expect(toStr('hello')).toBe('hello');
  });
});

describe('toFloat', () => {
  it('数字字符串转为数字', () => {
    expect(toFloat('42')).toBe(42);
    expect(toFloat('3.14')).toBe(3.14);
  });

  it('数字保持不变', () => {
    expect(toFloat(42)).toBe(42);
  });

  it('无效值抛出错误', () => {
    expect(() => toFloat('abc')).toThrow();
    expect(() => toFloat(null)).toThrow();
  });
});

describe('coerceDynamicBoolean（v1.0 强制转换表）', () => {
  it('boolean 原样返回', () => {
    expect(coerceDynamicBoolean(true)).toBe(true);
    expect(coerceDynamicBoolean(false)).toBe(false);
  });

  it('ValidationResult 读取 valid', () => {
    expect(coerceDynamicBoolean({ valid: true })).toBe(true);
    expect(coerceDynamicBoolean({ valid: false, message: 'x' })).toBe(false);
  });

  it('字符串 true/false（大小写不敏感）', () => {
    expect(coerceDynamicBoolean('true')).toBe(true);
    expect(coerceDynamicBoolean('TRUE')).toBe(true);
    expect(coerceDynamicBoolean('false')).toBe(false);
    expect(coerceDynamicBoolean('FALSE')).toBe(false);
    expect(coerceDynamicBoolean('')).toBe(false);
    expect(coerceDynamicBoolean('hello')).toBe(false);
  });

  it('数字 0 为 false，其他为 true', () => {
    expect(coerceDynamicBoolean(0)).toBe(false);
    expect(coerceDynamicBoolean(-1)).toBe(true);
    expect(coerceDynamicBoolean(1)).toBe(true);
  });

  it('null/undefined/数组/普通对象为 false', () => {
    expect(coerceDynamicBoolean(null)).toBe(false);
    expect(coerceDynamicBoolean(undefined)).toBe(false);
    expect(coerceDynamicBoolean([])).toBe(false);
    expect(coerceDynamicBoolean({})).toBe(false);
  });
});

describe('coerceValidationResult（CheckRule.condition）', () => {
  it('boolean 转为 ValidationResult', () => {
    expect(coerceValidationResult(true)).toEqual({ valid: true });
    expect(coerceValidationResult(false, '必填')).toEqual({
      valid: false,
      message: '必填',
      severity: 'error',
    });
  });

  it('ValidationResult 保留并补默认值', () => {
    expect(coerceValidationResult({ valid: false, code: 'X' }, '兜底')).toEqual({
      valid: false,
      code: 'X',
      message: '兜底',
      severity: 'error',
    });
    expect(coerceValidationResult({ valid: false, message: '自身', severity: 'warning' }, '兜底')).toEqual({
      valid: false,
      message: '自身',
      severity: 'warning',
    });
  });

  it('其他值按 DynamicBoolean 转换', () => {
    expect(coerceValidationResult('false', '兜底')).toEqual({
      valid: false,
      message: '兜底',
      severity: 'error',
    });
    expect(coerceValidationResult('true')).toEqual({ valid: true });
  });
});
