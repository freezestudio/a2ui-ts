import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { DataModel } from './data-model.js';
import { DataContext } from './data-context.js';

function createContext(initial: Record<string, unknown>): { dataModel: DataModel; context: DataContext } {
  const dataModel = new DataModel();
  dataModel.set('', initial);
  return { dataModel, context: new DataContext({ dataModel }) };
}

describe('DataContext 插值字符串求值', () => {
  it('求值 ${path} 插值', () => {
    const { context } = createContext({ name: 'Alice' });
    assert.equal(context.resolveDynamicValue('你好 ${/name}！'), '你好 Alice！');
  });

  it('多段插值混合字面量', () => {
    const { context } = createContext({ first: 'Alice', last: 'Wang' });
    assert.equal(context.resolveDynamicValue('${/first} ${/last}'), 'Alice Wang');
  });

  it('不存在的路径插值为空串', () => {
    const { context } = createContext({});
    assert.equal(context.resolveDynamicValue('值: ${/missing}'), '值: ');
  });

  it('普通字符串不受影响', () => {
    const { context } = createContext({});
    assert.equal(context.resolveDynamicValue('plain text'), 'plain text');
  });

  it('嵌套 ${path} 在对象属性内求值', () => {
    const { context } = createContext({ name: 'Alice' });
    const resolved = context.resolveDynamicValue({ label: 'Hi ${/name}' }) as Record<string, unknown>;
    assert.equal(resolved['label'], 'Hi Alice');
  });
});

describe('DataContext 插值字符串订阅', () => {
  it('订阅插值引用的路径变化', () => {
    const { dataModel, context } = createContext({ temp: 25 });
    const events: unknown[] = [];
    const sub = context.subscribeDynamicValue('温度 ${/temp}°C', (event) => {
      events.push(event.value);
    });

    // 初始回调
    assert.equal(events.length, 1);
    assert.equal(events[0], '温度 25°C');

    // 数据变化触发重新求值
    dataModel.set('/temp', 30);
    assert.equal(events.length, 2);
    assert.equal(events[1], '温度 30°C');

    sub.unsubscribe();
    dataModel.set('/temp', 35);
    assert.equal(events.length, 2);
  });
});
