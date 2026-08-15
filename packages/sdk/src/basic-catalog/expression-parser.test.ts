import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { ExpressionParser } from './expression-parser.js';

describe('ExpressionParser', () => {
  const parser = new ExpressionParser();

  // ==========================================================================
  // parse 方法 — 基本场景
  // ==========================================================================
  describe('parse', () => {
    it('空字符串应返回空数组', () => {
      assert.deepEqual(parser.parse(''), []);
    });

    it('无插值的纯文本应返回 [text]', () => {
      assert.deepEqual(parser.parse('hello world'), ['hello world']);
    });

    it('简单路径 ${user/name}', () => {
      const result = parser.parse('${user/name}');
      assert.deepEqual(result, [{ path: 'user/name' }]);
    });

    it("字面量字符串 ${'hello'}", () => {
      const result = parser.parse("${'hello'}");
      assert.deepEqual(result, ['hello']);
    });

    it('字面量数字 ${42}', () => {
      const result = parser.parse('${42}');
      assert.deepEqual(result, [42]);
    });

    it('浮点数字面量 ${3.14}', () => {
      const result = parser.parse('${3.14}');
      assert.deepEqual(result, [3.14]);
    });

    it('负数字面量 ${-42}', () => {
      const result = parser.parse('${-42}');
      assert.deepEqual(result, [-42]);
    });

    it('字面量布尔 ${true}', () => {
      const result = parser.parse('${true}');
      assert.deepEqual(result, [true]);
    });

    it('字面量布尔 ${false}', () => {
      const result = parser.parse('${false}');
      assert.deepEqual(result, [false]);
    });

    it('字面量 null ${null} 应被过滤为空数组', () => {
      const result = parser.parse('${null}');
      assert.deepEqual(result, []);
    });

    it('混合文本和插值', () => {
      const result = parser.parse('Hello ${user/name}!');
      assert.deepEqual(result, ['Hello ', { path: 'user/name' }, '!']);
    });

    it('多个插值', () => {
      const result = parser.parse('${a} and ${b}');
      assert.deepEqual(result, [{ path: 'a' }, ' and ', { path: 'b' }]);
    });

    it('转义的 \\${literal} 应输出 ${literal}', () => {
      const result = parser.parse('\\${literal}');
      assert.deepEqual(result, ['${', 'literal}']);
    });

    it('函数调用', () => {
      const result = parser.parse('${formatString(template: "Hello", name: user/name)}');
      assert.equal(result.length, 1);
      const call = result[0] as { call: string; args: Record<string, unknown>; returnType: string };
      assert.equal(call.call, 'formatString');
      assert.equal(call.returnType, 'any');
      assert.deepEqual(call.args.template, 'Hello');
      assert.deepEqual(call.args.name, { path: 'user/name' });
    });

    it('嵌套函数调用', () => {
      const result = parser.parse('${outer(a: inner(b: x/y))}');
      assert.equal(result.length, 1);
      const call = result[0] as { call: string; args: Record<string, unknown>; returnType: string };
      assert.equal(call.call, 'outer');
      const innerCall = call.args.a as { call: string; args: Record<string, unknown>; returnType: string };
      assert.equal(innerCall.call, 'inner');
      assert.deepEqual(innerCall.args.b, { path: 'x/y' });
    });

    it('嵌套插值 ${${path}}', () => {
      const result = parser.parse('${${path}}');
      assert.equal(result.length, 1);
      assert.deepEqual(result[0], { path: 'path' });
    });

    it('仅含插值后跟文本', () => {
      const result = parser.parse('${x}!');
      assert.deepEqual(result, [{ path: 'x' }, '!']);
    });

    it('文本后仅含插值', () => {
      const result = parser.parse('!${x}');
      assert.deepEqual(result, ['!', { path: 'x' }]);
    });

    it('多段交替文本和插值', () => {
      const result = parser.parse('a${x}b${y}c');
      assert.deepEqual(result, ['a', { path: 'x' }, 'b', { path: 'y' }, 'c']);
    });
  });

  // ==========================================================================
  // parseExpression 方法
  // ==========================================================================
  describe('parseExpression', () => {
    it('空表达式应返回空字符串', () => {
      assert.equal(parser.parseExpression(''), '');
    });

    it('路径表达式', () => {
      assert.deepEqual(parser.parseExpression('user/name'), { path: 'user/name' });
    });

    it('字符串字面量（双引号）', () => {
      assert.equal(parser.parseExpression('"hello"'), 'hello');
    });

    it('字符串字面量（单引号）', () => {
      assert.equal(parser.parseExpression("'world'"), 'world');
    });

    it('整数', () => {
      assert.equal(parser.parseExpression('100'), 100);
    });

    it('浮点数', () => {
      assert.equal(parser.parseExpression('2.5'), 2.5);
    });

    it('负数', () => {
      assert.equal(parser.parseExpression('-7'), -7);
    });

    it('布尔值 true', () => {
      assert.equal(parser.parseExpression('true'), true);
    });

    it('布尔值 false', () => {
      assert.equal(parser.parseExpression('false'), false);
    });

    it('null 转为空字符串', () => {
      assert.equal(parser.parseExpression('null'), '');
    });

    it('带转义的字符串字面量', () => {
      assert.equal(parser.parseExpression('"line1\\nline2"'), 'line1\nline2');
    });
  });

  // ==========================================================================
  // 错误处理
  // ==========================================================================
  describe('错误处理', () => {
    it('未闭合的插值应抛错', () => {
      assert.throws(() => parser.parse('${unclosed'), /Unclosed interpolation/);
    });

    it('函数调用缺少冒号应抛错', () => {
      assert.throws(() => parser.parseExpression('func(arg value)'), /Expected ':'/);
    });

    it('超深递归应抛错', () => {
      assert.throws(() => parser.parse('${x}', 11), /Max recursion depth/);
    });
  });
});
