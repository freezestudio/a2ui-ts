import { describe, it, expect, vi } from 'vite-plus/test';
import { evaluateExpression } from './evaluate.js';

describe('evaluateExpression', () => {
  describe('路径替换', () => {
    it('替换简单路径', () => {
      const result = evaluateExpression('Hello ${user/name}', {
        user: { name: 'Alice' },
      });
      expect(result).toBe('Hello Alice');
    });

    it('替换多个路径', () => {
      const result = evaluateExpression('${user/name} has ${count} items', {
        user: { name: 'Bob' },
        count: 5,
      });
      expect(result).toBe('Bob has 5 items');
    });

    it('路径不存在返回空字符串', () => {
      const result = evaluateExpression('Value: ${missing}', {});
      expect(result).toBe('Value: ');
    });
  });

  describe('函数调用', () => {
    it('调用函数并替换结果', () => {
      const callFunction = vi.fn((fn, _ctx) => {
        if (fn.call === 'capitalize') {
          return 'Alice';
        }
        return '';
      });

      const result = evaluateExpression('Hello ${capitalize(value: name)}', { name: 'alice' }, { callFunction });
      expect(result).toBe('Hello Alice');
      expect(callFunction).toHaveBeenCalledWith(expect.objectContaining({ call: 'capitalize' }), expect.any(Object));
    });
  });

  describe('字面量', () => {
    it('字符串字面量', () => {
      const result = evaluateExpression("Value: ${'hello'}", {});
      expect(result).toBe('Value: hello');
    });

    it('数字字面量', () => {
      const result = evaluateExpression('Count: ${42}', {});
      expect(result).toBe('Count: 42');
    });
  });

  describe('转义字符', () => {
    it('转义的 ${ 不被替换', () => {
      const result = evaluateExpression('Price: \\${100}', {});
      expect(result).toBe('Price: ${100}');
    });
  });

  describe('错误处理', () => {
    it('strict 模式下解析错误抛出异常', () => {
      expect(() => evaluateExpression('${unclosed', {}, { strict: true })).toThrow();
    });

    it('non-strict 模式下解析错误返回原始字符串', () => {
      const result = evaluateExpression('${unclosed', {}, { strict: false });
      expect(result).toBe('${unclosed');
    });
  });

  describe('纯文本', () => {
    it('无插值时返回原文本', () => {
      const result = evaluateExpression('Hello World', {});
      expect(result).toBe('Hello World');
    });

    it('空字符串返回空字符串', () => {
      const result = evaluateExpression('', {});
      expect(result).toBe('');
    });
  });
});
