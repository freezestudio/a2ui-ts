import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { getLocaleRules, registerLocaleRules, CURRENCY_SYMBOLS } from './locale-config.js';
import type { LocaleFormattingRules } from './locale-config.js';

describe('locale-config', () => {
  // ==========================================================================
  // getLocaleRules
  // ==========================================================================
  describe('getLocaleRules', () => {
    it("'en' 应返回英语规则", () => {
      const rules = getLocaleRules('en');
      assert.equal(rules.decimalSeparator, '.');
      assert.equal(rules.groupingSeparator, ',');
      assert.equal(rules.currencySymbolAfter, false);
      assert.equal(rules.monthsLong[1], 'January');
      assert.equal(rules.weekdaysLong[0], 'Monday');
    });

    it("'zh' 应返回中文规则", () => {
      const rules = getLocaleRules('zh');
      assert.equal(rules.decimalSeparator, '.');
      assert.equal(rules.monthsLong[1], '一月');
      assert.equal(rules.weekdaysShort[0], '周一');
    });

    it("'de' 应返回德语规则", () => {
      const rules = getLocaleRules('de');
      assert.equal(rules.decimalSeparator, ',');
      assert.equal(rules.groupingSeparator, '.');
      assert.equal(rules.currencySymbolAfter, true);
      assert.equal(rules.currencySpaceSeparated, true);
    });

    it("'fr' 应返回法语规则", () => {
      const rules = getLocaleRules('fr');
      assert.equal(rules.decimalSeparator, ',');
      assert.equal(rules.groupingSeparator, ' ');
      assert.equal(rules.monthsLong[1], 'janvier');
    });

    it('未知语言应回退到英语', () => {
      const rules = getLocaleRules('unknown');
      assert.equal(rules.decimalSeparator, '.');
      assert.equal(rules.monthsLong[1], 'January');
    });

    it('空字符串应回退到英语', () => {
      const rules = getLocaleRules('');
      assert.equal(rules.decimalSeparator, '.');
    });

    it('null 应回退到英语', () => {
      const rules = getLocaleRules(null);
      assert.equal(rules.decimalSeparator, '.');
    });

    it('undefined 应回退到英语', () => {
      const rules = getLocaleRules(undefined);
      assert.equal(rules.decimalSeparator, '.');
    });

    it("'zh-CN' 应提取前缀 'zh' 并匹配", () => {
      const rules = getLocaleRules('zh-CN');
      assert.equal(rules.monthsLong[1], '一月');
    });

    it("'de_DE' 应提取前缀 'de' 并匹配（下划线分隔）", () => {
      const rules = getLocaleRules('de_DE');
      assert.equal(rules.decimalSeparator, ',');
    });
  });

  // ==========================================================================
  // registerLocaleRules
  // ==========================================================================
  describe('registerLocaleRules', () => {
    it('注册新语言后应可获取', () => {
      const customRules: LocaleFormattingRules = {
        decimalSeparator: '.',
        groupingSeparator: ',',
        currencySymbolAfter: false,
        currencySpaceSeparated: false,
        monthsLong: [
          '',
          'TestMonth1',
          'TestMonth2',
          'TestMonth3',
          'TestMonth4',
          'TestMonth5',
          'TestMonth6',
          'TestMonth7',
          'TestMonth8',
          'TestMonth9',
          'TestMonth10',
          'TestMonth11',
          'TestMonth12',
        ],
        monthsShort: ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
        weekdaysLong: ['TestDay1', 'TestDay2', 'TestDay3', 'TestDay4', 'TestDay5', 'TestDay6', 'TestDay7'],
        weekdaysShort: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
      };

      registerLocaleRules('test', customRules);
      const rules = getLocaleRules('test');
      assert.equal(rules.monthsLong[1], 'TestMonth1');
    });
  });

  // ==========================================================================
  // CURRENCY_SYMBOLS
  // ==========================================================================
  describe('CURRENCY_SYMBOLS', () => {
    it('应包含 USD', () => {
      assert.equal(CURRENCY_SYMBOLS['USD'], '$');
    });

    it('应包含 EUR', () => {
      assert.equal(CURRENCY_SYMBOLS['EUR'], '€');
    });

    it('应包含 GBP', () => {
      assert.equal(CURRENCY_SYMBOLS['GBP'], '£');
    });

    it('应包含 JPY', () => {
      assert.equal(CURRENCY_SYMBOLS['JPY'], '¥');
    });

    it('应包含 CNY', () => {
      assert.equal(CURRENCY_SYMBOLS['CNY'], '¥');
    });
  });

  // ==========================================================================
  // 复数规则
  // ==========================================================================
  describe('复数规则', () => {
    it('英语复数: 1 → one, 2 → other', () => {
      const rules = getLocaleRules('en');
      assert.ok(rules.pluralCategorySelector);
      assert.equal(rules.pluralCategorySelector!(1), 'one');
      assert.equal(rules.pluralCategorySelector!(2), 'other');
      assert.equal(rules.pluralCategorySelector!(0), 'other');
    });

    it('法语复数: 0 → one, 1 → one, 2 → other', () => {
      const rules = getLocaleRules('fr');
      assert.ok(rules.pluralCategorySelector);
      assert.equal(rules.pluralCategorySelector!(0), 'one');
      assert.equal(rules.pluralCategorySelector!(1), 'one');
      assert.equal(rules.pluralCategorySelector!(2), 'other');
    });
  });
});
