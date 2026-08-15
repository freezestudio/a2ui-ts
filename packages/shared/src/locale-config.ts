/**
 * A2UI 国际化配置
 * 对应 Python: basic_catalog/locale_config.py
 *
 * 提供多语言的格式化规则，包括数字、货币、日期和复数规则
 */

/** 复数类别选择器函数类型 */
export type PluralCategorySelector = (value: number) => string;

/**
 * 国际化格式化规则
 * 封装特定语言环境下的所有格式约定
 */
export interface LocaleFormattingRules {
  /** 小数点符号（如 "." 或 ","） */
  decimalSeparator: string;
  /** 千分位符号（如 "," 或 "."） */
  groupingSeparator: string;
  /** 货币符号是否在数字之后 */
  currencySymbolAfter: boolean;
  /** 货币符号和数字之间是否有空格 */
  currencySpaceSeparated: boolean;
  /** 12 个月长名称（1-indexed，索引 0 为空字符串） */
  monthsLong: string[];
  /** 12 个月短名称（1-indexed，索引 0 为空字符串） */
  monthsShort: string[];
  /** 7 个星期名称（0-indexed，周一=0 ... 周日=6） */
  weekdaysLong: string[];
  /** 7 个星期短名称（0-indexed，周一=0 ... 周日=6） */
  weekdaysShort: string[];
  /** 复数类别选择器（可选，接受数值返回复数类别） */
  pluralCategorySelector?: PluralCategorySelector;
}

// ============================================================================
// 复数规则函数
// ============================================================================

/** 英语复数规则：绝对值为 1 时为 "one"，否则为 "other" */
function pluralEn(value: number): string {
  return Math.abs(value) === 1 ? 'one' : 'other';
}

/** 法语复数规则：绝对值 <= 1 时为 "one"，否则为 "other" */
function pluralFr(value: number): string {
  return Math.abs(value) <= 1 ? 'one' : 'other';
}

/** 威尔士语复数规则：0=zero, 1=one, 2=two, 其他=other */
function pluralCy(value: number): string {
  if (value === 0) return 'zero';
  if (value === 1) return 'one';
  if (value === 2) return 'two';
  return 'other';
}

// ============================================================================
// 默认规则（英文）
// ============================================================================

const DEFAULT_RULES: LocaleFormattingRules = {
  decimalSeparator: '.',
  groupingSeparator: ',',
  currencySymbolAfter: false,
  currencySpaceSeparated: false,
  monthsLong: [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  monthsShort: ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  pluralCategorySelector: pluralEn,
};

// ============================================================================
// 内置语言规则
// ============================================================================

const SUPPORTED_LOCALES: Record<string, LocaleFormattingRules> = {
  en: { ...DEFAULT_RULES },

  zh: {
    decimalSeparator: '.',
    groupingSeparator: ',',
    currencySymbolAfter: false,
    currencySpaceSeparated: false,
    monthsLong: [
      '',
      '一月',
      '二月',
      '三月',
      '四月',
      '五月',
      '六月',
      '七月',
      '八月',
      '九月',
      '十月',
      '十一月',
      '十二月',
    ],
    monthsShort: ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    weekdaysLong: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    pluralCategorySelector: pluralEn,
  },

  de: {
    decimalSeparator: ',',
    groupingSeparator: '.',
    currencySymbolAfter: true,
    currencySpaceSeparated: true,
    monthsLong: [
      '',
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ],
    monthsShort: ['', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    weekdaysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
    weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    pluralCategorySelector: pluralEn,
  },

  fr: {
    decimalSeparator: ',',
    groupingSeparator: ' ',
    currencySymbolAfter: true,
    currencySpaceSeparated: true,
    monthsLong: [
      '',
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ],
    monthsShort: [
      '',
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ],
    weekdaysLong: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    weekdaysShort: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
    pluralCategorySelector: pluralFr,
  },

  es: {
    decimalSeparator: ',',
    groupingSeparator: '.',
    currencySymbolAfter: true,
    currencySpaceSeparated: true,
    monthsLong: [
      '',
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    monthsShort: ['', 'ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'],
    weekdaysLong: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    weekdaysShort: ['lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.', 'dom.'],
    pluralCategorySelector: pluralEn,
  },

  cy: {
    ...DEFAULT_RULES,
    pluralCategorySelector: pluralCy,
  },
};

// ============================================================================
// 货币符号映射
// ============================================================================

/** ISO 4217 货币代码到符号的映射 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF',
};

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 获取指定语言环境的格式化规则
 * 若语言未知或为空，则回退到英文规则
 * @param localeString 语言标识符（如 "en", "zh-CN", "de_DE"）
 */
export function getLocaleRules(localeString?: string | null): LocaleFormattingRules {
  if (!localeString) {
    return SUPPORTED_LOCALES['en']!;
  }
  const prefix = String(localeString).replace('_', '-').split('-')[0]!.toLowerCase();
  return SUPPORTED_LOCALES[prefix] ?? SUPPORTED_LOCALES['en']!;
}

/**
 * 注册或更新语言环境的格式化规则
 * @param localePrefix 语言标识符前缀（如 "en", "zh"）
 * @param rules 格式化规则
 */
export function registerLocaleRules(localePrefix: string, rules: LocaleFormattingRules): void {
  SUPPORTED_LOCALES[localePrefix.toLowerCase()] = rules;
}
