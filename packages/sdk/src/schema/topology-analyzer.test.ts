import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { extractRefFields, analyzeTopology } from './topology-analyzer.js';

type Comp = { id?: string; [key: string]: unknown };

describe('extractRefFields', () => {
  it('从组件列表提取引用映射', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['child-1', 'child-2'] },
      { id: 'child-1', component: 'Text', text: 'hello' },
      { id: 'child-2', component: 'Button', child: 'child-1' },
    ];
    const refs = extractRefFields(components);
    assert.ok('root' in refs);
    assert.ok('child-1' in refs);
    assert.ok('child-2' in refs);
    // root 的 children 字段包含子组件引用
    assert.ok(refs['root'].children);
    assert.deepEqual(refs['root'].children, ['child-1', 'child-2']);
  });

  it('跳过没有 id 的组件', () => {
    const components: Comp[] = [{ component: 'Text', text: 'no-id' }];
    const refs = extractRefFields(components);
    assert.equal(Object.keys(refs).length, 0);
  });

  it('提取带 componentId 的对象引用', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: [{ componentId: 'child-1', path: '/items' }] },
      { id: 'child-1', component: 'Text', text: 'hello' },
    ];
    const refs = extractRefFields(components);
    assert.ok(refs['root'].children);
    assert.deepEqual(refs['root'].children, ['child-1']);
  });
});

describe('analyzeTopology', () => {
  it('简单树结构（root → children）→ 全部可达', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['a', 'b'] },
      { id: 'a', component: 'Text' },
      { id: 'b', component: 'Text' },
    ];
    const refFields = extractRefFields(components);
    const { reachable, errors } = analyzeTopology(components, refFields);
    assert.equal(errors.length, 0, `不应有错误，但得到: ${JSON.stringify(errors)}`);
    assert.ok(reachable.has('root'));
    assert.ok(reachable.has('a'));
    assert.ok(reachable.has('b'));
  });

  it('循环引用检测 → 报错', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['a'] },
      { id: 'a', component: 'Row', children: ['root'] },
    ];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.message.includes('循环引用')));
  });

  it('自引用检测 → 报错', () => {
    const components: Comp[] = [{ id: 'root', component: 'Column', children: ['root'] }];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.message.includes('自引用')));
  });

  it('孤立组件检测 → allowOrphanComponents: false 时报错', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['a'] },
      { id: 'a', component: 'Text' },
      { id: 'orphan', component: 'Text' },
    ];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields, { allowOrphanComponents: false });
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => e.message.includes('孤立')));
  });

  it('孤立组件检测 → allowOrphanComponents: true 时不报错', () => {
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['a'] },
      { id: 'a', component: 'Text' },
      { id: 'orphan', component: 'Text' },
    ];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields, { allowOrphanComponents: true });
    const orphanErrors = errors.filter((e) => e.message.includes('孤立'));
    assert.equal(orphanErrors.length, 0);
  });

  it('缺失 root → allowMissingRoot: false 时报错', () => {
    const components: Comp[] = [{ id: 'a', component: 'Text' }];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields, { allowMissingRoot: false });
    assert.ok(errors.some((e) => e.message.includes('root')));
  });

  it('缺失 root → allowMissingRoot: true 时不报该错', () => {
    const components: Comp[] = [{ id: 'a', component: 'Text' }];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields, { allowMissingRoot: true, allowOrphanComponents: true });
    const rootErrors = errors.filter((e) => e.message.includes('缺少根组件'));
    assert.equal(rootErrors.length, 0);
  });

  it('深度超限 → 报错', () => {
    // 构造深层嵌套：root → d1 → d2 → d3，maxDepth=2
    const components: Comp[] = [
      { id: 'root', component: 'Column', children: ['d1'] },
      { id: 'd1', component: 'Row', children: ['d2'] },
      { id: 'd2', component: 'Row', children: ['d3'] },
      { id: 'd3', component: 'Text' },
    ];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields, { maxDepth: 2 });
    assert.ok(errors.some((e) => e.message.includes('深度超过限制')));
  });

  it('悬空引用 → 报错', () => {
    const components: Comp[] = [{ id: 'root', component: 'Column', children: ['ghost'] }];
    const refFields = extractRefFields(components);
    const { errors } = analyzeTopology(components, refFields);
    assert.ok(errors.some((e) => e.message.includes('悬空引用') || e.message.includes('不存在')));
  });
});
