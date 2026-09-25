import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { DataModel } from './data-model.js';
import { DataContext, MAX_DYNAMIC_VALUE_DEPTH } from './data-context.js';
import { MAX_FUNCTION_CALL_ARGS } from '../schema/common-types.js';
import { createBasicCatalog } from '../basic-catalog/index.js';

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

describe('DataContext 资源限额（CWE-400 / CWE-674）', () => {
  it('函数参数数量超过上限时返回 undefined', () => {
    const dataModel = new DataModel();
    const catalog = createBasicCatalog();
    const context = new DataContext({ dataModel, catalog });
    const args: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_FUNCTION_CALL_ARGS; i++) {
      args[`a${i}`] = i;
    }
    assert.equal(context.resolveDynamicValue({ call: 'required', args }), undefined);
  });

  it('深层嵌套函数调用不会栈溢出', () => {
    const dataModel = new DataModel();
    const catalog = createBasicCatalog();
    const context = new DataContext({ dataModel, catalog });
    let nested: unknown = { call: 'required', args: { value: 'x' } };
    for (let i = 0; i < MAX_DYNAMIC_VALUE_DEPTH * 5; i++) {
      nested = { call: 'required', args: { value: nested } };
    }
    assert.doesNotThrow(() => context.resolveDynamicValue(nested));
  });
});
