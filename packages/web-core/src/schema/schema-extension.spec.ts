import { describe, expect, it } from 'vite-plus/test';
import { z } from 'zod';
import { A2uiMessageSchema, registerComponentSchemas, validateComponentByType } from './schemas.js';
import { validateComponents } from '../processing/message-handler.js';
import type { A2UIDescriptor } from '../index.js';

describe('registerComponentSchemas（自定义 catalog 扩展校验）', () => {
  it('注册前：自定义组件类型校验回退到 basic union（未知类型被拒）', () => {
    const result = validateComponentByType({ id: 'r1', component: 'RiskPanel', riskIndex: 72 }, 'RiskPanel');
    expect(result.valid).toBe(false);
  });

  it('注册后：自定义组件类型按扩展 schema 精确校验', () => {
    const RiskPanelSchema = z
      .object({ id: z.string(), component: z.literal('RiskPanel'), riskIndex: z.number() })
      .loose();
    registerComponentSchemas({ RiskPanel: RiskPanelSchema });

    const ok = validateComponentByType({ id: 'r1', component: 'RiskPanel', riskIndex: 72 }, 'RiskPanel');
    expect(ok.valid).toBe(true);
    expect(ok.errors).toEqual([]);

    // 字段缺失应报错（按扩展 schema 校验）
    const bad = validateComponentByType({ id: 'r1', component: 'RiskPanel' }, 'RiskPanel');
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('重复注册同类型以最新为准', () => {
    registerComponentSchemas({ RiskPanel: z.object({ id: z.string(), component: z.literal('RiskPanel') }).loose() });
    // 旧 schema 要求 riskIndex，新 schema 不要求 → 缺 riskIndex 应通过
    const ok = validateComponentByType({ id: 'r2', component: 'RiskPanel' }, 'RiskPanel');
    expect(ok.valid).toBe(true);
  });

  it('basic 组件校验不受扩展注册影响', () => {
    const ok = validateComponentByType({ id: 't1', component: 'Text', text: '你好' }, 'Text');
    expect(ok.valid).toBe(true);
  });

  it('validateComponents 与消息校验链路可用', () => {
    const msg = A2uiMessageSchema.safeParse({
      version: 'v1.0',
      createSurface: {
        surfaceId: 's1',
        components: [{ id: 'r1', component: 'RiskPanel', riskIndex: 80 }],
      },
    });
    expect(msg.success).toBe(true);
    const components = (msg.data as { createSurface: { components: unknown[] } }).createSurface
      .components as A2UIDescriptor[];
    const errors = validateComponents(components);
    expect(errors).toEqual([]);
  });
});
