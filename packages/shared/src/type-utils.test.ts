import { describe, it, expect } from 'vite-plus/test';
import { toStr, toFloat } from './type-utils.js';

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
