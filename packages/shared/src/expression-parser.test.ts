import { describe, it, expect } from 'vite-plus/test';
import { ExpressionParser } from './expression-parser.js';

describe('ExpressionParser', () => {
  describe('parse - 路径表达式', () => {
    it('解析简单路径', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('Hello ${user/name}');
      expect(result).toEqual(['Hello ', { path: 'user/name' }]);
    });

    it('解析多个路径', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${user/name} has ${count} items');
      expect(result).toEqual([{ path: 'user/name' }, ' has ', { path: 'count' }, ' items']);
    });

    it('解析嵌套路径', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${a/b/c/d}');
      expect(result).toEqual([{ path: 'a/b/c/d' }]);
    });
  });

  describe('parse - 函数调用', () => {
    it('解析简单函数调用', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${capitalize(value: name)}');
      expect(result).toEqual([{ call: 'capitalize', args: { value: { path: 'name' } }, returnType: 'any' }]);
    });

    it('解析多参数函数调用', () => {
      const parser = new ExpressionParser();
      const result = parser.parse("${formatDate(value: /date, format: 'yyyy-MM-dd')}");
      expect(result).toEqual([
        {
          call: 'formatDate',
          args: { value: { path: '/date' }, format: 'yyyy-MM-dd' },
          returnType: 'any',
        },
      ]);
    });

    it('解析嵌套函数调用', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${outer(inner: /value)}');
      expect(result).toEqual([
        {
          call: 'outer',
          args: { inner: { path: '/value' } },
          returnType: 'any',
        },
      ]);
    });
  });

  describe('parse - 字面量', () => {
    it('解析字符串字面量', () => {
      const parser = new ExpressionParser();
      const result = parser.parse("${'hello'}");
      expect(result).toEqual(['hello']);
    });

    it('解析数字字面量', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${42}');
      expect(result).toEqual([42]);
    });

    it('解析布尔字面量', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${true}');
      expect(result).toEqual([true]);
    });
  });

  describe('parse - 转义字符', () => {
    it('解析转义的 ${', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('Price: \\${100}');
      expect(result).toEqual(['Price: ', '${', '100}']);
    });

    it('混合转义和普通插值', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('\\${escaped} and ${real}');
      expect(result).toEqual(['${', 'escaped} and ', { path: 'real' }]);
    });
  });

  describe('parse - 嵌套插值', () => {
    it('解析嵌套插值', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('${${inner}}');
      expect(result).toEqual([{ path: 'inner' }]);
    });

    it('函数命名参数内嵌插值（v1.0 formatString 语法）', () => {
      const parser = new ExpressionParser();
      const result = parser.parse("${formatDate(value:${/currentDate}, format:'yyyy-MM-dd')}");
      expect(result).toEqual([
        {
          call: 'formatDate',
          args: {
            value: { path: '/currentDate' },
            format: 'yyyy-MM-dd',
          },
          returnType: 'any',
        },
      ]);
    });
  });

  describe('parse - 纯文本', () => {
    it('无插值时返回原文本', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('Hello World');
      expect(result).toEqual(['Hello World']);
    });

    it('空字符串返回空数组', () => {
      const parser = new ExpressionParser();
      const result = parser.parse('');
      expect(result).toEqual([]);
    });
  });

  describe('parse - 错误处理', () => {
    it('未闭合的插值抛出错误', () => {
      const parser = new ExpressionParser();
      expect(() => parser.parse('${unclosed')).toThrow('Unclosed interpolation');
    });
  });
});
