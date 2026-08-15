import { describe, it, expect } from 'vite-plus/test';
import {
  callFunction,
  getFunctionCallableFrom,
  getFunctionRequiresActivation,
  isKnownFunction,
  resolveDynamicValue,
} from './function-call.js';
import { A2uiSecurityError } from '@freezestudio/a2ui-web-core';
import { resolvePath, isDataBinding, isFunctionCall, setAtPath } from './data-binding.js';

/** 解包 ValidationResult（v1.0 #2220 校验函数返回 {valid} 对象） */
function validOf(result: unknown): boolean {
  return result !== null && typeof result === 'object' && 'valid' in result
    ? Boolean((result as { valid: boolean }).valid)
    : Boolean(result);
}

describe('function-call 函数库', () => {
  describe('callableFrom 边界（v1.0 执行边界）', () => {
    it('openUrl 为 rendererOnly（未声明 callableFrom，按规范缺省 rendererOnly）', () => {
      expect(getFunctionCallableFrom('openUrl')).toBe('rendererOnly');
    });

    it('@index 为 rendererOnly（系统函数）', () => {
      expect(getFunctionCallableFrom('@index')).toBe('rendererOnly');
    });

    it('已注册函数默认 rendererOnly', () => {
      expect(getFunctionCallableFrom('required')).toBe('rendererOnly');
      expect(getFunctionCallableFrom('formatNumber')).toBe('rendererOnly');
    });

    it('未注册函数返回 undefined', () => {
      expect(getFunctionCallableFrom('notExist')).toBeUndefined();
    });
  });

  describe('isKnownFunction', () => {
    it('识别官方 + 扩展函数', () => {
      expect(isKnownFunction('formatNumber')).toBe(true);
      expect(isKnownFunction('add')).toBe(true);
      expect(isKnownFunction('unknown')).toBe(false);
    });
  });

  describe('requiresUserActivation 门禁（上游 #2157）', () => {
    it('openUrl 声明 requiresUserActivation', () => {
      expect(getFunctionRequiresActivation('openUrl')).toBe(true);
      expect(getFunctionRequiresActivation('formatNumber')).toBe(false);
    });

    it('无激活上下文调用 openUrl 被拒绝（SECURITY_VIOLATION）', () => {
      expect(() => callFunction({ call: 'openUrl', args: { url: 'https://example.com' } }, {})).toThrow(
        A2uiSecurityError,
      );
      expect(() =>
        callFunction({ call: 'openUrl', args: { url: 'https://example.com' } }, {}, 0, { caller: 'agent' }),
      ).toThrow(/requires a user activation Action context/);
    });

    it('passive 意图（blur/change）调用 openUrl 被拒绝', () => {
      expect(() =>
        callFunction({ call: 'openUrl', args: { url: 'https://example.com' } }, {}, 0, {
          isExecutingAction: true,
          actionIntent: 'passive',
        }),
      ).toThrow(A2uiSecurityError);
    });

    it('激活意图（activation）调用 openUrl 允许', () => {
      const result = callFunction({ call: 'openUrl', args: { url: 'https://example.com' } }, {}, 0, {
        isExecutingAction: true,
        actionIntent: 'activation',
      });
      expect(result).toBe('');
    });

    it('非激活函数不受门禁影响', () => {
      expect(callFunction({ call: 'not', args: { value: false } }, {}, 0, { caller: 'agent' })).toBe(true);
    });

    it('嵌套 args 解析透传激活上下文（修复 context 丢失）', () => {
      const dataModel = { url: 'https://example.com' };
      expect(() =>
        callFunction({ call: 'openUrl', args: { url: { path: '/url' } } }, dataModel, 0, {
          isExecutingAction: true,
          actionIntent: 'activation',
        }),
      ).not.toThrow();
    });
  });

  describe('逻辑函数', () => {
    it('and：全部真才真（短路）', () => {
      expect(callFunction({ call: 'and', args: { values: [true, true] } }, {})).toBe(true);
      expect(callFunction({ call: 'and', args: { values: [true, false] } }, {})).toBe(false);
    });

    it('or：任一真即真', () => {
      expect(callFunction({ call: 'or', args: { values: [false, true] } }, {})).toBe(true);
      expect(callFunction({ call: 'or', args: { values: [false, false] } }, {})).toBe(false);
    });

    it('not：取反', () => {
      expect(callFunction({ call: 'not', args: { value: true } }, {})).toBe(false);
      expect(callFunction({ call: 'not', args: { value: false } }, {})).toBe(true);
    });
  });

  describe('校验函数（v1.0 #2220 ValidationResult）', () => {
    it('required：非空校验', () => {
      expect(validOf(callFunction({ call: 'required', args: { value: 'x' } }, {}))).toBe(true);
      expect(validOf(callFunction({ call: 'required', args: { value: '' } }, {}))).toBe(false);
      expect(validOf(callFunction({ call: 'required', args: { value: null } }, {}))).toBe(false);
    });

    it('numeric：数值区间', () => {
      expect(validOf(callFunction({ call: 'numeric', args: { value: 5, min: 0, max: 10 } }, {}))).toBe(true);
      expect(validOf(callFunction({ call: 'numeric', args: { value: 15, max: 10 } }, {}))).toBe(false);
    });

    it('email：邮箱格式', () => {
      expect(validOf(callFunction({ call: 'email', args: { value: 'a@b.com' } }, {}))).toBe(true);
      expect(validOf(callFunction({ call: 'email', args: { value: 'not-email' } }, {}))).toBe(false);
    });
  });

  describe('算术函数（扩展）', () => {
    it('add/subtract/multiply/divide', () => {
      expect(callFunction({ call: 'add', args: { a: 2, b: 3 } }, {})).toBe(5);
      expect(callFunction({ call: 'subtract', args: { a: 5, b: 2 } }, {})).toBe(3);
      expect(callFunction({ call: 'multiply', args: { a: 4, b: 3 } }, {})).toBe(12);
      expect(callFunction({ call: 'divide', args: { a: 10, b: 2 } }, {})).toBe(5);
    });

    it('equals/notEquals/greaterThan/lessThan', () => {
      expect(callFunction({ call: 'equals', args: { a: 1, b: 1 } }, {})).toBe(true);
      expect(callFunction({ call: 'notEquals', args: { a: 1, b: 2 } }, {})).toBe(true);
      expect(callFunction({ call: 'greaterThan', args: { a: 3, b: 2 } }, {})).toBe(true);
      expect(callFunction({ call: 'lessThan', args: { a: 1, b: 2 } }, {})).toBe(true);
    });
  });

  describe('格式函数', () => {
    it('formatNumber：千分位 + 小数位', () => {
      const result = callFunction({ call: 'formatNumber', args: { value: 1234567.891 } }, {});
      expect(typeof result).toBe('string');
      expect(String(result)).toContain('1,234,567');
    });

    it('formatString：${} 插值', () => {
      const dataModel = { name: '滑坡' };
      const result = callFunction({ call: 'formatString', args: { value: '监测对象: ${/name}' } }, dataModel) as string;
      expect(result).toBe('监测对象: 滑坡');
    });
  });

  describe('参数中嵌套 DataBinding 解析', () => {
    it('函数参数中的 {path} 先解析再执行', () => {
      const dataModel = { sensor: { value: 42 } };
      const result = callFunction({ call: 'greaterThan', args: { a: { path: '/sensor/value' }, b: 10 } }, dataModel);
      expect(result).toBe(true);
    });
  });
});

describe('data-binding JSON Pointer', () => {
  it('isDataBinding / isFunctionCall 判定', () => {
    expect(isDataBinding({ path: '/a' })).toBe(true);
    expect(isDataBinding({ call: 'x' })).toBe(false);
    expect(isFunctionCall({ call: 'x' })).toBe(true);
    expect(isFunctionCall({ path: '/a' })).toBe(false);
  });

  it('resolvePath 读取嵌套值', () => {
    const data = { a: { b: [1, 2, { c: 'ok' }] } };
    expect(resolvePath({ path: '/a/b/2/c' }, data)).toBe('ok');
  });

  it('setAtPath 写入并自动建层', () => {
    const data: Record<string, unknown> = {};
    setAtPath(data, '/a/b/c', 7);
    expect((data['a'] as Record<string, unknown>)['b']).toEqual({ c: 7 });
  });

  it('原型链防护：危险键拒绝（抛异常）', () => {
    const data: Record<string, unknown> = {};
    expect(() => setAtPath(data, '/__proto__/polluted', true)).toThrow();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('resolveDynamicValue', () => {
  it('字面量直通', () => {
    expect(resolveDynamicValue('str', {})).toBe('str');
    expect(resolveDynamicValue(42, {})).toBe(42);
    expect(resolveDynamicValue(true, {})).toBe(true);
  });

  it('DataBinding 从 dataModel 解析', () => {
    expect(resolveDynamicValue({ path: '/x' }, { x: 'val' })).toBe('val');
  });

  it('FunctionCall 执行', () => {
    expect(resolveDynamicValue({ call: 'not', args: { value: false } }, {})).toBe(true);
  });

  it('数组递归解析', () => {
    const result = resolveDynamicValue([{ path: '/a' }, 2], { a: 1 });
    expect(result).toEqual([1, 2]);
  });
});
