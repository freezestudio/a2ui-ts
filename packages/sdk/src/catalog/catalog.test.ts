import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Catalog } from './catalog.js';
import type { ComponentApi, FunctionApi } from './types.js';

// 辅助工厂：创建测试用组件
function makeComponent(name: string, description?: string): ComponentApi {
  return {
    name,
    description,
    schema: { type: 'object', properties: { id: { type: 'string' } } },
  };
}

// 辅助工厂：创建测试用函数
function makeFunction(name: string): FunctionApi {
  return {
    name,
    parameters: { type: 'object', properties: {} },
  };
}

// 辅助工厂：创建含 execute 的函数
function makeExecutableFunction(name: string): FunctionApi {
  return {
    name,
    parameters: { type: 'object', properties: {} },
    execute: (args) => args.value,
  };
}

function createTestCatalog(): Catalog {
  return new Catalog({
    catalogId: 'test-catalog',
    version: 'v1_0',
    components: [makeComponent('Text'), makeComponent('Button'), makeComponent('Row')],
    functions: [makeExecutableFunction('capitalize'), makeFunction('noop')],
  });
}

describe('Catalog', () => {
  describe('构造', () => {
    it('正确设置 catalogId 和 version', () => {
      const catalog = createTestCatalog();
      assert.equal(catalog.catalogId, 'test-catalog');
      assert.equal(catalog.version, 'v1_0');
    });

    it('componentCount 反映组件数量', () => {
      const catalog = createTestCatalog();
      assert.equal(catalog.componentCount, 3);
    });

    it('functionCount 反映函数数量', () => {
      const catalog = createTestCatalog();
      assert.equal(catalog.functionCount, 2);
    });

    it('空组件和函数列表', () => {
      const catalog = new Catalog({ catalogId: 'empty', version: 'v1', components: [], functions: [] });
      assert.equal(catalog.componentCount, 0);
      assert.equal(catalog.functionCount, 0);
    });
  });

  describe('组件访问', () => {
    it('getComponent 返回已注册的组件', () => {
      const catalog = createTestCatalog();
      const comp = catalog.getComponent('Text');
      assert.ok(comp);
      assert.equal(comp!.name, 'Text');
    });

    it('getComponent 对未注册的组件返回 undefined', () => {
      const catalog = createTestCatalog();
      assert.equal(catalog.getComponent('Unknown'), undefined);
    });

    it('getComponentNames 返回所有组件名称', () => {
      const catalog = createTestCatalog();
      const names = catalog.getComponentNames();
      assert.deepEqual(names, ['Text', 'Button', 'Row']);
    });

    it('getComponents 返回 Map', () => {
      const catalog = createTestCatalog();
      const map = catalog.getComponents();
      assert.ok(map instanceof Map);
      assert.equal(map.size, 3);
    });
  });

  describe('函数访问', () => {
    it('getFunction 按精确名称获取', () => {
      const catalog = createTestCatalog();
      const fn = catalog.getFunction('capitalize');
      assert.ok(fn);
      assert.equal(fn!.name, 'capitalize');
    });

    it('getFunction 支持大小写容错', () => {
      const catalog = createTestCatalog();
      const fn = catalog.getFunction('CAPITALIZE');
      assert.ok(fn);
      assert.equal(fn!.name, 'capitalize');
    });

    it('getFunction 对未注册的函数返回 undefined', () => {
      const catalog = createTestCatalog();
      assert.equal(catalog.getFunction('nonexistent'), undefined);
    });

    it('getFunctionNames 返回所有函数名称', () => {
      const catalog = createTestCatalog();
      const names = catalog.getFunctionNames();
      assert.equal(names.length, 2);
      assert.ok(names.includes('capitalize'));
      assert.ok(names.includes('noop'));
    });

    it('getFunctions 返回函数数组', () => {
      const catalog = createTestCatalog();
      const fns = catalog.getFunctions();
      assert.equal(fns.length, 2);
    });
  });

  describe('函数执行', () => {
    it('executeFunction 正常调用', () => {
      const catalog = createTestCatalog();
      const result = catalog.executeFunction('capitalize', { value: 'hello' });
      assert.equal(result, 'hello');
    });

    it('executeFunction 大小写容错调用', () => {
      const catalog = createTestCatalog();
      const result = catalog.executeFunction('Capitalize', { value: 'test' });
      assert.equal(result, 'test');
    });

    it('executeFunction 未找到时抛错', () => {
      const catalog = createTestCatalog();
      assert.throws(() => catalog.executeFunction('nonexistent', {}), /函数未找到/);
    });

    it('executeFunction 无实现时抛错', () => {
      const catalog = createTestCatalog();
      assert.throws(() => catalog.executeFunction('noop', {}), /没有执行实现/);
    });

    it('executeFunction 校验 argsSchema（合法参数通过）', () => {
      const catalog = new Catalog({
        catalogId: 'test-catalog',
        version: 'v1_0',
        components: [],
        functions: [
          {
            name: 'withArgs',
            parameters: { type: 'object', properties: { count: { type: 'number' } } },
            argsSchema: z.object({ count: z.number() }),
            execute: (args) => args['count'],
          },
        ],
      });
      const result = catalog.executeFunction('withArgs', { count: 3 });
      assert.equal(result, 3);
    });

    it('executeFunction 校验 argsSchema（非法参数抛错）', () => {
      const catalog = new Catalog({
        catalogId: 'test-catalog',
        version: 'v1_0',
        components: [],
        functions: [
          {
            name: 'withArgs',
            parameters: { type: 'object', properties: { count: { type: 'number' } } },
            argsSchema: z.object({ count: z.number() }),
            execute: (args) => args['count'],
          },
        ],
      });
      assert.throws(() => catalog.executeFunction('withArgs', { count: 'bad' }), /参数校验失败/);
    });
  });

  describe('裁剪 prune', () => {
    it('按 allowedComponents 裁剪', () => {
      const catalog = createTestCatalog();
      const pruned = catalog.prune({ allowedComponents: ['Text'] });
      assert.equal(pruned.componentCount, 1);
      assert.ok(pruned.getComponent('Text'));
      assert.equal(pruned.getComponent('Button'), undefined);
    });

    it('按 allowedFunctions 裁剪', () => {
      const catalog = createTestCatalog();
      const pruned = catalog.prune({ allowedFunctions: ['capitalize'] });
      assert.equal(pruned.functionCount, 1);
      assert.ok(pruned.getFunction('capitalize'));
    });

    it('裁剪保留 catalogId 和 version', () => {
      const catalog = createTestCatalog();
      const pruned = catalog.prune({ allowedComponents: ['Text'] });
      assert.equal(pruned.catalogId, 'test-catalog');
      assert.equal(pruned.version, 'v1_0');
    });

    it('不传过滤条件时保留全部内容', () => {
      const catalog = createTestCatalog();
      const pruned = catalog.prune({});
      assert.equal(pruned.componentCount, catalog.componentCount);
      assert.equal(pruned.functionCount, catalog.functionCount);
    });
  });

  describe('LLM 指令渲染', () => {
    it('输出包含组件名', () => {
      const catalog = createTestCatalog();
      const output = catalog.renderAsLlmInstructions();
      assert.ok(output.includes('Text'));
      assert.ok(output.includes('Button'));
      assert.ok(output.includes('Row'));
    });

    it('输出包含函数名', () => {
      const catalog = createTestCatalog();
      const output = catalog.renderAsLlmInstructions();
      assert.ok(output.includes('capitalize'));
      assert.ok(output.includes('noop'));
    });

    it('输出包含章节标题', () => {
      const catalog = createTestCatalog();
      const output = catalog.renderAsLlmInstructions();
      assert.ok(output.includes('可用组件'));
      assert.ok(output.includes('可用函数'));
    });
  });

  describe('静态方法 fromJson', () => {
    it('从 JSON 数据构建 Catalog', () => {
      const catalog = Catalog.fromJson({
        catalogId: 'json-catalog',
        components: {
          Text: { description: '文本组件', type: 'object' },
          Button: { description: '按钮组件', type: 'object' },
        },
        functions: {
          capitalize: { description: '首字母大写', returnType: 'string', args: {} },
        },
      });
      assert.equal(catalog.catalogId, 'json-catalog');
      assert.equal(catalog.componentCount, 2);
      assert.equal(catalog.functionCount, 1);
    });

    it('使用 $id 作为 catalogId 的回退', () => {
      const catalog = Catalog.fromJson({
        $id: 'fallback-id',
        components: {},
      });
      assert.equal(catalog.catalogId, 'fallback-id');
    });

    it('没有 catalogId 和 $id 时使用 unknown', () => {
      const catalog = Catalog.fromJson({});
      assert.equal(catalog.catalogId, 'unknown');
    });
  });
});
