import { describe, it, expect } from 'vite-plus/test';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { listOfficialCases } from '../../src/harness/official-cases';
import {
  A2uiMessageSchema,
  A2uiClientMessageSchema,
  isCallRendererFunctionMessage,
  isAgentFunctionResponseMessage,
  isCreateSurfaceMessage,
} from '@a2ui-ts/sdk';

function runOfficialSpecTests(filterSchema?: string) {
  const validator = new SchemaValidator();
  validator.loadSchemas();
  const cases = listOfficialCases().filter((c) => !filterSchema || c.schema === filterSchema);

  for (const { file, catalog, schema, test } of cases) {
    it(`[规范 ${file}] ${test.description}`, () => {
      // suite 指定非默认 catalog（testing_catalog.json）时按官方 run_tests.py 语义切换
      const v = catalog === 'catalog.json' ? validator : new SchemaValidator(undefined, catalog);
      if (catalog !== 'catalog.json') v.loadSchemas();
      const result = v.validate(schema, test.data);
      expect(result.valid).toBe(test.valid);
    });
  }
}

function runOfficialSdkTests(filterSchema?: string) {
  const cases = listOfficialCases().filter((c) => !filterSchema || c.schema === filterSchema);

  for (const { file, test } of cases) {
    it(`[SDK ${file}] ${test.description}`, () => {
      const result = A2uiMessageSchema.safeParse(test.data);
      if (test.valid) {
        expect(result.success).toBe(true);
      }
    });
  }
}

describe('官方规范 v1.0 renderer_to_agent 一致性（run_tests.py 同源）', () => {
  runOfficialSpecTests('renderer_to_agent.json');

  it('SDK 类型守卫: isCallAgentFunctionMessage', () => {
    expect(
      isCallRendererFunctionMessage({
        version: 'v1.0',
        createSurface: { surfaceId: 's1', catalogId: 'c1' },
      }),
    ).toBe(false);

    const agentFn = A2uiClientMessageSchema.safeParse({
      version: 'v1.0',
      callAgentFunction: { surfaceId: 's1', functionCallId: 'c1', callFunction: { call: 'fn' } },
    });
    expect(agentFn.success).toBe(true);
  });
});

describe('官方规范 v1.0 agent_to_renderer 一致性（run_tests.py 同源）', () => {
  runOfficialSpecTests('agent_to_renderer.json');
  runOfficialSdkTests('agent_to_renderer.json');

  it('SDK 类型守卫: isCallRendererFunctionMessage', () => {
    expect(
      isCallRendererFunctionMessage({
        version: 'v1.0',
        callRendererFunction: {
          functionCallId: 'call-1',
          callFunction: {
            call: 'formatString',
            catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
            args: { value: 'hello' },
          },
        },
      }),
    ).toBe(true);

    expect(
      isCallRendererFunctionMessage({
        version: 'v1.0',
        createSurface: { surfaceId: 's1', catalogId: 'c1' },
      }),
    ).toBe(false);
  });

  it('SDK 类型守卫: isAgentFunctionResponseMessage', () => {
    expect(
      isAgentFunctionResponseMessage({
        version: 'v1.0',
        agentFunctionResponse: { functionCallId: 'call-1', value: 'ok' },
      }),
    ).toBe(true);

    expect(
      isAgentFunctionResponseMessage({
        version: 'v1.0',
        createSurface: { surfaceId: 's1', catalogId: 'c1' },
      }),
    ).toBe(false);
  });

  it('SDK: createSurface 支持内联 components', () => {
    const data = {
      version: 'v1.0',
      createSurface: {
        surfaceId: 's1',
        catalogId: 'c1',
        components: [{ id: 'root', component: 'Text', text: 'Hello' }],
      },
    };
    const result = A2uiMessageSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(isCreateSurfaceMessage(result.data)).toBe(true);
    }
  });

  it('SDK: createSurface 支持内联 dataModel', () => {
    const data = {
      version: 'v1.0',
      createSurface: {
        surfaceId: 's1',
        catalogId: 'c1',
        dataModel: { count: 0 },
      },
    };
    const result = A2uiMessageSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('官方规范 v1.0 catalog_definition 一致性（run_tests.py 同源）', () => {
  runOfficialSpecTests('catalog_definition.json');
});
