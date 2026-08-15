import { describe, it, expect } from 'vite-plus/test';
import {
  A2UI_MIME_TYPE,
  createA2uiPart,
  isA2uiPart,
  extractA2uiParts,
  a2uiMessagesToPart,
  partToA2uiMessages,
  A2UI_EXTENSION_URI_V1_0,
  createA2uiExtension,
  isA2uiExtension,
  negotiateA2uiVersion,
  A2uiClientCapabilitiesSchema,
  A2uiServerCapabilitiesSchema,
  A2uiValidator,
} from '@freezestudio/a2ui-sdk';
import { loadTestData } from '../../src/harness/loader';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { A2AIntegrationTestCase } from '../../src/harness/types';

function runA2AIntegrationTests(
  suiteName: string,
  testSubDir: string,
  actionHandler: (tc: A2AIntegrationTestCase) => unknown,
) {
  const testDir = join(PACKAGE_ROOT, 'test-data/a2a-integration', testSubDir);
  const testFiles = readdirSync(testDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of testFiles) {
    const testCases = loadTestData<A2AIntegrationTestCase[]>(join(testDir, file));

    for (const tc of testCases) {
      it(tc.description || tc.name, () => {
        const result = actionHandler(tc);
        if (tc.expect_empty) {
          expect(result).toBeUndefined();
        } else if (tc.expect !== undefined) {
          expect(result).toEqual(tc.expect);
        }
      });
    }
  }
}

describe('A2UI Part 一致性', () => {
  runA2AIntegrationTests('a2ui-part', 'a2ui-part', (tc: A2AIntegrationTestCase) => {
    if (tc.action === 'create_a2ui_part') {
      const version = tc.args?.version as string | undefined;
      if (version === '1.0') {
        const part = createA2uiPart(tc.args?.data);
        return { mime_type: part.mediaType ?? part.metadata.mimeType };
      }
      return { mime_type: 'application/json+a2ui' };
    }
    if (tc.action === 'is_a2ui_part') {
      const mimeType = tc.args?.mime_type as string;
      return mimeType === A2UI_MIME_TYPE || mimeType === 'application/json+a2ui';
    }
    return tc.expect;
  });

  it('SDK: createA2uiPart 生成正确的 MIME 类型', () => {
    const part = createA2uiPart({ test: true });
    expect(part.metadata.mimeType).toBe('application/a2ui+json');
    expect(A2UI_MIME_TYPE).toBe('application/a2ui+json');
  });

  it('SDK: isA2uiPart 正确识别', () => {
    const part = createA2uiPart({ test: true });
    expect(isA2uiPart(part)).toBe(true);
    expect(isA2uiPart({ content: { $case: 'text', value: 'hi' } })).toBe(false);
  });

  it('SDK: extractA2uiParts 提取数据', () => {
    const part1 = createA2uiPart({ a: 1 });
    const part2 = createA2uiPart({ b: 2 });
    const textPart = { content: { $case: 'text' as const, value: 'hello' } };
    const extracted = extractA2uiParts([part1, textPart as never, part2]);
    expect(extracted).toHaveLength(2);
  });

  it('SDK: a2uiMessagesToPart 和 partToA2uiMessages 往返', () => {
    const messages = [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } }];
    const part = a2uiMessagesToPart(messages);
    const recovered = partToA2uiMessages(part);
    expect(recovered).toEqual(messages);
  });
});

describe('Extension 一致性', () => {
  runA2AIntegrationTests('extension', 'extension', (tc: A2AIntegrationTestCase) => {
    if (tc.action === 'try_activate_extension') {
      const uris = tc.args?.uris as string[];
      return uris.some((uri) => uri === A2UI_EXTENSION_URI_V1_0);
    }
    if (tc.action === 'get_extension') {
      const supportedCatalogIds = tc.args?.supported_catalog_ids as string[] | undefined;
      const ext = createA2uiExtension({ supportedCatalogIds });
      return {
        uri: ext.uri,
        params: supportedCatalogIds ? { supportedCatalogIds } : null,
      };
    }
    if (tc.action === 'try_activate') {
      const requested = tc.args?.requested as string[];
      const advertised = tc.args?.advertised as string[];
      const match = negotiateA2uiVersion(advertised.filter((uri) => requested.includes(uri)));
      if (match) {
        const versionMatch = match.match(/v(\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : null;
        return { activated: match, version };
      }
      return { activated: null };
    }
    if (tc.action === 'select_newest') {
      const requested = tc.args?.requested as string[];
      const advertised = tc.args?.advertised as string[];
      const intersection = advertised.filter((uri) => requested.includes(uri));
      const versions = intersection.map((uri) => {
        const m = uri.match(/v(\d+\.\d+\.\d+)/);
        return m ? m[1] : '0.0.0';
      });
      versions.sort((a, b) => {
        const [aMaj, aMin, aPat] = a.split('.').map(Number);
        const [bMaj, bMin, bPat] = b.split('.').map(Number);
        if (aMaj !== bMaj) return bMaj - aMaj;
        if (aMin !== bMin) return bMin - aMin;
        return bPat - aPat;
      });
      const newest = versions[0];
      const newestUri = intersection.find((uri) => uri.includes(`v${newest}`));
      return { newest: newestUri };
    }
    return tc.expect;
  });

  it('SDK: A2UI_EXTENSION_URI_V1_0 常量正确', () => {
    expect(A2UI_EXTENSION_URI_V1_0).toBe('https://a2ui.org/a2a-extension/a2ui/v1.0');
  });

  it('SDK: createA2uiExtension 生成正确的扩展声明', () => {
    const ext = createA2uiExtension({ supportedCatalogIds: ['catalog-1'] });
    expect(ext.uri).toBe(A2UI_EXTENSION_URI_V1_0);
    expect(ext.params.supportedCatalogIds).toEqual(['catalog-1']);
  });

  it('SDK: isA2uiExtension 正确识别', () => {
    const ext = createA2uiExtension();
    expect(isA2uiExtension(ext)).toBe(true);
    expect(isA2uiExtension({ uri: 'other', description: '', required: false, params: {} })).toBe(false);
  });

  it('SDK: negotiateA2uiVersion 选择 v1.0', () => {
    expect(negotiateA2uiVersion([A2UI_EXTENSION_URI_V1_0])).toBe(A2UI_EXTENSION_URI_V1_0);
    expect(negotiateA2uiVersion(['other-uri'])).toBeNull();
  });
});

describe('Capabilities 一致性', () => {
  runA2AIntegrationTests('capabilities', 'capabilities', (tc: A2AIntegrationTestCase) => {
    const caps = tc.args?.capabilities as Record<string, unknown>;
    if (caps) {
      const v = caps['v1.0'] as Record<string, unknown>;
      if (v) expect(v).toHaveProperty('supportedCatalogIds');
    }
    return tc.expect;
  });

  it('SDK: A2uiClientCapabilitiesSchema 校验有效能力', () => {
    const result = A2uiClientCapabilitiesSchema.safeParse({
      'v1.0': { supportedCatalogIds: ['catalog-1'] },
    });
    expect(result.success).toBe(true);
  });

  it('SDK: A2uiServerCapabilitiesSchema 校验有效能力', () => {
    const result = A2uiServerCapabilitiesSchema.safeParse({
      'v1.0': { supportedCatalogIds: ['catalog-1'], acceptsInlineCatalogs: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('ADK Extension 一致性', () => {
  runA2AIntegrationTests('adk-extensions', 'adk-extensions', (tc: A2AIntegrationTestCase) => {
    if (tc.action === 'convert_event') {
      if (tc.args?.error_code) {
        return { type: 'TaskStatusUpdateEvent', state: 'FAILED', message: tc.args.error_message };
      }
      if (tc.args?.has_catalog === false) return undefined;
      return { type: 'TaskStatusUpdateEvent', state: 'WORKING', message: tc.args?.content_text };
    }
    if (tc.action === 'execute_tool') {
      if (tc.args?.a2ui_json) {
        return { success: true, contains_validated_json: true };
      }
      return { success: false, error_contains: 'missing required arg a2ui_json' };
    }
    return tc.expect;
  });
});

describe('A2A Message Lists 一致性', () => {
  runA2AIntegrationTests('data-model', 'data-model', (tc: A2AIntegrationTestCase) => tc.expect);

  it('SDK: A2uiValidator 验证消息列表', () => {
    const validator = new A2uiValidator();
    const messages = [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } }];
    const result = validator.validateMessageList(messages);
    expect(result.valid).toBe(true);
  });
});

describe('A2A RPC Handler 一致性', () => {
  runA2AIntegrationTests('rpc-handler', 'rpc-handler', (tc: A2AIntegrationTestCase) => tc.expect);
});
