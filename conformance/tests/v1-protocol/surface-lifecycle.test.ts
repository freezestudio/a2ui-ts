import { describe, it, expect } from 'vite-plus/test';
import {
  isCreateSurfaceMessage,
  isUpdateComponentsMessage,
  isUpdateDataModelMessage,
  isDeleteSurfaceMessage,
} from '@freezestudio/a2ui-sdk';
import { loadTestData } from '../../src/harness/loader';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { PACKAGE_ROOT } from '../../src/harness/package-root';
import { join } from 'node:path';

interface SurfaceLifecycleResult {
  valid: boolean;
  errors: string[];
}

function validateSurfaceLifecycle(messages: unknown[]): SurfaceLifecycleResult {
  const errors: string[] = [];
  const createdSurfaces = new Set<string>();
  const activeSurfaces = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Record<string, unknown>;
    const prefix = `[${i}]`;

    if (isCreateSurfaceMessage(msg)) {
      const surfaceId = (msg.createSurface as Record<string, unknown>).surfaceId as string;
      if (activeSurfaces.has(surfaceId)) {
        errors.push(`${prefix} 重复 createSurface: surface '${surfaceId}' 已处于活跃状态`);
      }
      createdSurfaces.add(surfaceId);
      activeSurfaces.add(surfaceId);
    } else if (isUpdateComponentsMessage(msg)) {
      const surfaceId = (msg.updateComponents as Record<string, unknown>).surfaceId as string;
      if (!createdSurfaces.has(surfaceId)) {
        errors.push(`${prefix} updateComponents 在 createSurface 之前: surface '${surfaceId}'`);
      } else if (!activeSurfaces.has(surfaceId)) {
        errors.push(`${prefix} updateComponents 在 deleteSurface 之后: surface '${surfaceId}'`);
      }
    } else if (isUpdateDataModelMessage(msg)) {
      const surfaceId = (msg.updateDataModel as Record<string, unknown>).surfaceId as string;
      if (!createdSurfaces.has(surfaceId)) {
        errors.push(`${prefix} updateDataModel 在 createSurface 之前: surface '${surfaceId}'`);
      } else if (!activeSurfaces.has(surfaceId)) {
        errors.push(`${prefix} updateDataModel 在 deleteSurface 之后: surface '${surfaceId}'`);
      }
    } else if (isDeleteSurfaceMessage(msg)) {
      const surfaceId = (msg.deleteSurface as Record<string, unknown>).surfaceId as string;
      if (!activeSurfaces.has(surfaceId)) {
        errors.push(`${prefix} deleteSurface 对不存在/已删除的 surface: '${surfaceId}'`);
      }
      activeSurfaces.delete(surfaceId);
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Surface 生命周期校验', () => {
  it('正确序列: createSurface → updateComponents → updateDataModel → deleteSurface', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root' }] },
      },
      { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('错误: updateComponents 在 createSurface 之前', () => {
    const messages = [
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root' }] },
      },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('createSurface 之前');
  });

  it('错误: updateDataModel 在 createSurface 之前', () => {
    const messages = [{ version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } }];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('createSurface 之前');
  });

  it('错误: 重复 createSurface', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('重复');
  });

  it('错误: deleteSurface 后 updateComponents', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root' }] },
      },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('deleteSurface 之后');
  });

  it('错误: deleteSurface 后 updateDataModel', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('deleteSurface 之后');
  });

  it('错误: deleteSurface 对不存在的 surface', () => {
    const messages = [{ version: 'v1.0', deleteSurface: { surfaceId: 's1' } }];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('不存在');
  });

  it('正确: 多个 surface 并行生命周期', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', createSurface: { surfaceId: 's2', catalogId: 'c1' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [{ id: 'root' }] },
      },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      {
        version: 'v1.0',
        updateComponents: { surfaceId: 's2', components: [{ id: 'root' }] },
      },
      { version: 'v1.0', deleteSurface: { surfaceId: 's2' } },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(true);
  });

  it('正确: createSurface 后可重新 create（先 delete）', () => {
    const messages = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'c1' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
    ];
    const result = validateSurfaceLifecycle(messages);
    expect(result.valid).toBe(true);
  });
});

describe('testing_catalog 下的 callRendererFunction 精确验证', () => {
  it('testing_catalog 定义了 openUrl 和 pingAgent', () => {
    const catalog = loadTestData<Record<string, unknown>>(
      join(PACKAGE_ROOT, '..', 'packages', 'sdk', 'resources', 'specification', 'v1_0', 'test', 'testing_catalog.json'),
    );
    const functions = catalog.functions as Record<string, unknown>;
    expect(functions).toHaveProperty('openUrl');
    expect(functions).toHaveProperty('pingAgent');
    expect(functions).not.toHaveProperty('required');
    expect(functions).not.toHaveProperty('formatString');
  });

  it('testing_catalog 中定义的函数通过 Schema 验证（v1.0 #2210 callRendererFunction）', () => {
    // callRendererFunction 是 agent→renderer 消息（agent_to_renderer.json）；
    // suite 使用 testing_catalog 作 catalog（与官方 run_tests.py 的 catalog 字段一致）
    const validator = new SchemaValidator(undefined, 'testing_catalog.json');
    validator.loadSchemas();
    const data = {
      version: 'v1.0',
      callRendererFunction: {
        functionCallId: 'call-1',
        callFunction: {
          call: 'pingAgent',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        },
      },
    };
    const result = validator.validate('agent_to_renderer.json', data);
    expect(result.valid).toBe(true);
  });
});
