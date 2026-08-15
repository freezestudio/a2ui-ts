import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { parsePointer, serializePointer, normalizePath, getParentPath, isAncestorPath } from './path-utils.js';

describe('parsePointer', () => {
  it("'' → []", () => {
    assert.deepEqual(parsePointer(''), []);
  });

  it("'/' → []", () => {
    assert.deepEqual(parsePointer('/'), []);
  });

  it("'/a/b/c' → ['a', 'b', 'c']", () => {
    assert.deepEqual(parsePointer('/a/b/c'), ['a', 'b', 'c']);
  });

  it("转义: '/a~0b' → ['a~b']（~0 还原为 ~）", () => {
    assert.deepEqual(parsePointer('/a~0b'), ['a~b']);
  });

  it("转义: '/a~1b' → ['a/b']（~1 还原为 /）", () => {
    assert.deepEqual(parsePointer('/a~1b'), ['a/b']);
  });
});

describe('serializePointer', () => {
  it("[] → ''", () => {
    assert.equal(serializePointer([]), '');
  });

  it("['a', 'b'] → '/a/b'", () => {
    assert.equal(serializePointer(['a', 'b']), '/a/b');
  });

  it("反向转义: ['a~b'] → '/a~0b'", () => {
    assert.equal(serializePointer(['a~b']), '/a~0b');
  });

  it("反向转义: ['a/b'] → '/a~1b'", () => {
    assert.equal(serializePointer(['a/b']), '/a~1b');
  });
});

describe('normalizePath', () => {
  it("'' → ''", () => {
    assert.equal(normalizePath(''), '');
  });

  it("'/' → ''", () => {
    assert.equal(normalizePath('/'), '');
  });

  it("'a/b' → '/a/b'", () => {
    assert.equal(normalizePath('a/b'), '/a/b');
  });

  it("'/a/b' → '/a/b'", () => {
    assert.equal(normalizePath('/a/b'), '/a/b');
  });
});

describe('getParentPath', () => {
  it("'/a/b/c' → '/a/b'", () => {
    assert.equal(getParentPath('/a/b/c'), '/a/b');
  });

  it("'/a' → ''", () => {
    assert.equal(getParentPath('/a'), '');
  });

  it("'' → ''", () => {
    assert.equal(getParentPath(''), '');
  });
});

describe('isAncestorPath', () => {
  it("'' 是 '/a' 的祖先", () => {
    assert.equal(isAncestorPath('', '/a'), true);
  });

  it("'/a' 是 '/a/b' 的祖先", () => {
    assert.equal(isAncestorPath('/a', '/a/b'), true);
  });

  it("'/a' 不是 '/b' 的祖先", () => {
    assert.equal(isAncestorPath('/a', '/b'), false);
  });

  it("'' 不是 '' 的祖先", () => {
    assert.equal(isAncestorPath('', ''), false);
  });
});
