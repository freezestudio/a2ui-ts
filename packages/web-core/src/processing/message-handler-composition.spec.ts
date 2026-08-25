import { describe, expect, it, beforeEach } from 'vite-plus/test';
import { processMessage, validateComponents, validateComponentsDetailed } from './message-handler.js';
import { registerCatalogConstraints, clearCatalogConstraints } from '../schema/composition-constraints.js';
import { SurfaceManager } from '../state/surface-manager.js';
import type { A2UIDescriptor } from '../state/surface-manager.js';
import type { A2uiErrorPayload } from '../common/errors.js';

const CUSTOM_CATALOG = 'https://example.com/a2ui/custom.json';

function comp(id: string, component: string, extra: Record<string, unknown> = {}): A2UIDescriptor {
  return { id, component, ...extra } as A2UIDescriptor;
}

describe('message-handler 组合约束接入（UNALLOWED_PARENT/UNALLOWED_CHILD）', () => {
  beforeEach(() => clearCatalogConstraints());

  it('validateComponents（string[] 兼容接口）包含组合约束消息', () => {
    registerCatalogConstraints(CUSTOM_CATALOG, { Image: { allowedParents: ['Row', 'Column'] } });
    const errors = validateComponents(
      [comp('card', 'Card', { child: 'img' }), comp('img', 'Image', { url: 'https://example.com/i.png' })],
      CUSTOM_CATALOG,
    );
    expect(errors.some((e) => e.includes('UNALLOWED_PARENT'))).toBe(true);
  });

  it('validateComponentsDetailed 返回结构化错误码', () => {
    registerCatalogConstraints(CUSTOM_CATALOG, { Row: { allowedChildren: ['Text'] } });
    const issues = validateComponentsDetailed(
      [comp('row', 'Row', { children: ['img'] }), comp('img', 'Image', { url: 'https://example.com/i.png' })],
      CUSTOM_CATALOG,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('UNALLOWED_CHILD');
    expect(issues[0].path).toBe('row');
  });

  it('未注册约束的 catalog 不产生组合错误', () => {
    const issues = validateComponentsDetailed(
      [comp('root', 'Column', { children: ['img'] }), comp('img', 'Image', { url: 'https://example.com/i.png' })],
      'https://example.com/unknown.json',
    );
    expect(issues).toEqual([]);
  });

  it('processMessage updateComponents 发送 UNALLOWED_PARENT 标准错误码（surface catalogId 解析）', () => {
    registerCatalogConstraints(CUSTOM_CATALOG, { Image: { allowedParents: ['Row', 'Column'] } });
    const manager = new SurfaceManager();
    manager.handleCreateSurface('s1', CUSTOM_CATALOG);
    const sent: A2uiErrorPayload[] = [];

    processMessage(
      {
        updateComponents: {
          surfaceId: 's1',
          components: [
            comp('card', 'Card', { child: 'img' }),
            comp('img', 'Image', { url: 'https://example.com/i.png' }),
          ],
        },
      },
      manager,
      undefined,
      { sendError: (e) => sent.push(e) },
    );

    const unallowed = sent.filter((e) => e.code === 'UNALLOWED_PARENT');
    expect(unallowed).toHaveLength(1);
    expect(unallowed[0].surfaceId).toBe('s1');
    expect(unallowed[0].path).toBe('img');
    // 组件级校验通过时不应有 VALIDATION_FAILED
    expect(sent.some((e) => e.code === 'VALIDATION_FAILED')).toBe(false);
    // 校验失败时不应用组件
    expect(manager.surfaces.value.get('s1')?.components).toHaveLength(0);
  });

  it('processMessage createSurface 内联组件同样触发组合校验', () => {
    registerCatalogConstraints(CUSTOM_CATALOG, { TextField: { allowedParents: ['Column'] } });
    const manager = new SurfaceManager();
    const sent: A2uiErrorPayload[] = [];

    processMessage(
      {
        createSurface: {
          surfaceId: 's2',
          catalogId: CUSTOM_CATALOG,
          components: [comp('card', 'Card', { child: 'tf' }), comp('tf', 'TextField', { label: 'x' })],
        },
      },
      manager,
      undefined,
      { sendError: (e) => sent.push(e) },
    );

    expect(sent.filter((e) => e.code === 'UNALLOWED_PARENT')).toHaveLength(1);
    expect(manager.surfaces.value.get('s2')?.components).toHaveLength(0);
  });

  it('组件级与组合错误并存时：仅报组件级（VALIDATION_FAILED），不做组合校验', () => {
    registerCatalogConstraints(CUSTOM_CATALOG, { Image: { allowedParents: ['Row'] } });
    const manager = new SurfaceManager();
    manager.handleCreateSurface('s3', CUSTOM_CATALOG);
    const sent: A2uiErrorPayload[] = [];

    processMessage(
      {
        updateComponents: {
          surfaceId: 's3',
          components: [comp('bad', 'NoSuchComponent'), comp('img', 'Image', { url: 'https://example.com/i.png' })],
        },
      },
      manager,
      undefined,
      { sendError: (e) => sent.push(e) },
    );

    expect(sent.filter((e) => e.code === 'VALIDATION_FAILED')).toHaveLength(1);
    expect(sent.filter((e) => e.code === 'UNALLOWED_PARENT')).toHaveLength(0);
  });
});
