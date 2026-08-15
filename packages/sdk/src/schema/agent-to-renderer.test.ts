import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  CreateSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
  DeleteSurfaceMessageSchema,
  CallRendererFunctionMessageSchema,
  AgentFunctionResponseMessageSchema,
  A2uiMessageSchema,
  isCreateSurfaceMessage,
  isUpdateComponentsMessage,
  isUpdateDataModelMessage,
  isDeleteSurfaceMessage,
  isCallRendererFunctionMessage,
  isAgentFunctionResponseMessage,
} from './agent-to-renderer.js';
import { SPEC_VERSION } from './constants.js';

// 合法消息工厂函数
function makeCreateSurface(overrides = {}) {
  return {
    version: SPEC_VERSION,
    createSurface: {
      surfaceId: 's1',
      catalogId: 'c1',
    },
    ...overrides,
  };
}

function makeUpdateComponents(overrides = {}) {
  return {
    version: SPEC_VERSION,
    updateComponents: {
      surfaceId: 's1',
      components: [{ id: 'root' }],
    },
    ...overrides,
  };
}

function makeUpdateDataModel(overrides = {}) {
  return {
    version: SPEC_VERSION,
    updateDataModel: {
      surfaceId: 's1',
      value: null,
    },
    ...overrides,
  };
}

function makeDeleteSurface(overrides = {}) {
  return {
    version: SPEC_VERSION,
    deleteSurface: {
      surfaceId: 's1',
    },
    ...overrides,
  };
}

function makeCallRendererFunction(overrides = {}) {
  return {
    version: SPEC_VERSION,
    callRendererFunction: {
      functionCallId: 'call-1',
      callFunction: {
        call: 'computeTotal',
        catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
        args: { x: 1 },
      },
    },
    ...overrides,
  };
}

function makeAgentFunctionResponse(overrides = {}) {
  return {
    version: SPEC_VERSION,
    agentFunctionResponse: {
      functionCallId: 'call-1',
      value: 'ok',
    },
    ...overrides,
  };
}

describe('agent-to-renderer', () => {
  // ==========================================================================
  // CreateSurfaceMessageSchema
  // ==========================================================================
  describe('CreateSurfaceMessageSchema', () => {
    it('应解析合法消息', () => {
      const msg = makeCreateSurface();
      const result = CreateSurfaceMessageSchema.parse(msg);
      assert.equal(result.version, SPEC_VERSION);
      assert.equal(result.createSurface.surfaceId, 's1');
      assert.equal(result.createSurface.catalogId, 'c1');
    });

    it('应允许携带 surfaceProperties', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', catalogId: 'c1', surfaceProperties: { color: 'red' } },
      });
      const result = CreateSurfaceMessageSchema.parse(msg);
      assert.deepEqual(result.createSurface.surfaceProperties, { color: 'red' });
    });

    it('应允许携带 components', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', catalogId: 'c1', components: [{ id: 'root' }] },
      });
      const result = CreateSurfaceMessageSchema.parse(msg);
      assert.equal(result.createSurface.components!.length, 1);
    });

    it('应允许携带 dataModel', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', catalogId: 'c1', dataModel: { user: 'Alice' } },
      });
      const result = CreateSurfaceMessageSchema.parse(msg);
      assert.deepEqual(result.createSurface.dataModel, { user: 'Alice' });
    });

    it('应允许 sendDataModel', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', catalogId: 'c1', sendDataModel: true },
      });
      const result = CreateSurfaceMessageSchema.parse(msg);
      assert.equal(result.createSurface.sendDataModel, true);
    });

    it('应拒绝错误的版本号', () => {
      const msg = makeCreateSurface({ version: 'v999' });
      assert.throws(() => CreateSurfaceMessageSchema.parse(msg));
    });

    it('应拒绝缺少 surfaceId', () => {
      const msg = { version: SPEC_VERSION, createSurface: { catalogId: 'c1' } };
      assert.throws(() => CreateSurfaceMessageSchema.parse(msg));
    });

    it('应拒绝额外顶层字段（strict）', () => {
      const msg = { ...makeCreateSurface(), extra: true };
      assert.throws(() => CreateSurfaceMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // UpdateComponentsMessageSchema
  // ==========================================================================
  describe('UpdateComponentsMessageSchema', () => {
    it('应解析合法消息', () => {
      const msg = makeUpdateComponents();
      const result = UpdateComponentsMessageSchema.parse(msg);
      assert.equal(result.updateComponents.surfaceId, 's1');
      assert.equal(result.updateComponents.components.length, 1);
      assert.equal(result.updateComponents.components[0].id, 'root');
    });

    it('应允许组件携带额外属性（passthrough）', () => {
      const msg = makeUpdateComponents({
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', type: 'container', children: ['btn1'] }],
        },
      });
      const result = UpdateComponentsMessageSchema.parse(msg);
      assert.equal(result.updateComponents.components[0].type, 'container');
    });

    it('应拒绝空组件数组', () => {
      const msg = makeUpdateComponents({
        updateComponents: { surfaceId: 's1', components: [] },
      });
      assert.throws(() => UpdateComponentsMessageSchema.parse(msg));
    });

    it('应拒绝错误版本号', () => {
      const msg = makeUpdateComponents({ version: 'v0.0' });
      assert.throws(() => UpdateComponentsMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // UpdateDataModelMessageSchema
  // ==========================================================================
  describe('UpdateDataModelMessageSchema', () => {
    it('应解析最小消息', () => {
      const msg = makeUpdateDataModel();
      const result = UpdateDataModelMessageSchema.parse(msg);
      assert.equal(result.updateDataModel.surfaceId, 's1');
    });

    it('应解析带 path 和 value 的消息', () => {
      const msg = makeUpdateDataModel({
        updateDataModel: { surfaceId: 's1', path: '/user', value: { name: 'Alice' } },
      });
      const result = UpdateDataModelMessageSchema.parse(msg);
      assert.equal(result.updateDataModel.path, '/user');
      assert.deepEqual(result.updateDataModel.value, { name: 'Alice' });
    });

    it('应拒绝错误版本号', () => {
      const msg = makeUpdateDataModel({ version: 'bad' });
      assert.throws(() => UpdateDataModelMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // DeleteSurfaceMessageSchema
  // ==========================================================================
  describe('DeleteSurfaceMessageSchema', () => {
    it('应解析合法消息', () => {
      const msg = makeDeleteSurface();
      const result = DeleteSurfaceMessageSchema.parse(msg);
      assert.equal(result.deleteSurface.surfaceId, 's1');
    });

    it('应拒绝缺少 surfaceId', () => {
      const msg = { version: SPEC_VERSION, deleteSurface: {} };
      assert.throws(() => DeleteSurfaceMessageSchema.parse(msg));
    });

    it('应拒绝错误版本号', () => {
      const msg = makeDeleteSurface({ version: 'v2.0' });
      assert.throws(() => DeleteSurfaceMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // CallRendererFunctionMessageSchema (v1.0 #2210 重构)
  // ==========================================================================
  describe('CallRendererFunctionMessageSchema', () => {
    it('应解析合法消息', () => {
      const msg = makeCallRendererFunction();
      const result = CallRendererFunctionMessageSchema.parse(msg);
      assert.equal(result.callRendererFunction.functionCallId, 'call-1');
      assert.equal(result.callRendererFunction.callFunction.call, 'computeTotal');
    });

    it('应拒绝缺少 functionCallId', () => {
      const msg = { version: SPEC_VERSION, callRendererFunction: { callFunction: { call: 'fn' } } };
      assert.throws(() => CallRendererFunctionMessageSchema.parse(msg));
    });

    it('应拒绝缺少 catalogId（#2210 必填）', () => {
      const msg = makeCallRendererFunction({
        callRendererFunction: {
          functionCallId: 'call-1',
          callFunction: { call: 'fn', args: {} },
        },
      });
      assert.throws(() => CallRendererFunctionMessageSchema.parse(msg));
    });

    it('应拒绝错误版本号', () => {
      const msg = makeCallRendererFunction({ version: 'v999' });
      assert.throws(() => CallRendererFunctionMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // AgentFunctionResponseMessageSchema (v1.0 #2210 重构)
  // ==========================================================================
  describe('AgentFunctionResponseMessageSchema', () => {
    it('应解析带 value 的合法消息', () => {
      const msg = makeAgentFunctionResponse();
      const result = AgentFunctionResponseMessageSchema.parse(msg);
      assert.equal(result.agentFunctionResponse.functionCallId, 'call-1');
      assert.equal(result.agentFunctionResponse.value, 'ok');
    });

    it('应解析带 error 的响应', () => {
      const msg = makeAgentFunctionResponse({
        agentFunctionResponse: { functionCallId: 'call-1', error: { code: 'FAIL', message: 'failed' } },
      });
      const result = AgentFunctionResponseMessageSchema.parse(msg);
      assert.equal((result.agentFunctionResponse.error as { code: string }).code, 'FAIL');
    });

    it('应拒绝缺少 functionCallId', () => {
      const msg = { version: SPEC_VERSION, agentFunctionResponse: { value: 'ok' } };
      assert.throws(() => AgentFunctionResponseMessageSchema.parse(msg));
    });
  });

  // ==========================================================================
  // A2uiMessageSchema — 联合类型鉴别
  // ==========================================================================
  describe('A2uiMessageSchema', () => {
    it('应解析 CreateSurface 消息', () => {
      const result = A2uiMessageSchema.parse(makeCreateSurface());
      assert.ok('createSurface' in result);
    });

    it('应解析 UpdateComponents 消息', () => {
      const result = A2uiMessageSchema.parse(makeUpdateComponents());
      assert.ok('updateComponents' in result);
    });

    it('应解析 UpdateDataModel 消息', () => {
      const result = A2uiMessageSchema.parse(makeUpdateDataModel());
      assert.ok('updateDataModel' in result);
    });

    it('应解析 DeleteSurface 消息', () => {
      const result = A2uiMessageSchema.parse(makeDeleteSurface());
      assert.ok('deleteSurface' in result);
    });

    it('应解析 CallRendererFunction 消息', () => {
      const result = A2uiMessageSchema.parse(makeCallRendererFunction());
      assert.ok('callRendererFunction' in result);
    });

    it('应解析 AgentFunctionResponse 消息', () => {
      const result = A2uiMessageSchema.parse(makeAgentFunctionResponse());
      assert.ok('agentFunctionResponse' in result);
    });

    it('应拒绝无法匹配任何变体的消息', () => {
      assert.throws(() => A2uiMessageSchema.parse({ version: SPEC_VERSION }));
    });
  });

  // ==========================================================================
  // 组件信封校验（v1.0 #2166 ComponentCommon + #2155 Surface 保留名）
  // ==========================================================================
  describe('组件信封校验（ComponentPayloadSchema / ComponentsListSchema）', () => {
    it('应拒绝组件名为 Surface（createSurface）', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', components: [{ id: 'root', component: 'Surface' }] },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg), /Surface/);
    });

    it('应拒绝组件名为 Surface（updateComponents）', () => {
      const msg = makeUpdateComponents({
        updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Surface' }] },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg), /Surface/);
    });

    it('应拒绝组件缺少 id（ComponentCommon 必填）', () => {
      const msg = makeUpdateComponents({
        updateComponents: { surfaceId: 's1', components: [{ component: 'Text', text: 'hi' }] },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg));
    });

    it('应拒绝组件 metadata 包含未知属性', () => {
      const msg = makeUpdateComponents({
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text', metadata: { unknownProp: true } }],
        },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg));
    });

    it('应拒绝组件 metadata.extensions 非法键名（UAX #31）', () => {
      const msg = makeUpdateComponents({
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text', metadata: { extensions: { '123bad': true } } }],
        },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg));
    });

    it('应拒绝 createSurface.metadata 包含未知属性', () => {
      const msg = makeCreateSurface({
        createSurface: { surfaceId: 's1', metadata: { unknownProp: true } },
      });
      assert.throws(() => A2uiMessageSchema.parse(msg));
    });

    it('应接受合法组件信封（id + component + metadata.extensions）', () => {
      const msg = makeUpdateComponents({
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Text', text: 'hi', metadata: { extensions: { custom_theme: { dark: true } } } },
          ],
        },
      });
      const result = A2uiMessageSchema.parse(msg);
      assert.ok('updateComponents' in result);
    });
  });

  // ==========================================================================
  // 类型判断函数
  // ==========================================================================
  describe('isCreateSurfaceMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isCreateSurfaceMessage(makeCreateSurface()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isCreateSurfaceMessage(makeUpdateComponents()), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isCreateSurfaceMessage(null), false);
    });
  });

  describe('isUpdateComponentsMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isUpdateComponentsMessage(makeUpdateComponents()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isUpdateComponentsMessage(makeCreateSurface()), false);
    });

    it('undefined 应返回 false', () => {
      assert.equal(isUpdateComponentsMessage(undefined), false);
    });
  });

  describe('isUpdateDataModelMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isUpdateDataModelMessage(makeUpdateDataModel()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isUpdateDataModelMessage(makeDeleteSurface()), false);
    });
  });

  describe('isDeleteSurfaceMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isDeleteSurfaceMessage(makeDeleteSurface()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isDeleteSurfaceMessage(makeUpdateDataModel()), false);
    });

    it('字符串应返回 false', () => {
      assert.equal(isDeleteSurfaceMessage('msg'), false);
    });
  });

  describe('isCallRendererFunctionMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isCallRendererFunctionMessage(makeCallRendererFunction()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isCallRendererFunctionMessage(makeCreateSurface()), false);
    });

    it('null 应返回 false', () => {
      assert.equal(isCallRendererFunctionMessage(null), false);
    });
  });

  describe('isAgentFunctionResponseMessage', () => {
    it('合法消息应返回 true', () => {
      assert.equal(isAgentFunctionResponseMessage(makeAgentFunctionResponse()), true);
    });

    it('其他消息应返回 false', () => {
      assert.equal(isAgentFunctionResponseMessage(makeDeleteSurface()), false);
    });

    it('undefined 应返回 false', () => {
      assert.equal(isAgentFunctionResponseMessage(undefined), false);
    });
  });
});
