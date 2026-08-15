import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { Subscription, EventSource, Signal, A2uiAbortSignal } from './events.js';

describe('Subscription', () => {
  it('创建后 cancelled = false', () => {
    const sub = new Subscription(() => {});
    assert.equal(sub.cancelled, false);
  });

  it('unsubscribe() 后 cancelled = true', () => {
    const sub = new Subscription(() => {});
    sub.unsubscribe();
    assert.equal(sub.cancelled, true);
  });

  it('多次 unsubscribe() 幂等', () => {
    let callCount = 0;
    const sub = new Subscription(() => {
      callCount++;
    });
    sub.unsubscribe();
    sub.unsubscribe();
    sub.unsubscribe();
    assert.equal(sub.cancelled, true);
    assert.equal(callCount, 1);
  });
});

describe('EventSource', () => {
  it('subscribe 后 emit 触发 handler', () => {
    const source = new EventSource<string>();
    const received: string[] = [];
    source.subscribe((v) => received.push(v));
    source.emit('hello');
    assert.deepEqual(received, ['hello']);
  });

  it('unsubscribe 后 emit 不触发', () => {
    const source = new EventSource<string>();
    const received: string[] = [];
    const sub = source.subscribe((v) => received.push(v));
    sub.unsubscribe();
    source.emit('hello');
    assert.deepEqual(received, []);
  });

  it('多个 handler 都被调用', () => {
    const source = new EventSource<number>();
    const results: number[] = [];
    source.subscribe((v) => results.push(v * 1));
    source.subscribe((v) => results.push(v * 2));
    source.emit(10);
    assert.deepEqual(results, [10, 20]);
  });

  it('listenerCount / hasListeners 正确', () => {
    const source = new EventSource<void>();
    assert.equal(source.listenerCount, 0);
    assert.equal(source.hasListeners, false);

    const sub1 = source.subscribe(() => {});
    assert.equal(source.listenerCount, 1);
    assert.equal(source.hasListeners, true);

    const sub2 = source.subscribe(() => {});
    assert.equal(source.listenerCount, 2);

    sub1.unsubscribe();
    assert.equal(source.listenerCount, 1);

    sub2.unsubscribe();
    assert.equal(source.listenerCount, 0);
    assert.equal(source.hasListeners, false);
  });

  it('dispose 后清空监听器', () => {
    const source = new EventSource<string>();
    const received: string[] = [];
    source.subscribe((v) => received.push(v));
    source.dispose();
    assert.equal(source.listenerCount, 0);
    assert.equal(source.hasListeners, false);
    // emit 不应再触发
    source.emit('hello');
    assert.deepEqual(received, []);
  });
});

describe('Signal', () => {
  it('构造时设置初始值', () => {
    const signal = new Signal(42);
    assert.equal(signal.value, 42);
  });

  it('value getter/setter 正确', () => {
    const signal = new Signal(0);
    signal.value = 10;
    assert.equal(signal.value, 10);
  });

  it('set 相同值不触发通知（!= 比较）', () => {
    const signal = new Signal(5);
    const received: number[] = [];
    signal.onValueChanged((v) => received.push(v));
    signal.value = 5;
    assert.deepEqual(received, []);
  });

  it('set 不同值触发通知', () => {
    const signal = new Signal(5);
    const received: number[] = [];
    signal.onValueChanged((v) => received.push(v));
    signal.value = 10;
    assert.deepEqual(received, [10]);
  });

  it('subscribe 立即返回当前值', () => {
    const signal = new Signal(99);
    const received: number[] = [];
    signal.subscribe((v) => received.push(v));
    assert.deepEqual(received, [99]);
  });

  it('onValueChanged 不立即返回当前值', () => {
    const signal = new Signal(99);
    const received: number[] = [];
    signal.onValueChanged((v) => received.push(v));
    assert.deepEqual(received, []);
  });

  it('peek 不触发订阅', () => {
    const signal = new Signal(42);
    const received: number[] = [];
    signal.onValueChanged((v) => received.push(v));
    const val = signal.peek();
    assert.equal(val, 42);
    assert.deepEqual(received, []);
  });
});

describe('A2uiAbortSignal', () => {
  it('初始 aborted = false', () => {
    const signal = new A2uiAbortSignal();
    assert.equal(signal.aborted, false);
  });

  it('abort() 后 aborted = true', () => {
    const signal = new A2uiAbortSignal();
    signal.abort();
    assert.equal(signal.aborted, true);
  });

  it('addEventListener("abort") 在 abort 前注册，触发', () => {
    const signal = new A2uiAbortSignal();
    let called = false;
    signal.addEventListener('abort', () => {
      called = true;
    });
    signal.abort();
    assert.equal(called, true);
  });

  it('addEventListener("abort") 在 abort 后注册，立即触发', () => {
    const signal = new A2uiAbortSignal();
    signal.abort();
    let called = false;
    signal.addEventListener('abort', () => {
      called = true;
    });
    assert.equal(called, true);
  });
});
