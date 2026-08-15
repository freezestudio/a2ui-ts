import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  requiredFunction,
  regexFunction,
  lengthFunction,
  numericFunction,
  emailFunction,
  formatNumberFunction,
  formatCurrencyFunction,
  formatDateFunction,
  andFunction,
  orFunction,
  notFunction,
  addFunction,
  subtractFunction,
  multiplyFunction,
  divideFunction,
  equalsFunction,
  greaterThanFunction,
  containsFunction,
  capitalizeFunction,
} from './functions/index.js';

const emptyCtx = {};

/** 解包 ValidationResult（v1.0 #2220 校验函数返回 {valid} 对象） */
function validOf(result: unknown): boolean {
  return typeof result === 'object' && result !== null && 'valid' in result
    ? Boolean((result as { valid: boolean }).valid)
    : Boolean(result);
}

describe('functions-extended', () => {
  // ==========================================================================
  // 校验类函数
  // ==========================================================================
  describe('校验类', () => {
    describe('required', () => {
      const exec = (value: unknown) => requiredFunction.execute!({ value }, emptyCtx);

      it('非空字符串应返回 true', () => {
        assert.equal(validOf(exec('hello')), true);
      });

      it('空字符串应返回 false', () => {
        assert.equal(validOf(exec('')), false);
      });

      it('null 应返回 false', () => {
        assert.equal(validOf(exec(null)), false);
      });

      it('undefined 应返回 false', () => {
        assert.equal(validOf(exec(undefined)), false);
      });

      it('空数组应返回 false', () => {
        assert.equal(validOf(exec([])), false);
      });

      it('非空数组应返回 true', () => {
        assert.equal(validOf(exec([1])), true);
      });

      it('数字 0 应返回 true', () => {
        assert.equal(validOf(exec(0)), true);
      });
    });

    describe('regex', () => {
      const exec = (value: string, pattern: string) => regexFunction.execute!({ value, pattern }, emptyCtx);

      it('匹配成功应返回 true', () => {
        assert.equal(validOf(exec('hello123', '[a-z]+[0-9]+')), true);
      });

      it('匹配失败应返回 false', () => {
        assert.equal(validOf(exec('hello', '^[0-9]+$')), false);
      });

      it('无效正则应返回 false', () => {
        assert.equal(validOf(exec('test', '[')), false);
      });
    });

    describe('length', () => {
      it('长度在范围内应返回 true', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'hello', min: 3, max: 10 }, emptyCtx)), true);
      });

      it('长度小于 min 应返回 false', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'hi', min: 3 }, emptyCtx)), false);
      });

      it('长度大于 max 应返回 false', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'hello world!', max: 5 }, emptyCtx)), false);
      });

      it('仅指定 min', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'abc', min: 2 }, emptyCtx)), true);
      });

      it('仅指定 max', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'ab', max: 5 }, emptyCtx)), true);
      });

      it('仅指定 value', () => {
        assert.equal(validOf(lengthFunction.execute!({ value: 'any' }, emptyCtx)), true);
      });
    });

    describe('numeric', () => {
      it('数值在范围内应返回 true', () => {
        assert.equal(validOf(numericFunction.execute!({ value: 5, min: 1, max: 10 }, emptyCtx)), true);
      });

      it('数值小于 min 应返回 false', () => {
        assert.equal(validOf(numericFunction.execute!({ value: 0, min: 1 }, emptyCtx)), false);
      });

      it('数值大于 max 应返回 false', () => {
        assert.equal(validOf(numericFunction.execute!({ value: 11, max: 10 }, emptyCtx)), false);
      });

      it('边界值应返回 true', () => {
        assert.equal(validOf(numericFunction.execute!({ value: 1, min: 1, max: 10 }, emptyCtx)), true);
        assert.equal(validOf(numericFunction.execute!({ value: 10, min: 1, max: 10 }, emptyCtx)), true);
      });
    });

    describe('email', () => {
      it('合法邮箱应返回 true', () => {
        assert.equal(validOf(emailFunction.execute!({ value: 'test@example.com' }, emptyCtx)), true);
      });

      it('无 @ 应返回 false', () => {
        assert.equal(validOf(emailFunction.execute!({ value: 'testexample.com' }, emptyCtx)), false);
      });

      it('无域名后缀应返回 false', () => {
        assert.equal(validOf(emailFunction.execute!({ value: 'test@example' }, emptyCtx)), false);
      });

      it('空字符串应返回 false', () => {
        assert.equal(validOf(emailFunction.execute!({ value: '' }, emptyCtx)), false);
      });
    });
  });

  // ==========================================================================
  // 格式化类函数
  // ==========================================================================
  describe('格式化类', () => {
    describe('formatNumber', () => {
      it('应格式化数字并保留指定小数位', () => {
        const result = formatNumberFunction.execute!({ value: 1234.5, decimals: 2 }, emptyCtx);
        assert.equal(result, '1,234.50');
      });

      it('不指定小数位时应使用默认', () => {
        const result = formatNumberFunction.execute!({ value: 1234 }, emptyCtx) as string;
        assert.ok(typeof result === 'string');
      });

      it('关闭千分位分组', () => {
        const result = formatNumberFunction.execute!({ value: 1234.5, decimals: 2, grouping: false }, emptyCtx);
        assert.equal(result, '1234.50');
      });
    });

    describe('formatCurrency', () => {
      it('应格式化 USD 货币', () => {
        const result = formatCurrencyFunction.execute!({ value: 100, currency: 'USD' }, emptyCtx) as string;
        assert.ok(result.includes('$'));
        assert.ok(result.includes('100'));
      });

      it('应格式化 EUR 货币', () => {
        const result = formatCurrencyFunction.execute!({ value: 50.5, currency: 'EUR' }, emptyCtx) as string;
        assert.ok(typeof result === 'string');
      });
    });

    describe('formatDate', () => {
      it('应按 yyyy-MM-dd 格式化日期', () => {
        const result = formatDateFunction.execute!(
          { value: '2024-01-15T00:00:00Z', format: 'yyyy-MM-dd' },
          emptyCtx,
        ) as string;
        assert.equal(result, '2024-01-15');
      });

      it('应包含月份名称', () => {
        const result = formatDateFunction.execute!(
          { value: '2024-01-15T00:00:00Z', format: 'MMMM' },
          emptyCtx,
        ) as string;
        assert.equal(result, 'January');
      });

      it('无效日期应返回空字符串', () => {
        const result = formatDateFunction.execute!({ value: 'not-a-date', format: 'yyyy-MM-dd' }, emptyCtx);
        assert.equal(result, '');
      });
    });
  });

  // ==========================================================================
  // 逻辑类函数
  // ==========================================================================
  describe('逻辑类', () => {
    describe('and', () => {
      it('全部为 true 应返回 true', () => {
        assert.equal(andFunction.execute!({ values: [true, true] }, emptyCtx), true);
      });

      it('包含 false 应返回 false', () => {
        assert.equal(andFunction.execute!({ values: [true, false] }, emptyCtx), false);
      });

      it('空数组应返回 true（every 默认行为）', () => {
        assert.equal(validOf(andFunction.execute!({ values: [] }, emptyCtx)), true);
      });
    });

    describe('or', () => {
      it('包含 true 应返回 true', () => {
        assert.equal(orFunction.execute!({ values: [false, true] }, emptyCtx), true);
      });

      it('全部为 false 应返回 false', () => {
        assert.equal(orFunction.execute!({ values: [false, false] }, emptyCtx), false);
      });

      it('空数组应返回 false（some 默认行为）', () => {
        assert.equal(validOf(orFunction.execute!({ values: [] }, emptyCtx)), false);
      });
    });

    describe('not', () => {
      it('true 应返回 false', () => {
        assert.equal(validOf(notFunction.execute!({ value: true }, emptyCtx)), false);
      });

      it('false 应返回 true', () => {
        assert.equal(validOf(notFunction.execute!({ value: false }, emptyCtx)), true);
      });
    });
  });

  // ==========================================================================
  // 运算符函数
  // ==========================================================================
  describe('运算符', () => {
    describe('add', () => {
      it('1 + 2 = 3', () => {
        assert.equal(addFunction.execute!({ a: 1, b: 2 }, emptyCtx), 3);
      });

      it('浮点数相加', () => {
        assert.equal(addFunction.execute!({ a: 1.5, b: 2.5 }, emptyCtx), 4);
      });
    });

    describe('subtract', () => {
      it('5 - 3 = 2', () => {
        assert.equal(subtractFunction.execute!({ a: 5, b: 3 }, emptyCtx), 2);
      });
    });

    describe('multiply', () => {
      it('2 * 3 = 6', () => {
        assert.equal(multiplyFunction.execute!({ a: 2, b: 3 }, emptyCtx), 6);
      });
    });

    describe('divide', () => {
      it('10 / 2 = 5', () => {
        assert.equal(divideFunction.execute!({ a: 10, b: 2 }, emptyCtx), 5);
      });

      it('1 / 0 应返回 Infinity', () => {
        assert.equal(divideFunction.execute!({ a: 1, b: 0 }, emptyCtx), Infinity);
      });

      it('-1 / 0 应返回 -Infinity', () => {
        assert.equal(divideFunction.execute!({ a: -1, b: 0 }, emptyCtx), -Infinity);
      });

      it('0 / 0 应返回 NaN', () => {
        const result = divideFunction.execute!({ a: 0, b: 0 }, emptyCtx);
        assert.ok(Number.isNaN(result));
      });
    });

    describe('equals', () => {
      it('1 === 1 应返回 true', () => {
        assert.equal(equalsFunction.execute!({ a: 1, b: 1 }, emptyCtx), true);
      });

      it('1 === 2 应返回 false', () => {
        assert.equal(equalsFunction.execute!({ a: 1, b: 2 }, emptyCtx), false);
      });

      it('字符串相等', () => {
        assert.equal(equalsFunction.execute!({ a: 'abc', b: 'abc' }, emptyCtx), true);
      });
    });

    describe('greaterThan', () => {
      it('2 > 1 应返回 true', () => {
        assert.equal(greaterThanFunction.execute!({ a: 2, b: 1 }, emptyCtx), true);
      });

      it('1 > 2 应返回 false', () => {
        assert.equal(greaterThanFunction.execute!({ a: 1, b: 2 }, emptyCtx), false);
      });

      it('1 > 1 应返回 false', () => {
        assert.equal(greaterThanFunction.execute!({ a: 1, b: 1 }, emptyCtx), false);
      });
    });

    describe('contains', () => {
      it('字符串包含子串应返回 true', () => {
        assert.equal(containsFunction.execute!({ string: 'hello world', substring: 'world' }, emptyCtx), true);
      });

      it('字符串不包含子串应返回 false', () => {
        assert.equal(containsFunction.execute!({ string: 'hello', substring: 'xyz' }, emptyCtx), false);
      });
    });
  });

  // ==========================================================================
  // capitalize（基准函数验证）
  // ==========================================================================
  describe('capitalize', () => {
    it('首字母大写', () => {
      assert.equal(capitalizeFunction.execute!({ value: 'hello' }, emptyCtx), 'Hello');
    });

    it('空字符串不变', () => {
      assert.equal(capitalizeFunction.execute!({ value: '' }, emptyCtx), '');
    });

    it('已大写的首字母不变', () => {
      assert.equal(capitalizeFunction.execute!({ value: 'Hello' }, emptyCtx), 'Hello');
    });
  });
});
