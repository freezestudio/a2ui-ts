import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  DataBindingSchema,
  FunctionCallSchema,
  DynamicValueSchema,
  DynamicStringSchema,
  ChildListSchema,
  ActionSchema,
  CheckRuleSchema,
  ValidationResultSchema,
  FunctionResponseSchema,
  AccessibilityAttributesSchema,
  isDataBinding,
  isFunctionCall,
  isTemplateChildList,
} from './common-types.js';

describe('common-types', () => {
  // ==========================================================================
  // DataBindingSchema
  // ==========================================================================
  describe('DataBindingSchema', () => {
    it('应解析合法的 {path: "/user/name"}', () => {
      const result = DataBindingSchema.parse({ path: '/user/name' });
      assert.deepEqual(result, { path: '/user/name' });
    });

    it('应拒绝缺少 path 的对象', () => {
      assert.throws(() => DataBindingSchema.parse({}));
    });

    it('应拒绝额外属性（strict 模式）', () => {
      assert.throws(() => DataBindingSchema.parse({ path: '/x', extra: 'field' }));
    });

    it('应拒绝非字符串 path', () => {
      assert.throws(() => DataBindingSchema.parse({ path: 123 }));
    });
  });

  // ==========================================================================
  // FunctionCallSchema
  // ==========================================================================
  describe('FunctionCallSchema', () => {
    it('应解析 {call: "foo", args: {x: 1}}', () => {
      const result = FunctionCallSchema.parse({ call: 'foo', args: { x: 1 } });
      assert.equal(result.call, 'foo');
      assert.deepEqual(result.args, { x: 1 });
    });

    it('应允许省略 args', () => {
      const result = FunctionCallSchema.parse({ call: 'bar' });
      assert.equal(result.call, 'bar');
      assert.equal(result.args, undefined);
    });

    it('args 应支持 DataBinding 作为值', () => {
      const result = FunctionCallSchema.parse({
        call: 'fn',
        args: { ref: { path: '/data' } },
      });
      assert.deepEqual(result.args, { ref: { path: '/data' } });
    });
  });

  // ==========================================================================
  // DynamicValueSchema
  // ==========================================================================
  describe('DynamicValueSchema', () => {
    it('应接受字符串', () => {
      assert.equal(DynamicValueSchema.parse('hello'), 'hello');
    });

    it('应接受数字', () => {
      assert.equal(DynamicValueSchema.parse(42), 42);
    });

    it('应接受布尔值', () => {
      assert.equal(DynamicValueSchema.parse(true), true);
    });

    it('应接受数组', () => {
      const result = DynamicValueSchema.parse([1, 'a', true]);
      assert.deepEqual(result, [1, 'a', true]);
    });

    it('应接受普通 object 字面量（v1.0 #2229）', () => {
      const obj = { spec: { data: { values: [] } }, title: 'chart' };
      const result = DynamicValueSchema.parse(obj);
      assert.deepEqual(result, obj);
    });

    it('应拒绝 object 字面量中包含 path（#2229 歧义防护）', () => {
      assert.throws(() => DynamicValueSchema.parse({ path: '/x', extra: 1 }));
    });

    it('含 call 的对象应匹配 FunctionCall 分支（合法）', () => {
      const result = DynamicValueSchema.parse({ call: 'fn', args: { x: 1 } });
      assert.equal((result as { call: string }).call, 'fn');
    });

    it('应接受 DataBinding', () => {
      const result = DynamicValueSchema.parse({ path: '/x' });
      assert.deepEqual(result, { path: '/x' });
    });

    it('应接受 FunctionCall', () => {
      const result = DynamicValueSchema.parse({ call: 'fn', args: { x: 1 } });
      assert.equal((result as { call: string }).call, 'fn');
    });
  });

  // ==========================================================================
  // DynamicStringSchema
  // ==========================================================================
  describe('DynamicStringSchema', () => {
    it('应接受字符串字面量', () => {
      assert.equal(DynamicStringSchema.parse('text'), 'text');
    });

    it('应接受 DataBinding', () => {
      const result = DynamicStringSchema.parse({ path: '/name' });
      assert.deepEqual(result, { path: '/name' });
    });

    it('应接受 FunctionCall', () => {
      const result = DynamicStringSchema.parse({ call: 'getName' });
      assert.equal((result as { call: string }).call, 'getName');
    });
  });

  // ==========================================================================
  // ChildListSchema
  // ==========================================================================
  describe('ChildListSchema', () => {
    it('应接受字符串数组', () => {
      const result = ChildListSchema.parse(['a', 'b']);
      assert.deepEqual(result, ['a', 'b']);
    });

    it('应接受 TemplateChildList 对象', () => {
      const result = ChildListSchema.parse({ componentId: 'tpl', path: '/items' });
      assert.deepEqual(result, { componentId: 'tpl', path: '/items' });
    });

    it('应拒绝非数组非对象', () => {
      assert.throws(() => ChildListSchema.parse(123));
    });

    it('TemplateChildList 应拒绝额外属性（strict）', () => {
      assert.throws(() => ChildListSchema.parse({ componentId: 'tpl', path: '/items', extra: 1 }));
    });
  });

  // ==========================================================================
  // AccessibilityAttributesSchema（v1.0 #2209：live/hidden）
  // ==========================================================================
  describe('AccessibilityAttributesSchema', () => {
    it('应解析仅含 label/description 的合法属性', () => {
      const result = AccessibilityAttributesSchema.parse({ label: '登录', description: '请输入用户名' });
      assert.deepEqual(result, { label: '登录', description: '请输入用户名' });
    });

    it('应解析 live 枚举值（off/polite/assertive）', () => {
      for (const live of ['off', 'polite', 'assertive'] as const) {
        const result = AccessibilityAttributesSchema.parse({ live });
        assert.equal(result.live, live);
      }
    });

    it('应拒绝非法 live 值', () => {
      assert.throws(() => AccessibilityAttributesSchema.parse({ live: 'loud' }));
    });

    it('应解析 hidden 动态布尔（字面量/数据绑定/函数调用）', () => {
      assert.equal(AccessibilityAttributesSchema.parse({ hidden: true }).hidden, true);
      assert.deepEqual(AccessibilityAttributesSchema.parse({ hidden: { path: '/ui/hidden' } }).hidden, {
        path: '/ui/hidden',
      });
      assert.deepEqual(
        AccessibilityAttributesSchema.parse({ hidden: { call: 'shouldHide', args: { id: 1 } } }).hidden,
        { call: 'shouldHide', args: { id: 1 } },
      );
    });

    it('应拒绝非法 hidden 值（数字等）', () => {
      assert.throws(() => AccessibilityAttributesSchema.parse({ hidden: 42 }));
    });

    it('应拒绝未知属性（strict 语义）', () => {
      assert.throws(() => AccessibilityAttributesSchema.parse({ focus: 'auto' }));
    });
  });

  // ==========================================================================
  // ActionSchema
  // ==========================================================================
  describe('ActionSchema', () => {
    it('应接受 event 形式', () => {
      const action = { event: { name: 'click' } };
      const result = ActionSchema.parse(action);
      assert.equal((result as { event: { name: string } }).event.name, 'click');
    });

    it('应接受带 context 的 event 形式', () => {
      const action = { event: { name: 'submit', context: { id: '123' } } };
      const result = ActionSchema.parse(action);
      assert.equal((result as { event: { name: string } }).event.name, 'submit');
    });

    it('应接受带 userMessage 的 event 形式（v1.0 #2228）', () => {
      const action = { event: { name: 'submit', userMessage: '提交表单' } };
      const result = ActionSchema.parse(action);
      assert.equal((result as { event: { userMessage: string } }).event.userMessage, '提交表单');
    });

    it('应接受 functionCall 形式', () => {
      const action = { functionCall: { call: 'doSomething', args: { key: 'val' } } };
      const result = ActionSchema.parse(action);
      assert.equal((result as { functionCall: { call: string } }).functionCall.call, 'doSomething');
    });

    it('应拒绝同时包含 event 和 functionCall（strict）', () => {
      assert.throws(() =>
        ActionSchema.parse({
          event: { name: 'x' },
          functionCall: { call: 'y' },
        }),
      );
    });

    it('应拒绝空对象', () => {
      assert.throws(() => ActionSchema.parse({}));
    });
  });

  // ==========================================================================
  // CheckRuleSchema（v1.0 #2220：condition 为 DataBinding/FunctionCall，message 可选）
  // ==========================================================================
  describe('CheckRuleSchema', () => {
    it('应解析合法校验规则（FunctionCall condition，无 message）', () => {
      const rule = { condition: { call: 'required', args: { value: { path: '/name' } } } };
      const result = CheckRuleSchema.parse(rule);
      assert.deepEqual(result, rule);
    });

    it('condition 应接受 DataBinding', () => {
      const rule = { condition: { path: '/required' }, message: '必填' };
      const result = CheckRuleSchema.parse(rule);
      assert.deepEqual(result.condition, { path: '/required' });
    });

    it('message 为可选（#2220 fallback）', () => {
      const result = CheckRuleSchema.parse({ condition: { call: 'required', args: {} } });
      assert.equal(result.message, undefined);
    });

    it('应拒绝 boolean 字面量 condition（#2220 移除）', () => {
      assert.throws(() => CheckRuleSchema.parse({ condition: true }));
    });

    it('应拒绝额外属性（strict）', () => {
      assert.throws(() => CheckRuleSchema.parse({ condition: { path: '/x' }, message: 'err', extra: 1 }));
    });
  });

  // ==========================================================================
  // ValidationResultSchema（v1.0 #2220 新增）
  // ==========================================================================
  describe('ValidationResultSchema', () => {
    it('应解析最小结构 {valid: true}', () => {
      const result = ValidationResultSchema.parse({ valid: true });
      assert.equal(result.valid, true);
    });

    it('应解析完整结构（code/message/severity）', () => {
      const result = ValidationResultSchema.parse({
        valid: false,
        code: 'OUT_OF_RANGE',
        message: '数值超出范围',
        severity: 'warning',
      });
      assert.equal(result.code, 'OUT_OF_RANGE');
      assert.equal(result.severity, 'warning');
    });

    it('应拒绝缺少 valid', () => {
      assert.throws(() => ValidationResultSchema.parse({ message: 'err' }));
    });

    it('应拒绝非法 severity', () => {
      assert.throws(() => ValidationResultSchema.parse({ valid: true, severity: 'loud' }));
    });
  });

  // ==========================================================================
  // FunctionResponseSchema（v1.0 #2210 双向函数调用）
  // ==========================================================================
  describe('FunctionResponseSchema', () => {
    it('应解析带 value 的响应', () => {
      const result = FunctionResponseSchema.parse({ functionCallId: 'c1', value: 42 });
      assert.equal(result.value, 42);
    });

    it('应解析带 error 的响应', () => {
      const result = FunctionResponseSchema.parse({
        functionCallId: 'c1',
        error: { code: 'FAIL', message: '失败' },
      });
      assert.equal((result.error as { code: string }).code, 'FAIL');
    });

    it('应拒绝缺少 functionCallId', () => {
      assert.throws(() => FunctionResponseSchema.parse({ value: 1 }));
    });

    it('应拒绝 value 与 error 同时存在', () => {
      assert.throws(() =>
        FunctionResponseSchema.parse({ functionCallId: 'c1', value: 1, error: { code: 'E', message: 'm' } }),
      );
    });

    it('应拒绝 value 与 error 都缺失', () => {
      assert.throws(() => FunctionResponseSchema.parse({ functionCallId: 'c1' }));
    });
  });

  // ==========================================================================
  // 工具函数
  // ==========================================================================
  describe('isDataBinding', () => {
    it('应为 {path: "/x"} 返回 true', () => {
      assert.equal(isDataBinding({ path: '/x' }), true);
    });

    it('应为 FunctionCall 返回 false', () => {
      assert.equal(isDataBinding({ call: 'fn' }), false);
    });

    it('应为 null 返回 false', () => {
      assert.equal(isDataBinding(null), false);
    });

    it('应为 undefined 返回 false', () => {
      assert.equal(isDataBinding(undefined), false);
    });

    it('应为字符串返回 false', () => {
      assert.equal(isDataBinding('hello'), false);
    });

    it('应为同时包含 path 和 call 的对象返回 false', () => {
      assert.equal(isDataBinding({ path: '/x', call: 'fn' }), false);
    });
  });

  describe('isFunctionCall', () => {
    it('应为 {call: "fn"} 返回 true', () => {
      assert.equal(isFunctionCall({ call: 'fn' }), true);
    });

    it('应为 DataBinding 返回 false', () => {
      assert.equal(isFunctionCall({ path: '/x' }), false);
    });

    it('应为 null 返回 false', () => {
      assert.equal(isFunctionCall(null), false);
    });

    it('应为同时包含 call 和 path 的对象返回 false', () => {
      assert.equal(isFunctionCall({ call: 'fn', path: '/x' }), false);
    });

    it('应为数字返回 false', () => {
      assert.equal(isFunctionCall(42), false);
    });
  });

  describe('isTemplateChildList', () => {
    it('应为 {componentId, path} 返回 true', () => {
      assert.equal(isTemplateChildList({ componentId: 'tpl', path: '/items' }), true);
    });

    it('应为字符串数组返回 false', () => {
      assert.equal(isTemplateChildList(['a', 'b']), false);
    });

    it('应为 null 返回 false', () => {
      assert.equal(isTemplateChildList(null), false);
    });

    it('应为缺少 path 返回 false', () => {
      assert.equal(isTemplateChildList({ componentId: 'tpl' }), false);
    });

    it('应为缺少 componentId 返回 false', () => {
      assert.equal(isTemplateChildList({ path: '/items' }), false);
    });
  });
});
