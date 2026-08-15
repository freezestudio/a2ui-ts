/**
 * DynamicXxx oneOf 模式工厂函数
 * A2UI v1.0 规范要求 DynamicString/DynamicNumber/DynamicBoolean
 * 必须支持三态: 字面量 | DataBinding({path}) | FunctionCall({call, args})
 */
const dataBinding = { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] };

const functionCall = {
  type: 'object',
  properties: { call: { type: 'string' }, args: { type: 'object', additionalProperties: true } },
  required: ['call'],
};

/** DynamicString: string | {path: ...} | {call: ..., args: ...} */
export function dynamicStringOneOf(): Record<string, unknown>[] {
  return [{ type: 'string' }, { ...dataBinding }, { ...functionCall }];
}

/** DynamicNumber: number | {path: ...} | {call: ..., args: ...} */
export function dynamicNumberOneOf(): Record<string, unknown>[] {
  return [{ type: 'number' }, { ...dataBinding }, { ...functionCall }];
}

/** DynamicBoolean: boolean | {path: ...} | {call: ..., args: ...} */
export function dynamicBooleanOneOf(): Record<string, unknown>[] {
  return [{ type: 'boolean' }, { ...dataBinding }, { ...functionCall }];
}
