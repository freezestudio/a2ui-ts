import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { SurfaceManager as CoreSurfaceManager } from '@freezestudio/a2ui-web-core';
import { processMessage, isValidMessage, clearAllPending } from './message-handler.js';

describe('message-handler', () => {
  let sm: CoreSurfaceManager;

  beforeEach(() => {
    sm = new CoreSurfaceManager();
  });

  afterEach(() => {
    clearAllPending();
    vi.restoreAllMocks();
  });

  it('isValidMessage 识别 6 种合法消息', () => {
    expect(isValidMessage({ version: 'v1.0', createSurface: { surfaceId: 's' } })).toBe(true);
    expect(
      isValidMessage({
        version: 'v1.0',
        updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'x' }] },
      }),
    ).toBe(true);
    expect(isValidMessage({ version: 'v1.0', updateDataModel: { surfaceId: 's', value: 1 } })).toBe(true);
    expect(isValidMessage({ version: 'v1.0', deleteSurface: { surfaceId: 's' } })).toBe(true);
    expect(
      isValidMessage({
        version: 'v1.0',
        callRendererFunction: {
          functionCallId: '1',
          callFunction: { call: 'x', catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json' },
        },
      }),
    ).toBe(true);
    expect(isValidMessage({ version: 'v1.0', agentFunctionResponse: { functionCallId: 'a', value: 1 } })).toBe(true);
  });

  it('isValidMessage 拒绝无版本或未知类型的消息', () => {
    expect(isValidMessage({ createSurface: { surfaceId: 's' } })).toBe(false);
    expect(isValidMessage({ version: 'v2.0', createSurface: { surfaceId: 's' } })).toBe(false);
    expect(isValidMessage({ foo: 'bar' })).toBe(false);
    expect(isValidMessage(null)).toBe(false);
  });

  describe('createSurface', () => {
    it('创建 surface 并附带初始组件与数据模型', () => {
      processMessage(
        {
          version: 'v1.0',
          createSurface: {
            surfaceId: 's1',
            components: [{ id: 'root', component: 'Column', children: [] }],
            dataModel: { x: 1 },
          },
        },
        sm,
      );
      const surface = sm.surfaces.value.get('s1')!;
      expect(surface.components).toHaveLength(1);
      expect(surface.dataModel['x']).toBe(1);
    });
  });

  describe('deleteSurface → createSurface 重建（固定 surfaceId 生命周期）', () => {
    it('deleteSurface 后同 id createSurface 可重建', () => {
      processMessage(
        { version: 'v1.0', createSurface: { surfaceId: 'main', components: [{ id: 'root', component: 'Column' }] } },
        sm,
      );
      expect(sm.surfaces.value.has('main')).toBe(true);

      processMessage({ version: 'v1.0', deleteSurface: { surfaceId: 'main' } }, sm);
      expect(sm.surfaces.value.has('main')).toBe(false);

      // 协议允许：deleteSurface 后同 id 重新 createSurface
      processMessage(
        {
          version: 'v1.0',
          createSurface: {
            surfaceId: 'main',
            components: [{ id: 'root', component: 'Column', children: ['x'] }],
          },
        },
        sm,
      );
      const rebuilt = sm.surfaces.value.get('main')!;
      expect(rebuilt).toBeDefined();
      expect(rebuilt.components).toHaveLength(1);
      expect((rebuilt.components[0] as Record<string, unknown>)['children']).toEqual(['x']);
    });

    it('deleteSurface 对不存在 surface 幂等', () => {
      processMessage({ version: 'v1.0', deleteSurface: { surfaceId: 'ghost' } }, sm);
      expect(sm.surfaces.value.size).toBe(0);
    });
  });

  describe('updateComponents 生命周期错误（v1.0 不缓存乱序消息）', () => {
    it('surface 未创建时回传 SURFACE_NOT_FOUND，且不写入组件', () => {
      const sendError = vi.fn();
      processMessage(
        {
          version: 'v1.0',
          updateComponents: { surfaceId: 's1', components: [{ id: 'a', component: 'Text', text: 'x' }] },
        },
        sm,
        undefined,
        { sendError },
      );
      expect(sm.surfaces.value.size).toBe(0);
      expect(sendError).toHaveBeenCalledWith(expect.objectContaining({ code: 'SURFACE_NOT_FOUND', surfaceId: 's1' }));
    });
  });

  describe('组件校验 → VALIDATION_FAILED 回传', () => {
    it('组件缺 id 时回传 VALIDATION_FAILED', () => {
      const sendError = vi.fn();
      const renderer = {
        sendError,
      };
      processMessage({ version: 'v1.0', createSurface: { surfaceId: 's1' } }, sm);
      processMessage(
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [{ component: 'Text' } as never],
          },
        },
        sm,
        undefined,
        renderer,
      );
      expect(sendError).toHaveBeenCalled();
      const arg = sendError.mock.calls[0][0];
      expect(arg.code).toBe('VALIDATION_FAILED');
      expect(arg.surfaceId).toBe('s1');
    });

    it('组件属性违反类型 schema 时回传 VALIDATION_FAILED（按类型精确校验）', () => {
      const sendError = vi.fn();
      const renderer = {
        sendError,
      };
      processMessage({ version: 'v1.0', createSurface: { surfaceId: 's1' } }, sm);
      processMessage(
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [{ id: 't1', component: 'Text', text: 123 } as never],
          },
        },
        sm,
        undefined,
        renderer,
      );
      expect(sendError).toHaveBeenCalled();
      const arg = sendError.mock.calls[0][0];
      expect(arg.code).toBe('VALIDATION_FAILED');
      expect(arg.message).toContain('t1');
    });

    it('符合 schema 的组件通过校验', () => {
      const sendError = vi.fn();
      const renderer = {
        sendError,
      };
      processMessage({ version: 'v1.0', createSurface: { surfaceId: 's1' } }, sm);
      processMessage(
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 's1',
            components: [{ id: 't1', component: 'Text', text: 'hello' }],
          },
        },
        sm,
        undefined,
        renderer,
      );
      expect(sendError).not.toHaveBeenCalled();
    });
  });

  describe('callRendererFunction', () => {
    it('通过回调返回结果（v1.0 #2210）', () => {
      const onResponse = vi.fn();
      processMessage(
        {
          version: 'v1.0',
          callRendererFunction: {
            functionCallId: 'f1',
            callFunction: {
              call: 'formatNumber',
              catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
              args: { value: 1234 },
            },
          },
        },
        sm,
        onResponse,
      );
      expect(onResponse).toHaveBeenCalled();
      const resp = onResponse.mock.calls[0][0];
      expect(resp.functionCallId).toBe('f1');
    });
  });
});
