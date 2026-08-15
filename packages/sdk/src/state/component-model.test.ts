import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { ComponentModel } from './component-model.js';

describe('ComponentModel', () => {
  it('构造时设置 id 和 type', () => {
    const comp = new ComponentModel('c1', 'Button');
    assert.equal(comp.id, 'c1');
    assert.equal(comp.type, 'Button');
  });

  it('properties getter 返回深拷贝', () => {
    const original = { label: 'OK', style: { color: 'red' } };
    const comp = new ComponentModel('c1', 'Button', original);
    const props = comp.properties;
    // 修改返回值不应影响内部状态
    props.label = 'CANCEL';
    (props.style as Record<string, unknown>).color = 'blue';
    assert.deepEqual(comp.properties, { label: 'OK', style: { color: 'red' } });
  });

  it('properties setter 触发 onUpdated', () => {
    const comp = new ComponentModel('c1', 'Button', { label: 'OK' });
    const received: Array<{ componentId: string; properties: Record<string, unknown> }> = [];
    comp.onUpdated.subscribe((e) => received.push(e));
    comp.properties = { label: 'Submit' };
    assert.equal(received.length, 1);
    assert.equal(received[0].componentId, 'c1');
    assert.deepEqual(received[0].properties, { label: 'Submit' });
  });

  it('componentTree 包含 id/type/properties', () => {
    const comp = new ComponentModel('c2', 'Text', { text: 'hello' });
    const tree = comp.componentTree;
    assert.equal(tree.id, 'c2');
    assert.equal(tree.type, 'Text');
    assert.deepEqual(tree.properties, { text: 'hello' });
    // 返回深拷贝
    tree.properties.text = 'modified';
    assert.deepEqual(comp.properties, { text: 'hello' });
  });

  it('dispose 释放资源', () => {
    const comp = new ComponentModel('c1', 'Button');
    // dispose 后再 subscribe 应抛出
    comp.dispose();
    assert.throws(() => comp.onUpdated.subscribe(() => {}));
  });
});
