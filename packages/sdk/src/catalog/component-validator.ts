/**
 * 组件属性级 Schema 校验器
 *
 * 对应 A2UI v1.0 规范的 catalog 校验要求与 Python SDK 的 CatalogSchemaValidator。
 * 支持 ComponentApi.schema 使用的轻量 JSON Schema 子集：
 *   type / properties / required / enum / const / oneOf / items / minItems / maxItems
 *   minimum / maximum / minLength / maxLength / pattern / additionalProperties
 *
 * 组件公共字段（id / component / catalogId / weight / accessibility）由协议信封与
 * 完整性检查负责，本校验器只校验组件特定属性。
 */

import { z } from 'zod';

/** 单条校验问题 */
export const componentValidationIssueSchema = z.object({
  /** JSON Pointer 风格路径（如 '/text'、'/series/0/name'） */
  path: z.string(),
  /** 错误消息 */
  message: z.string(),
});
export type ComponentValidationIssue = z.infer<typeof componentValidationIssueSchema>;

const JSON_SCHEMA_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);

/** 基础类型检查 */
function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

/**
 * 校验单个值与子 schema
 *
 * @param schema - JSON Schema 片段（null/undefined 视为无约束）
 * @param value - 待校验的值
 * @param path - 当前路径（用于错误定位）
 * @param issues - 错误收集数组
 * @returns 是否通过
 */
export function validateValue(
  schema: Record<string, unknown> | null | undefined,
  value: unknown,
  path: string,
  issues: ComponentValidationIssue[],
): boolean {
  if (!schema) return true;

  // $ref 本地引用（如 '#/$defs/DynamicBoolean'）：当前组件 schema 中动态类型
  // 均已内联为 oneOf，此处对无法解析的引用采取宽松处理
  const ref = schema['$ref'];
  if (typeof ref === 'string' && ref.startsWith('#')) {
    return true;
  }

  // const — 严格相等
  if ('const' in schema) {
    const expected = schema['const'];
    if (value !== expected) {
      issues.push({ path, message: `期望常量 ${JSON.stringify(expected)}，实际为 ${JSON.stringify(value)}` });
      return false;
    }
  }

  // enum — 值必须在枚举列表中
  if ('enum' in schema && Array.isArray(schema['enum'])) {
    if (!schema['enum'].includes(value)) {
      issues.push({
        path,
        message: `值 ${JSON.stringify(value)} 不在允许列表中: ${schema['enum'].map((e) => JSON.stringify(e)).join(', ')}`,
      });
      return false;
    }
  }

  // type — 基础类型检查
  if (typeof schema['type'] === 'string') {
    const type = schema['type'];
    if (type !== 'any' && !JSON_SCHEMA_TYPES.has(type) && type !== 'object' && type !== 'array') {
      return true;
    }
    if (!checkType(value, type)) {
      issues.push({ path, message: `期望类型 ${type}，实际为 ${value === null ? 'null' : typeof value}` });
      return false;
    }
  }

  // oneOf — 至少一个分支通过
  if ('oneOf' in schema && Array.isArray(schema['oneOf'])) {
    const branches = schema['oneOf'] as Array<Record<string, unknown>>;
    if (branches.length > 0) {
      let matched = false;
      for (const branch of branches) {
        const branchIssues: ComponentValidationIssue[] = [];
        if (validateValue(branch, value, path, branchIssues)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        issues.push({ path, message: `值 ${JSON.stringify(value)} 不符合 anyOf/oneOf 中的任何分支` });
        return false;
      }
    }
  }

  // 字符串约束
  if (typeof value === 'string') {
    if (typeof schema['minLength'] === 'number' && value.length < schema['minLength']) {
      issues.push({ path, message: `字符串长度 ${value.length} 小于最小值 ${schema['minLength']}` });
      return false;
    }
    if (typeof schema['maxLength'] === 'number' && value.length > schema['maxLength']) {
      issues.push({ path, message: `字符串长度 ${value.length} 大于最大值 ${schema['maxLength']}` });
      return false;
    }
    if (typeof schema['pattern'] === 'string') {
      try {
        if (!new RegExp(schema['pattern']).test(value)) {
          issues.push({ path, message: `字符串 "${value}" 不匹配模式 ${schema['pattern']}` });
          return false;
        }
      } catch {
        // 无效正则不阻断
      }
    }
  }

  // 数字约束
  if (typeof value === 'number') {
    if (typeof schema['minimum'] === 'number' && value < schema['minimum']) {
      issues.push({ path, message: `数值 ${value} 小于最小值 ${schema['minimum']}` });
      return false;
    }
    if (typeof schema['maximum'] === 'number' && value > schema['maximum']) {
      issues.push({ path, message: `数值 ${value} 大于最大值 ${schema['maximum']}` });
      return false;
    }
  }

  // 对象属性递归校验
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const props = schema['properties'];
    if (props && typeof props === 'object') {
      const obj = value as Record<string, unknown>;
      const propSchema = props as Record<string, Record<string, unknown>>;
      // 必填检查
      const required = schema['required'];
      if (Array.isArray(required)) {
        for (const key of required) {
          if (!(key in obj)) {
            issues.push({
              path: path === '' ? `/${String(key)}` : `${path}/${String(key)}`,
              message: `缺少必填字段 ${String(key)}`,
            });
            return false;
          }
        }
      }
      // 属性递归
      for (const [key, sub] of Object.entries(propSchema)) {
        if (key in obj) {
          validateValue(sub, obj[key], path === '' ? `/${key}` : `${path}/${key}`, issues);
        }
      }
      // additionalProperties: false — 拒绝未知属性
      if (schema['additionalProperties'] === false) {
        const known = new Set(Object.keys(propSchema));
        for (const key of Object.keys(obj)) {
          if (!known.has(key)) {
            issues.push({
              path: path === '' ? `/${key}` : `${path}/${key}`,
              message: `未知属性 ${key}（additionalProperties: false）`,
            });
          }
        }
      }
    }
  }

  // 数组约束
  if (Array.isArray(value)) {
    const items = schema['items'];
    if (typeof schema['minItems'] === 'number' && value.length < schema['minItems']) {
      issues.push({ path, message: `数组长度 ${value.length} 小于最小值 ${schema['minItems']}` });
      return false;
    }
    if (typeof schema['maxItems'] === 'number' && value.length > schema['maxItems']) {
      issues.push({ path, message: `数组长度 ${value.length} 大于最大值 ${schema['maxItems']}` });
      return false;
    }
    if (items && typeof items === 'object') {
      for (let i = 0; i < value.length; i++) {
        validateValue(items as Record<string, unknown>, value[i], `${path}/${i}`, issues);
      }
    }
  }

  return true;
}

/**
 * 校验组件属性是否符合组件 Schema
 *
 * 跳过组件公共字段（id / component / catalogId / weight / accessibility），
 * 这些字段由协议信封与完整性检查负责。
 *
 * @param comp - 组件对象（含 id / component 与特定属性）
 * @param schema - 组件 Schema（ComponentApi.schema）
 * @returns 校验问题列表，空数组表示通过
 */
export function validateComponentProps(
  comp: Record<string, unknown>,
  schema: Record<string, unknown>,
): ComponentValidationIssue[] {
  const issues: ComponentValidationIssue[] = [];

  const props = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!props || typeof props !== 'object') {
    return issues;
  }

  // metadata 为 v1.0 #2187 厂商扩展接缝，非渲染属性，跳过常规必填/类型校验
  const COMMON_FIELDS = new Set(['id', 'component', 'catalogId', 'weight', 'accessibility', 'metadata']);

  // 必填检查（跳过公共字段）
  const required = schema['required'];
  if (Array.isArray(required)) {
    for (const key of required) {
      if (COMMON_FIELDS.has(String(key))) continue;
      if (!(key in comp)) {
        issues.push({ path: `/${String(key)}`, message: `缺少必填属性 ${String(key)}` });
      }
    }
  }

  // 属性递归校验（跳过公共字段）
  for (const [key, sub] of Object.entries(props)) {
    if (COMMON_FIELDS.has(key)) continue;
    if (key in comp) {
      validateValue(sub, comp[key], `/${key}`, issues);
    }
  }

  return issues;
}
