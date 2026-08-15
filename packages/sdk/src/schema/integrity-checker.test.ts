import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  checkComponentIntegrity,
  checkFunctionCallDepth,
  validatePathSyntax,
  checkPathSyntax,
} from './integrity-checker.js';

type Comp = { id?: string; [key: string]: unknown };

describe('checkComponentIntegrity', () => {
  it('合法组件列表（含 root）→ 无错误', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['child-1'] },
      { id: 'child-1', component: 'Text', text: 'hello' },
    ];
    const errors = checkComponentIntegrity(components);
    assert.equal(errors.length, 0, `不应有错误，但得到: ${JSON.stringify(errors)}`);
  });

  it('ID 唯一性 → 重复 ID 报错', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['dup'] },
      { id: 'dup', component: 'Text', text: 'a' },
      { id: 'dup', component: 'Text', text: 'b' },
    ];
    const errors = checkComponentIntegrity(components);
    assert.ok(errors.some((e) => e.message.includes('重复')));
  });

  it('root 存在性 → 缺少 root 报错（默认）', () => {
    const components: Comp[] = [{ id: 'child-1', component: 'Text', text: 'hello' }];
    const errors = checkComponentIntegrity(components);
    assert.ok(errors.some((e) => e.message.includes('root')));
  });

  it('root 存在性 → allowMissingRoot 时不报错', () => {
    const components: Comp[] = [{ id: 'child-1', component: 'Text', text: 'hello' }];
    const errors = checkComponentIntegrity(components, { allowMissingRoot: true });
    const rootErrors = errors.filter((e) => e.message.includes('root'));
    assert.equal(rootErrors.length, 0);
  });

  it('悬空引用 → 引用的子组件不存在时报错', () => {
    const components: Comp[] = [{ id: 'root', component: 'Column', children: ['nonexistent'] }];
    const errors = checkComponentIntegrity(components);
    assert.ok(errors.some((e) => e.message.includes('悬空引用') || e.message.includes('不存在')));
  });

  it('缺少 id 字段 → 报错', () => {
    const components: Comp[] = [{ component: 'Text', text: 'no-id' }];
    const errors = checkComponentIntegrity(components);
    assert.ok(errors.some((e) => e.message.includes('id')));
  });
});

describe('checkFunctionCallDepth', () => {
  it('无函数调用 → 无错误', () => {
    const components: Comp[] = [{ id: 'root', component: 'Text', text: 'simple' }];
    const errors = checkFunctionCallDepth(components);
    assert.equal(errors.length, 0);
  });

  it('单层函数调用 → 无错误', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Text', text: { call: 'capitalize', args: { value: 'hello' } } },
    ];
    const errors = checkFunctionCallDepth(components);
    assert.equal(errors.length, 0);
  });

  it('超深函数调用嵌套 → 报错', () => {
    // 构造 7 层嵌套函数调用（超过 MAX_FUNC_CALL_DEPTH = 5）
    let deepCall: Record<string, unknown> = { call: 'f6', args: { value: 'x' } };
    for (let i = 5; i >= 0; i--) {
      deepCall = { call: `f${i}`, args: { value: deepCall } };
    }
    const components: Comp[] = [{ id: 'root', component: 'Text', text: deepCall }];
    const errors = checkFunctionCallDepth(components);
    assert.ok(errors.some((e) => e.message.includes('嵌套深度超过限制')));
  });
});

describe('validatePathSyntax', () => {
  it('合法路径 /a/b → true', () => {
    assert.equal(validatePathSyntax('/a/b'), true);
  });

  it('空路径 "" → true', () => {
    assert.equal(validatePathSyntax(''), true);
  });

  it('根路径 "/" → true', () => {
    assert.equal(validatePathSyntax('/'), true);
  });

  it('非法路径 a/b（不带前导斜杠）→ false', () => {
    assert.equal(validatePathSyntax('a/b'), false);
  });

  it('单段路径 /foo → true', () => {
    assert.equal(validatePathSyntax('/foo'), true);
  });

  it('深层路径 /a/b/c/d → true', () => {
    assert.equal(validatePathSyntax('/a/b/c/d'), true);
  });
});

describe('checkPathSyntax', () => {
  it('组件中合法路径 → 无错误', () => {
    const components: Comp[] = [{ id: 'root', component: 'TextField', value: { path: '/data/name' } }];
    const errors = checkPathSyntax(components);
    assert.equal(errors.length, 0);
  });

  it('组件中非法路径 → 报错', () => {
    const components: Comp[] = [{ id: 'root', component: 'TextField', value: { path: 'invalid/path' } }];
    const errors = checkPathSyntax(components);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.message.includes('无效的路径语法')));
  });

  it('组件中无路径字段 → 无错误', () => {
    const components: Comp[] = [{ id: 'root', component: 'Text', text: 'hello' }];
    const errors = checkPathSyntax(components);
    assert.equal(errors.length, 0);
  });
});
