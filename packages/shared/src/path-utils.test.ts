import { describe, it, expect } from 'vite-plus/test';
import { resolvePath } from './path-utils.js';

describe('resolvePath', () => {
  it('解析简单路径', () => {
    const result = resolvePath({ path: '/user/name' }, { user: { name: 'Alice' } });
    expect(result).toBe('Alice');
  });

  it('解析嵌套路径', () => {
    const result = resolvePath({ path: '/a/b/c' }, { a: { b: { c: 42 } } });
    expect(result).toBe(42);
  });

  it('路径不存在返回 undefined', () => {
    const result = resolvePath({ path: '/missing' }, {});
    expect(result).toBeUndefined();
  });

  it('中间路径不存在返回 undefined', () => {
    const result = resolvePath({ path: '/a/b/c' }, { a: {} });
    expect(result).toBeUndefined();
  });

  it('支持无前导斜杠的路径', () => {
    const result = resolvePath({ path: 'user/name' }, { user: { name: 'Bob' } });
    expect(result).toBe('Bob');
  });
});
