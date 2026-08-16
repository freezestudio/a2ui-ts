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

const DATA_BINDING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { path: { type: 'string' } },
  required: ['path'],
  additionalProperties: false,
};

const FUNCTION_CALL_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    call: { type: 'string', minLength: 1 },
    catalogId: { type: 'string' },
    args: { type: 'object' },
  },
  required: ['call'],
  unevaluatedProperties: false,
};

const KNOWN_EXTERNAL_DEFS: Record<string, Record<string, unknown>> = {
  ComponentId: { type: 'string' },
  CallId: { type: 'string' },
  Child: { type: 'string' },
  DataBinding: DATA_BINDING_SCHEMA,
  FunctionCall: FUNCTION_CALL_SCHEMA,
  DynamicString: { oneOf: [{ type: 'string' }, DATA_BINDING_SCHEMA, FUNCTION_CALL_SCHEMA] },
  DynamicNumber: { oneOf: [{ type: 'number' }, DATA_BINDING_SCHEMA, FUNCTION_CALL_SCHEMA] },
  DynamicBoolean: { oneOf: [{ type: 'boolean' }, DATA_BINDING_SCHEMA, FUNCTION_CALL_SCHEMA] },
  DynamicStringList: {
    oneOf: [{ type: 'array', items: { type: 'string' } }, DATA_BINDING_SCHEMA, FUNCTION_CALL_SCHEMA],
  },
  DynamicValue: {
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array' },
      { type: 'object', not: { anyOf: [{ required: ['path'] }, { required: ['call'] }] } },
      DATA_BINDING_SCHEMA,
      FUNCTION_CALL_SCHEMA,
    ],
  },
  CheckRule: {
    type: 'object',
    properties: {
      condition: { oneOf: [DATA_BINDING_SCHEMA, FUNCTION_CALL_SCHEMA] },
      message: { type: 'string' },
    },
    required: ['condition'],
    additionalProperties: false,
  },
  Checkable: {
    type: 'object',
    properties: { checks: { type: 'array', items: { type: 'object' } } },
  },
  ComponentCommon: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      catalogId: { type: 'string' },
      accessibility: { type: 'object' },
      metadata: { type: 'object' },
      weight: { type: 'number' },
    },
    required: ['id'],
  },
  FunctionCommon: {
    type: 'object',
    properties: { catalogId: { type: 'string' } },
  },
};

function resolveKnownRef(ref: unknown): Record<string, unknown> | undefined {
  if (typeof ref !== 'string') return undefined;
  const key = ref.split('/$defs/').pop()?.split('#').pop();
  return key ? KNOWN_EXTERNAL_DEFS[key] : undefined;
}

function validateFormat(schema: Record<string, unknown>, value: string): string | null {
  const format = schema['format'];
  if (typeof format !== 'string') return null;
  if (format === 'uri') {
    try {
      new URL(value);
      return null;
    } catch {
      return `字符串 "${value}" 不是合法 URI`;
    }
  }
  if (format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : `字符串 "${value}" 不是合法 date`;
  if (format === 'time') {
    return /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value) ? null : `字符串 "${value}" 不是合法 time`;
  }
  if (format === 'date-time') {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)
      ? null
      : `字符串 "${value}" 不是合法 date-time`;
  }
  return null;
}

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

  const ref = schema['$ref'];
  if (typeof ref === 'string') {
    const resolved = resolveKnownRef(ref);
    if (resolved) return validateValue(resolved, value, path, issues);
    return true; // 无法解析的引用由宿主 AJV 权威校验，不在此处阻断
  }

  let valid = true;

  if ('allOf' in schema && Array.isArray(schema['allOf'])) {
    for (const branch of schema['allOf'] as Array<Record<string, unknown>>) {
      if (!validateValue(branch, value, path, issues)) valid = false;
    }
  }

  if ('anyOf' in schema && Array.isArray(schema['anyOf'])) {
    let matched = false;
    for (const branch of schema['anyOf'] as Array<Record<string, unknown>>) {
      const branchIssues: ComponentValidationIssue[] = [];
      if (validateValue(branch, value, path, branchIssues)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      issues.push({ path, message: `值 ${JSON.stringify(value)} 不符合 anyOf 中的任何分支` });
      return false;
    }
  }

  if ('not' in schema && schema['not'] && typeof schema['not'] === 'object') {
    const notIssues: ComponentValidationIssue[] = [];
    if (validateValue(schema['not'] as Record<string, unknown>, value, path, notIssues)) {
      issues.push({ path, message: `值 ${JSON.stringify(value)} 违反了 not 约束` });
      return false;
    }
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
    const formatError = validateFormat(schema, value);
    if (formatError) {
      issues.push({ path, message: formatError });
      return false;
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
          if (!validateValue(sub, obj[key], path === '' ? `/${key}` : `${path}/${key}`, issues)) {
            valid = false;
          }
        }
      }
      // additionalProperties: false — 拒绝未知属性
      if (schema['additionalProperties'] === false || schema['unevaluatedProperties'] === false) {
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
        if (!validateValue(items as Record<string, unknown>, value[i], `${path}/${i}`, issues)) {
          valid = false;
        }
      }
    }
  }

  return valid;
}

/**
 * 把官方 catalog 组件/函数常用的 `allOf` 结构归一化为顶层 properties/required。
 */
export function normalizeCatalogSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const allOf = schema['allOf'];
  if (!Array.isArray(allOf)) return schema;

  const normalized: Record<string, unknown> = { ...schema };
  const properties: Record<string, Record<string, unknown>> = {};
  const required = new Set<string>();
  let sawObjectBranch = false;

  for (const branch of allOf as Array<Record<string, unknown>>) {
    const refSchema = typeof branch['$ref'] === 'string' ? resolveKnownRef(branch['$ref']) : undefined;
    if (refSchema) {
      if (refSchema['properties'] && typeof refSchema['properties'] === 'object') {
        for (const [key, value] of Object.entries(refSchema['properties'] as Record<string, Record<string, unknown>>)) {
          properties[key] = value;
        }
      }
      if (Array.isArray(refSchema['required'])) {
        for (const key of refSchema['required'] as string[]) required.add(key);
      }
      continue;
    }

    if (branch['properties'] && typeof branch['properties'] === 'object') {
      sawObjectBranch = true;
      for (const [key, value] of Object.entries(branch['properties'] as Record<string, Record<string, unknown>>)) {
        properties[key] = value;
      }
    }
    if (Array.isArray(branch['required'])) {
      sawObjectBranch = true;
      for (const key of branch['required'] as string[]) required.add(key);
    }
    if (branch['unevaluatedProperties'] === false) {
      normalized['unevaluatedProperties'] = false;
    }
  }

  if (sawObjectBranch || required.size > 0 || Object.keys(properties).length > 0) {
    normalized['properties'] = { ...(properties as Record<string, unknown>) };
  }
  if (required.size > 0) {
    normalized['required'] = [...required];
  }
  delete normalized['allOf'];
  return normalized;
}

/**
 * 从函数定义中提取 `args` JSON Schema（兼容 allOf 与扁平结构）。
 */
export function extractFunctionArgsSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeCatalogSchema(schema);
  const props = normalized['properties'] as Record<string, Record<string, unknown>> | undefined;
  return props?.['args'] ?? {};
}

/**
 * 校验组件属性是否符合组件 Schema
 *
 * 跳过组件公共字段（id / component / catalogId / weight / accessibility / metadata），
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

  const normalized = normalizeCatalogSchema(schema);
  const props = normalized['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!props || typeof props !== 'object') {
    return issues;
  }

  // metadata 为 v1.0 #2187 厂商扩展接缝，非渲染属性，跳过常规必填/类型校验
  const COMMON_FIELDS = new Set(['id', 'component', 'catalogId', 'weight', 'accessibility', 'metadata']);

  // 必填检查（跳过公共字段）
  const required = normalized['required'];
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

  // 协议信封 unevaluatedProperties: false 语义（对齐 agent_to_renderer.json#/$defs/Component）：
  // 组件属性必须是 ComponentCommon 公共字段或该 catalog 组件 schema 声明的属性，
  // 其余一律视为未知属性拒绝（不等同 schema 级 additionalProperties，此处无条件执行）。
  for (const key of Object.keys(comp)) {
    if (COMMON_FIELDS.has(key)) continue;
    if (!(key in props)) {
      issues.push({
        path: `/${key}`,
        message: `未知属性 ${key}（组件信封 unevaluatedProperties: false）`,
      });
    }
  }

  return issues;
}
