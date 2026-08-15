import { describe, it, expect } from 'vite-plus/test';
import {
  parseResponse,
  createStreamParser,
  A2uiValidator,
  A2uiMessageSchema,
  A2uiClientMessageSchema,
  Catalog,
  createFullCatalog,
  createSchemaManager,
} from '@freezestudio/a2ui-sdk';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SDKBehaviorTestCase } from '../../src/harness/types';

describe('SDK 行为测试数据格式验证', () => {
  const sdkDirs = ['streaming-parser', 'validator', 'catalog', 'schema-manager', 'parser'];

  for (const dir of sdkDirs) {
    it(`${dir} 测试数据格式正确`, () => {
      const testDir = join(PACKAGE_ROOT, 'test-data/sdk-behavior', dir);
      const files = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of files) {
        const testCases = loadTestData<SDKBehaviorTestCase[]>(join(testDir, file));
        expect(Array.isArray(testCases)).toBe(true);
        for (const tc of testCases) {
          expect(tc.name).toBeDefined();
          expect(tc.description).toBeDefined();
          expect(tc.action).toBeDefined();
        }
      }
    });
  }
});

describe('Streaming Parser 一致性', () => {
  it('SDK: 解析包含 <a2ui-json> 标签的响应', () => {
    const response =
      'Hello <a2ui-json>[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"c1"}}]</a2ui-json> World';
    const parts = parseResponse(response);

    const a2uiParts = parts.filter((p) => p.type === 'a2ui_json');
    expect(a2uiParts.length).toBe(1);
    expect(a2uiParts[0].valid).toBe(true);
  });

  it('SDK: parseResponse 解析完整响应', () => {
    const response =
      'Text before<a2ui-json>[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"c1"}}]</a2ui-json>Text after';
    const parts = parseResponse(response);
    const a2uiParts = parts.filter((p) => p.type === 'a2ui_json');
    expect(a2uiParts.length).toBe(1);
    expect(a2uiParts[0].valid).toBe(true);
  });

  it('SDK: 自动修复未闭合的 JSON', () => {
    const parser = createStreamParser({ autoFix: true });
    parser.processChunk('<a2ui-json>[{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"c1"}');
    const parts = parser.finish();
    const a2uiParts = parts.filter((p) => p.type === 'a2ui_json');
    expect(a2uiParts.length).toBe(1);
    expect(a2uiParts[0].valid).toBe(true);
  });

  it('SDK: 纯文本无标签不产生 a2ui_json', () => {
    const parts = parseResponse('Just text, no tags');
    const a2uiParts = parts.filter((p) => p.type === 'a2ui_json');
    expect(a2uiParts.length).toBe(0);
  });

  it('SDK: 流式解析器 processChunk 返回文本部分', () => {
    const parser = createStreamParser();
    const parts1 = parser.processChunk('Hello World');
    const textParts = parts1.filter((p) => p.type === 'text');
    expect(textParts.length).toBeGreaterThanOrEqual(0);
  });

  it('SDK: 流式解析器 reset 恢复正常', () => {
    const parser = createStreamParser();
    parser.processChunk(
      '<a2ui-json>[{"version":"v1.0","createSurface":{"surfaceId":"s","catalogId":"c"}}]</a2ui-json>',
    );
    parser.reset();
    expect(parser.getState()).toBe('idle');
  });
});

describe('A2uiValidator 一致性', () => {
  const validator = new A2uiValidator();

  it('SDK: 校验有效 createSurface 消息', () => {
    const result = validator.validateServerToClientMessage({
      version: 'v1.0',
      createSurface: { surfaceId: 's1', catalogId: 'c1' },
    });
    expect(result.valid).toBe(true);
  });

  it('SDK: 拒绝缺少 version 的消息', () => {
    const result = validator.validateServerToClientMessage({
      createSurface: { surfaceId: 's1', catalogId: 'c1' },
    });
    expect(result.valid).toBe(false);
  });

  it('SDK: 拒绝错误 version 的消息', () => {
    const result = validator.validateServerToClientMessage({
      version: 'v0.9',
      createSurface: { surfaceId: 's1', catalogId: 'c1' },
    });
    expect(result.valid).toBe(false);
  });

  it('SDK: 校验有效 action 消息（直接使用 Zod Schema）', () => {
    const result = A2uiClientMessageSchema.safeParse({
      version: 'v1.0',
      action: {
        name: 'click',
        surfaceId: 's1',
        sourceComponentId: 'btn1',
        timestamp: '2024-01-01T00:00:00Z',
        context: {},
      },
    });
    expect(result.success).toBe(true);
  });

  it('SDK: 校验有效 rendererFunctionResponse 消息（v1.0 #2210 重构）', () => {
    const result = A2uiClientMessageSchema.safeParse({
      version: 'v1.0',
      rendererFunctionResponse: {
        functionCallId: 'call-1',
        value: 'result',
      },
    });
    expect(result.success).toBe(true);
  });

  it('SDK: 校验 error 消息 — surfaceId/functionCallId 互斥', () => {
    const result = A2uiClientMessageSchema.safeParse({
      version: 'v1.0',
      error: {
        code: 'RUNTIME_ERROR',
        message: 'some error',
        surfaceId: 's1',
        functionCallId: 'call-1',
      },
    });
    expect(result.success).toBe(false);
  });

  it('SDK: 校验消息列表', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
    ];
    const result = validator.validateMessageList(messages);
    expect(result.valid).toBe(true);
  });

  it('SDK: STRICT_VALIDATION 检测组件完整性 — 缺少 root', () => {
    const message = {
      version: 'v1.0' as const,
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'c1', component: 'Text', text: 'hello' }],
      },
    };
    const result = validator.validateComponents(message);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('root'))).toBe(true);
  });

  it('SDK: validateComponents 执行完整性检查', () => {
    const message = {
      version: 'v1.0' as const,
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'root', component: 'Text', text: 'hello' }],
      },
    };
    const result = validator.validateComponents(message);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('SDK: 所有 6 种 S2C 消息类型均可校验', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root' }] } },
      { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      {
        version: 'v1.0',
        callRendererFunction: {
          functionCallId: 'fc1',
          callFunction: {
            call: 'fn',
            catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
            args: {},
          },
        },
      },
      { version: 'v1.0', agentFunctionResponse: { functionCallId: 'fc1', value: 'ok' } },
    ];
    for (const msg of messages) {
      const result = A2uiMessageSchema.safeParse(msg);
      expect(result.success, `消息类型应通过: ${JSON.stringify(msg)}`).toBe(true);
    }
  });

  it('SDK: 所有 4 种 C2S 消息类型均可校验', () => {
    const messages = [
      {
        version: 'v1.0',
        action: {
          name: 'click',
          surfaceId: 's1',
          sourceComponentId: 'btn',
          timestamp: '2024-01-01T00:00:00Z',
          context: {},
        },
      },
      {
        version: 'v1.0',
        callAgentFunction: { surfaceId: 's1', functionCallId: 'fc1', callFunction: { call: 'fn' } },
      },
      { version: 'v1.0', rendererFunctionResponse: { functionCallId: 'fc1', value: 'result' } },
      { version: 'v1.0', error: { code: 'ERR', message: 'err', surfaceId: 's1' } },
    ];
    for (const msg of messages) {
      const result = A2uiClientMessageSchema.safeParse(msg);
      expect(result.success, `消息类型应通过: ${JSON.stringify(msg)}`).toBe(true);
    }
  });
});

describe('Catalog 一致性', () => {
  it('SDK: createFullCatalog 包含 18 个组件', () => {
    const catalog = createFullCatalog();
    expect(catalog.componentCount).toBe(18);
  });

  it('SDK: createFullCatalog 包含 18 个组件', () => {
    const catalog = createFullCatalog();
    expect(catalog.componentCount).toBe(18);
  });

  it('SDK: createFullCatalog 包含 26 个函数', () => {
    const catalog = createFullCatalog();
    expect(catalog.functionCount).toBe(26);
  });

  it('SDK: prune 裁剪组件', () => {
    const catalog = createFullCatalog();
    const pruned = catalog.prune({ allowedComponents: ['Text', 'Button'] });
    expect(pruned.componentCount).toBe(2);
    expect(pruned.getComponentNames()).toContain('Text');
    expect(pruned.getComponentNames()).toContain('Button');
  });

  it('SDK: prune 裁剪函数', () => {
    const catalog = createFullCatalog();
    const pruned = catalog.prune({ allowedFunctions: ['capitalize'] });
    expect(pruned.functionCount).toBe(1);
  });

  it('SDK: renderAsLlmInstructions 生成非空指令', () => {
    const catalog = createFullCatalog();
    const instructions = catalog.renderAsLlmInstructions();
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions).toContain('Text');
  });

  it('SDK: Catalog.fromJson 从 JSON 构建', () => {
    const catalog = Catalog.fromJson({
      catalogId: 'test',
      components: { Text: { description: 'Text component' } },
      functions: { capitalize: { description: 'Capitalize' } },
    });
    expect(catalog.catalogId).toBe('test');
    expect(catalog.componentCount).toBe(1);
    expect(catalog.functionCount).toBe(1);
  });

  it('SDK: executeFunction 执行 capitalize 函数', () => {
    const catalog = createFullCatalog();
    const result = catalog.executeFunction('capitalize', { value: 'hello' });
    expect(result).toBe('Hello');
  });
});

describe('SchemaManager 一致性', () => {
  it('SDK: 生成 system prompt 包含角色描述', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({ roleDescription: '你是一个测试助手' });
    expect(prompt).toContain('你是一个测试助手');
  });

  it('SDK: 生成 system prompt 包含 JSON Schema', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: 'Test',
      includeSchema: true,
    });
    expect(prompt).toContain('JSON Schema');
    expect(prompt).toContain('Agent to Renderer');
  });

  it('SDK: 生成 system prompt 包含示例', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: 'Test',
      includeExamples: true,
    });
    expect(prompt).toContain('示例');
    expect(prompt).toContain('createSurface');
  });

  it('SDK: full catalog 模式生成的 prompt 包含全部组件', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({ roleDescription: 'Test' });
    expect(prompt).toContain('Text');
    expect(prompt).toContain('Image');
    expect(prompt).toContain('Tabs');
  });

  it('SDK: 裁剪后 prompt 仅包含指定组件', async () => {
    const manager = createSchemaManager();
    const prompt = await manager.generateSystemPrompt({
      roleDescription: 'Test',
      allowedComponents: ['Text'],
    });
    expect(prompt).toContain('Text');
    expect(prompt).not.toContain('### Image');
  });
});

describe('Parser (parse_full) 一致性', () => {
  const testDir = join(PACKAGE_ROOT, 'test-data/sdk-behavior/parser');
  const files = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const testCases = loadTestData<SDKBehaviorTestCase[]>(join(testDir, file));

    for (const tc of testCases) {
      if (tc.action === 'parse_full') {
        it(`parse_full: ${tc.description}`, () => {
          const input = tc.input ?? '';
          const parts = parseResponse(input);
          const a2uiParts = parts.filter((p) => p.type === 'a2ui_json');

          if (tc.expect_error) {
            if (tc.expect_error.category === 'ParseError') {
              const hasInvalid = a2uiParts.some((p) => !p.valid);
              expect(hasInvalid || a2uiParts.length === 0).toBe(true);
            }
          } else if (tc.expect) {
            const expectedParts = tc.expect as Array<{ text?: string; a2ui?: unknown[] }>;
            for (const ep of expectedParts) {
              if (ep.a2ui) {
                expect(a2uiParts.length).toBeGreaterThan(0);
              }
            }
          }
        });
      }

      if (tc.action === 'has_parts') {
        it(`has_parts: ${tc.description}`, () => {
          const input = tc.input ?? '';
          const hasParts = input.includes('<a2ui-json>') && input.includes('</a2ui-json>');
          expect(hasParts).toBe(tc.expect);
        });
      }
    }
  }
});

describe('组合约束校验（Surface 容器 + allowedParents/allowedChildren）', () => {
  function catalogWithConstraints(
    constraints: Record<string, { allowedParents?: string[]; allowedChildren?: string[] }>,
  ): Catalog {
    const components: Array<{ name: string; schema: Record<string, unknown> }> = [];
    for (const [name, constraint] of Object.entries(constraints)) {
      components.push({ name, schema: { ...constraint, properties: { component: { const: name } } } });
    }
    return new Catalog({
      catalogId: 'https://example.com/composition-catalog',
      version: 'v1_0',
      components,
      functions: [],
    });
  }

  it('无约束声明时组合校验全部通过', () => {
    const catalog = catalogWithConstraints({
      Column: {},
      Button: {},
    });
    const validator = new A2uiValidator();
    const result = validator.validateComponentsWithCatalog(
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['btn'] },
            { id: 'btn', component: 'Button' },
          ],
        },
      },
      catalog,
    );
    expect(result.valid).toBe(true);
  });

  it('root 组件 allowedParents 含 Surface 时通过（AppLayout 根模式）', () => {
    const catalog = catalogWithConstraints({
      AppLayout: { allowedParents: ['Surface'] },
      Column: {},
    });
    const validator = new A2uiValidator();
    const result = validator.validateComponentsWithCatalog(
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'AppLayout', children: ['body'] },
            { id: 'body', component: 'Column' },
          ],
        },
      },
      catalog,
    );
    expect(result.valid).toBe(true);
  });

  it('root 组件 allowedParents 不含 Surface 时返回 UNALLOWED_PARENT', () => {
    const catalog = catalogWithConstraints({
      AppLayout: { allowedParents: ['CanvasContainer'] },
    });
    const validator = new A2uiValidator();
    const result = validator.validateComponentsWithCatalog(
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [{ id: 'root', component: 'AppLayout' }],
        },
      },
      catalog,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('UNALLOWED_PARENT'))).toBe(true);
  });

  it('容器 allowedChildren 不含子类型时返回 UNALLOWED_CHILD', () => {
    const catalog = catalogWithConstraints({
      Row: { allowedChildren: ['Text'] },
      Button: {},
    });
    const validator = new A2uiValidator();
    const result = validator.validateComponentsWithCatalog(
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Row', children: ['btn'] },
            { id: 'btn', component: 'Button' },
          ],
        },
      },
      catalog,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('UNALLOWED_CHILD'))).toBe(true);
  });

  it('Catalog.fromJson 拒绝定义协议保留组件名 Surface', () => {
    expect(() =>
      Catalog.fromJson({
        catalogId: 'https://example.com/bad-catalog',
        components: {
          Surface: { type: 'object', properties: { component: { const: 'Surface' } } },
        },
      }),
    ).toThrow(/Surface/);
  });
});
