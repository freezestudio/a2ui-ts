/**
 * A2UI Catalog — 函数聚合导出
 * 对应 Python: basic_catalog/function_apis.py + function_impls.py + operator_apis.py
 *
 * 函数来源说明：
 * - 官方定义（14 个）：来自 A2UI v1.0 Basic Catalog 规范
 * - 扩展函数（12 个）：本地实现增强，未在官方目录中定义
 */

import { capitalizeFunction } from './capitalize.js';
import { requiredFunction } from './required.js'; // 官方
import { regexFunction } from './regex.js'; // 官方
import { lengthFunction } from './length.js'; // 官方
import { numericFunction } from './numeric.js'; // 官方
import { emailFunction } from './email.js'; // 官方
import { formatStringFunction } from './format-string.js'; // 官方
import { formatNumberFunction } from './format-number.js'; // 官方
import { formatCurrencyFunction } from './format-currency.js'; // 官方
import { formatDateFunction } from './format-date.js'; // 官方
import { pluralizeFunction } from './pluralize.js'; // 官方
import { openUrlFunction } from './open-url.js'; // 官方
import { andFunction } from './and.js'; // 官方
import { orFunction } from './or.js'; // 官方
import { notFunction } from './not.js'; // 官方
import { addFunction } from './add.js'; // 扩展
import { subtractFunction } from './subtract.js'; // 扩展
import { multiplyFunction } from './multiply.js'; // 扩展
import { divideFunction } from './divide.js'; // 扩展
import { equalsFunction } from './equals.js'; // 扩展
import { notEqualsFunction } from './not-equals.js'; // 扩展
import { greaterThanFunction } from './greater-than.js'; // 扩展
import { lessThanFunction } from './less-than.js'; // 扩展
import { containsFunction } from './contains.js'; // 扩展
import { startsWithFunction } from './starts-with.js'; // 扩展
import { endsWithFunction } from './ends-with.js'; // 扩展

import type { FunctionApi } from '../../catalog/types.js';

export {
  capitalizeFunction,
  requiredFunction,
  regexFunction,
  lengthFunction,
  numericFunction,
  emailFunction,
  formatStringFunction,
  formatNumberFunction,
  formatCurrencyFunction,
  formatDateFunction,
  pluralizeFunction,
  openUrlFunction,
  andFunction,
  orFunction,
  notFunction,
  addFunction,
  subtractFunction,
  multiplyFunction,
  divideFunction,
  equalsFunction,
  notEqualsFunction,
  greaterThanFunction,
  lessThanFunction,
  containsFunction,
  startsWithFunction,
  endsWithFunction,
};

/**
 * 官方 v1.0 Basic Catalog 函数（14 个）。
 * 官方来源：A2UI v1.0 Basic Catalog（https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json）
 */
export const OFFICIAL_FUNCTIONS: FunctionApi[] = [
  requiredFunction,
  regexFunction,
  lengthFunction,
  numericFunction,
  emailFunction,
  formatStringFunction,
  formatNumberFunction,
  formatCurrencyFunction,
  formatDateFunction,
  pluralizeFunction,
  openUrlFunction,
  andFunction,
  orFunction,
  notFunction,
];

/** 项目扩展函数（12 个，不属于官方 basic catalog） */
export const EXTENDED_FUNCTIONS: FunctionApi[] = [
  capitalizeFunction,
  addFunction,
  subtractFunction,
  multiplyFunction,
  divideFunction,
  equalsFunction,
  notEqualsFunction,
  greaterThanFunction,
  lessThanFunction,
  containsFunction,
  startsWithFunction,
  endsWithFunction,
];

/**
 * Full Catalog 的所有函数（14 个官方 + 12 个扩展，共 26 个）。
 * 注意：该集合不得使用官方 basic catalog ID。
 */
export const FULL_FUNCTIONS: FunctionApi[] = [...OFFICIAL_FUNCTIONS, ...EXTENDED_FUNCTIONS];
