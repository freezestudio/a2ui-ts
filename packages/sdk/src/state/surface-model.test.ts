import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { SurfaceModel } from './surface-model.js';
import { SurfaceGroupModel } from './surface-group-model.js';
import type { SurfaceActionEvent, SurfaceErrorEvent } from './surface-model.js';
import type { ClientActionPayload, ClientErrorPayload } from '../schema/renderer-to-agent.js';

function makeActionPayload(overrides?: Partial<ClientActionPayload>): ClientActionPayload {
  return {
    name: 'click',
    surfaceId: 's1',
    sourceComponentId: 'btn1',
    timestamp: '2024-01-01T00:00:00Z',
    context: {},
    ...overrides,
  };
}

function makeErrorPayload(overrides?: Partial<ClientErrorPayload>): ClientErrorPayload {
  return {
    code: 'VALIDATION_FAILED',
    surfaceId: 's1',
    path: '/data',
    message: 'invalid',
    ...overrides,
  };
}

describe('SurfaceModel', () => {
  it('构造时设置 surfaceId, catalogId', () => {
    const surface = new SurfaceModel({ surfaceId: 's1', catalogId: 'cat1' });
    assert.equal(surface.surfaceId, 's1');
    assert.equal(surface.catalogId, 'cat1');
    surface.dispose();
  });

  it('dataModel 和 componentsModel 已初始化', () => {
    const surface = new SurfaceModel({ surfaceId: 's1', catalogId: 'cat1' });
    assert.ok(surface.dataModel);
    assert.ok(surface.componentsModel);
    surface.dispose();
  });

  it('dispatchAction 触发 onAction', () => {
    const surface = new SurfaceModel({ surfaceId: 's1', catalogId: 'cat1' });
    const received: SurfaceActionEvent[] = [];
    surface.onAction.subscribe((e) => received.push(e));
    const payload = makeActionPayload();
    surface.dispatchAction(payload, 'btn1');
    assert.equal(received.length, 1);
    assert.equal(received[0].surfaceId, 's1');
    assert.equal(received[0].sourceComponentId, 'btn1');
    assert.deepEqual(received[0].action, payload);
    surface.dispose();
  });

  it('dispatchError 触发 onError', () => {
    const surface = new SurfaceModel({ surfaceId: 's1', catalogId: 'cat1' });
    const received: SurfaceErrorEvent[] = [];
    surface.onError.subscribe((e) => received.push(e));
    const payload = makeErrorPayload();
    surface.dispatchError(payload);
    assert.equal(received.length, 1);
    assert.equal(received[0].surfaceId, 's1');
    assert.deepEqual(received[0].error, payload);
    surface.dispose();
  });
});

describe('SurfaceGroupModel', () => {
  it('addSurface 创建新 surface', () => {
    const group = new SurfaceGroupModel();
    const surface = group.addSurface({ surfaceId: 's1', catalogId: 'cat1' });
    assert.ok(surface);
    assert.equal(surface.surfaceId, 's1');
    assert.equal(group.size, 1);
    assert.equal(group.hasSurface('s1'), true);
    group.dispose();
  });

  it('addSurface 重复 ID 抛错', () => {
    const group = new SurfaceGroupModel();
    group.addSurface({ surfaceId: 's1', catalogId: 'cat1' });
    assert.throws(() => {
      group.addSurface({ surfaceId: 's1', catalogId: 'cat2' });
    });
    group.dispose();
  });

  it('deleteSurface 删除 surface', () => {
    const group = new SurfaceGroupModel();
    group.addSurface({ surfaceId: 's1', catalogId: 'cat1' });
    const deleted = group.deleteSurface('s1');
    assert.equal(deleted, true);
    assert.equal(group.hasSurface('s1'), false);
    assert.equal(group.size, 0);
    group.dispose();
  });

  it('onSurfaceCreated 事件触发', () => {
    const group = new SurfaceGroupModel();
    const received: Array<{ surfaceId: string }> = [];
    group.onSurfaceCreated.subscribe((e) => received.push(e));
    group.addSurface({ surfaceId: 's1', catalogId: 'cat1' });
    assert.equal(received.length, 1);
    assert.equal(received[0].surfaceId, 's1');
    group.dispose();
  });

  it('子 surface 的 action 转发到 group 的 onAction', () => {
    const group = new SurfaceGroupModel();
    const surface = group.addSurface({ surfaceId: 's1', catalogId: 'cat1' });
    const received: SurfaceActionEvent[] = [];
    group.onAction.subscribe((e) => received.push(e));
    const payload = makeActionPayload();
    surface.dispatchAction(payload, 'btn1');
    assert.equal(received.length, 1);
    assert.equal(received[0].surfaceId, 's1');
    group.dispose();
  });
});
