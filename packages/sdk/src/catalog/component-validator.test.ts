import { describe, it, expect } from 'vite-plus/test';
import { validateComponentProps, validateValue, type ComponentValidationIssue } from './component-validator.js';
import { TextComponentSchema } from '../basic-catalog/components/text.js';
import { ButtonComponentSchema } from '../basic-catalog/components/button.js';
import { RowComponentSchema } from '../basic-catalog/components/row.js';
import { createFullCatalog } from '../basic-catalog/index.js';

const collect = (schema: Record<string, unknown>, value: unknown): string[] => {
  const issues: ComponentValidationIssue[] = [];
  validateValue(schema, value, '', issues);
  return issues.map((i) => i.message);
};

describe('validateValue — 基础类型', () => {
  it('type 检查通过/失败', () => {
    expect(validateValue({ type: 'string' }, 'ok', '', [])).toBe(true);
    expect(validateValue({ type: 'string' }, 42, '', [])).toBe(false);
    expect(validateValue({ type: 'number' }, 'x', '', [])).toBe(false);
    expect(validateValue({ type: 'boolean' }, true, '', [])).toBe(true);
  });

  it('const 严格相等', () => {
    expect(validateValue({ const: 'Text' }, 'Text', '', [])).toBe(true);
    expect(validateValue({ const: 'Text' }, 'Button', '', [])).toBe(false);
  });

  it('enum 白名单', () => {
    expect(validateValue({ enum: ['a', 'b'] }, 'a', '', [])).toBe(true);
    expect(validateValue({ enum: ['a', 'b'] }, 'c', '', [])).toBe(false);
  });

  it('oneOf 至少一个分支', () => {
    const schema = { oneOf: [{ type: 'string' }, { type: 'object', properties: { path: { type: 'string' } } }] };
    expect(validateValue(schema, 'hello', '', [])).toBe(true);
    expect(validateValue(schema, { path: '/x' }, '', [])).toBe(true);
    expect(validateValue(schema, 123, '', [])).toBe(false);
  });

  it('数值范围', () => {
    expect(validateValue({ type: 'number', minimum: 0, maximum: 10 }, 5, '', [])).toBe(true);
    expect(validateValue({ type: 'number', minimum: 0 }, -1, '', [])).toBe(false);
  });

  it('字符串长度与模式', () => {
    expect(validateValue({ type: 'string', minLength: 2 }, 'ab', '', [])).toBe(true);
    expect(validateValue({ type: 'string', minLength: 3 }, 'ab', '', [])).toBe(false);
    expect(validateValue({ type: 'string', pattern: '^[0-9]+$' }, '123', '', [])).toBe(true);
    expect(validateValue({ type: 'string', pattern: '^[0-9]+$' }, '12a', '', [])).toBe(false);
  });

  it('数组 items/minItems', () => {
    const schema = { type: 'array', items: { type: 'number' }, minItems: 2 };
    expect(validateValue(schema, [1, 2], '', [])).toBe(true);
    expect(validateValue(schema, [1], '', [])).toBe(false);
    expect(validateValue(schema, ['x'], '', [])).toBe(false);
  });

  it('对象必填与未知属性', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] };
    expect(validateValue(schema, { a: '1' }, '', [])).toBe(true);
    expect(validateValue(schema, {}, '', [])).toBe(false);
    expect(collect({ type: 'object', properties: { a: {} }, additionalProperties: false }, { a: 1, b: 2 })).toEqual([
      '未知属性 b（additionalProperties: false）',
    ]);
  });
});

describe('validateComponentProps — 组件属性校验', () => {
  it('Text 组件：text 必填、variant 枚举', () => {
    expect(validateComponentProps({ id: 't1', component: 'Text', text: 'hello' }, TextComponentSchema.schema)).toEqual(
      [],
    );
    expect(validateComponentProps({ id: 't1', component: 'Text' }, TextComponentSchema.schema)).not.toEqual([]);
    const issues = validateComponentProps(
      { id: 't1', component: 'Text', text: 'x', variant: 'huge' },
      TextComponentSchema.schema,
    );
    expect(issues.some((i) => i.path === '/variant')).toBe(true);
  });

  it('Text 组件：动态绑定/函数调用也合法', () => {
    expect(
      validateComponentProps({ id: 't1', component: 'Text', text: { path: '/x' } }, TextComponentSchema.schema),
    ).toEqual([]);
    expect(
      validateComponentProps(
        { id: 't1', component: 'Text', text: { call: 'formatNumber', args: { value: 1 } } },
        TextComponentSchema.schema,
      ),
    ).toEqual([]);
  });

  it('Button 组件：checks 非法时拒绝', () => {
    const valid = {
      id: 'b1',
      component: 'Button',
      child: 'b1_label',
      action: { event: { name: 'submit' } },
    };
    expect(validateComponentProps(valid, ButtonComponentSchema.schema)).toEqual([]);
    const issues = validateComponentProps(
      { ...valid, checks: [{ condition: { path: '/x' }, message: 42 }] },
      ButtonComponentSchema.schema,
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it('Row 组件：children 数组或模板', () => {
    expect(
      validateComponentProps({ id: 'r1', component: 'Row', children: ['a', 'b'] }, RowComponentSchema.schema),
    ).toEqual([]);
    expect(
      validateComponentProps(
        { id: 'r1', component: 'Row', children: { componentId: 't', path: '/list' } },
        RowComponentSchema.schema,
      ),
    ).toEqual([]);
  });

  it('公共字段不参与校验', () => {
    expect(
      validateComponentProps({ id: 'x', component: 'Text', text: 'a', weight: 1 }, TextComponentSchema.schema),
    ).toEqual([]);
  });
});

describe('Catalog.validateComponent — catalog 感知校验', () => {
  const catalog = createFullCatalog();

  it('未注册组件报错', () => {
    const issues = catalog.validateComponent({ id: 'x', component: 'NoSuchComponent' });
    expect(issues.some((i) => i.message.includes('不在 catalog'))).toBe(true);
  });

  it('已注册组件属性校验', () => {
    expect(catalog.validateComponent({ id: 'x', component: 'Text', text: 'hi' })).toEqual([]);
    expect(catalog.validateComponent({ id: 'x', component: 'Text' }).some((i) => i.path === '/text')).toBe(true);
  });

  it('getFunctionCallableFrom 边界查询', () => {
    // openUrl 未声明 callableFrom → 按规范缺省为 rendererOnly（上游 #2157 仅声明 requiresUserActivation）
    expect(catalog.getFunctionCallableFrom('openUrl')).toBe('rendererOnly');
    expect(catalog.getFunctionCallableFrom('required')).toBe('rendererOnly');
    expect(catalog.getFunctionCallableFrom('noSuchFunction')).toBeUndefined();
  });

  it('openUrl 声明 requiresUserActivation（上游 #2157）', () => {
    const openUrl = catalog.getFunction('openUrl');
    expect(openUrl?.requiresUserActivation).toBe(true);
    expect(catalog.getFunction('formatNumber')?.requiresUserActivation).toBeFalsy();
  });

  it('requiresUserActivation 函数在无激活上下文执行被拒', () => {
    expect(() => catalog.executeFunction('openUrl', { url: 'https://example.com' })).toThrow(/user activation/);
    expect(() =>
      catalog.executeFunction(
        'openUrl',
        { url: 'https://example.com' },
        { isExecutingAction: true, actionIntent: 'activation' },
      ),
    ).not.toThrow();
  });
});
