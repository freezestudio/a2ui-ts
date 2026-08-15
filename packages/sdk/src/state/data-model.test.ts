import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { DataModel } from './data-model.js';

describe('DataModel get/set', () => {
  it('设置根路径 get("") → 整个对象', () => {
    const model = new DataModel();
    model.set('', { a: 1, b: 2 });
    assert.deepEqual(model.get(''), { a: 1, b: 2 });
  });

  it('设置嵌套路径 set("/user/name", "Alice") → get("/user/name") === "Alice"', () => {
    const model = new DataModel();
    model.set('/user/name', 'Alice');
    assert.equal(model.get('/user/name'), 'Alice');
  });

  it('设置深层路径 auto-vivification', () => {
    const model = new DataModel();
    model.set('/a/b/c', 'deep');
    assert.equal(model.get('/a/b/c'), 'deep');
    assert.deepEqual(model.get('/a/b'), { c: 'deep' });
    assert.deepEqual(model.get('/a'), { b: { c: 'deep' } });
  });

  it('删除路径 set("/x", undefined) → get("/x") === undefined', () => {
    const model = new DataModel();
    model.set('/x', 'hello');
    assert.equal(model.get('/x'), 'hello');
    model.set('/x', undefined);
    assert.equal(model.get('/x'), undefined);
  });

  it('设置数组路径 set("/items/0", "a")', () => {
    const model = new DataModel();
    model.set('/items/0', 'a');
    assert.equal(model.get('/items/0'), 'a');
    assert.ok(Array.isArray(model.get('/items')));
  });
});

describe('DataModel hasPath', () => {
  it('存在路径 → true', () => {
    const model = new DataModel();
    model.set('/a/b', 1);
    assert.equal(model.hasPath('/a/b'), true);
  });

  it('不存在 → false', () => {
    const model = new DataModel();
    assert.equal(model.hasPath('/x/y'), false);
  });
});

describe('DataModel subscribe', () => {
  it('订阅路径变化，set 时触发', () => {
    const model = new DataModel();
    const received: Array<{ path: string; value: unknown }> = [];
    model.subscribe('/a', (e) => received.push(e));
    // subscribe 立即触发一次
    model.set('/a', 42);
    // 第一次是初始值（undefined），第二次是 set 的值
    assert.equal(received.length, 2);
    assert.deepEqual(received[0], { path: '/a', value: undefined });
    assert.deepEqual(received[1], { path: '/a', value: 42 });
  });

  it('subscribe 立即返回当前值', () => {
    const model = new DataModel();
    model.set('/x', 'hello');
    const received: Array<{ path: string; value: unknown }> = [];
    model.subscribe('/x', (e) => received.push(e));
    assert.deepEqual(received, [{ path: '/x', value: 'hello' }]);
  });

  it('unsubscribe 后不再触发', () => {
    const model = new DataModel();
    const received: Array<{ path: string; value: unknown }> = [];
    const sub = model.subscribe('/a', (e) => received.push(e));
    sub.unsubscribe();
    model.set('/a', 99);
    // 只有 subscribe 时的初始触发
    assert.equal(received.length, 1);
  });

  it('级联通知：修改 "/a/b" 时订阅 "/a" 也收到通知', () => {
    const model = new DataModel();
    const received: Array<{ path: string; value: unknown }> = [];
    model.subscribe('/a', (e) => received.push(e));
    model.set('/a/b', 'nested');
    // 第一次：subscribe 初始值
    // 第二次：冒泡通知（path='/a/b' 冒到订阅路径 '/a'）
    assert.ok(received.length >= 2);
    // 冒泡通知的 event.path 是原始变更路径
    const lastEvent = received[received.length - 1];
    assert.equal(lastEvent.path, '/a/b');
    // 订阅 "/a" 的 handler 收到了通知
    const notified = received.filter((e) => e !== received[0]);
    assert.ok(notified.length > 0);
  });

  it('级联通知：修改 "/a" 时订阅 "/a/b" 也收到通知', () => {
    const model = new DataModel();
    model.set('/a/b', 'old');
    const received: Array<{ path: string; value: unknown }> = [];
    model.subscribe('/a/b', (e) => received.push(e));
    // 初始值触发一次
    assert.equal(received.length, 1);
    // 修改父路径
    model.set('/a', { b: 'new' });
    // 应收到级联通知
    assert.equal(received.length, 2);
    assert.deepEqual(received[1], { path: '/a/b', value: 'new' });
  });
});
