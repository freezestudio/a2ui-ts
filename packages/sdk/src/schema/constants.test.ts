import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  SPEC_VERSION,
  SPEC_BASE_URL,
  MessageType,
  ClientMessageType,
  CatalogKeys,
  SurfaceKeys,
  ROOT_ID,
  MAX_GLOBAL_DEPTH,
  MAX_FUNC_CALL_DEPTH,
} from './constants.js';

describe('constants', () => {
  describe('SPEC_VERSION', () => {
    it('应为 v1.0', () => {
      assert.equal(SPEC_VERSION, 'v1.0');
    });
  });

  describe('SPEC_BASE_URL', () => {
    it('应为 https://a2ui.org/specification', () => {
      assert.equal(SPEC_BASE_URL, 'https://a2ui.org/specification');
    });
  });

  describe('ROOT_ID', () => {
    it('应为 root', () => {
      assert.equal(ROOT_ID, 'root');
    });
  });

  describe('MAX_GLOBAL_DEPTH', () => {
    it('应为 50', () => {
      assert.equal(MAX_GLOBAL_DEPTH, 50);
    });
  });

  describe('MAX_FUNC_CALL_DEPTH', () => {
    it('应为 5', () => {
      assert.equal(MAX_FUNC_CALL_DEPTH, 5);
    });
  });

  describe('MessageType', () => {
    it('CreateSurface 应为 createSurface', () => {
      assert.equal(MessageType.CreateSurface, 'createSurface');
    });

    it('UpdateComponents 应为 updateComponents', () => {
      assert.equal(MessageType.UpdateComponents, 'updateComponents');
    });

    it('UpdateDataModel 应为 updateDataModel', () => {
      assert.equal(MessageType.UpdateDataModel, 'updateDataModel');
    });

    it('DeleteSurface 应为 deleteSurface', () => {
      assert.equal(MessageType.DeleteSurface, 'deleteSurface');
    });

    it('CallRendererFunction 应为 callRendererFunction（v1.0 #2210）', () => {
      assert.equal(MessageType.CallRendererFunction, 'callRendererFunction');
    });

    it('AgentFunctionResponse 应为 agentFunctionResponse（v1.0 #2210）', () => {
      assert.equal(MessageType.AgentFunctionResponse, 'agentFunctionResponse');
    });

    it('应恰好包含 6 个键', () => {
      assert.equal(Object.keys(MessageType).length, 6);
    });
  });

  describe('ClientMessageType', () => {
    it('Action 应为 action', () => {
      assert.equal(ClientMessageType.Action, 'action');
    });
    it('CallAgentFunction 应为 callAgentFunction', () => {
      assert.equal(ClientMessageType.CallAgentFunction, 'callAgentFunction');
    });
    it('RendererFunctionResponse 应为 rendererFunctionResponse', () => {
      assert.equal(ClientMessageType.RendererFunctionResponse, 'rendererFunctionResponse');
    });
    it('Error 应为 error', () => {
      assert.equal(ClientMessageType.Error, 'error');
    });
  });

  describe('CatalogKeys', () => {
    it('Components 应为 components', () => {
      assert.equal(CatalogKeys.Components, 'components');
    });

    it('Functions 应为 functions', () => {
      assert.equal(CatalogKeys.Functions, 'functions');
    });

    it('SurfaceProperties 应为 surfaceProperties', () => {
      assert.equal(CatalogKeys.SurfaceProperties, 'surfaceProperties');
    });
  });

  describe('SurfaceKeys', () => {
    it('SurfaceId 应为 surfaceId', () => {
      assert.equal(SurfaceKeys.SurfaceId, 'surfaceId');
    });

    it('CatalogId 应为 catalogId', () => {
      assert.equal(SurfaceKeys.CatalogId, 'catalogId');
    });

    it('SurfaceProperties 应为 surfaceProperties', () => {
      assert.equal(SurfaceKeys.SurfaceProperties, 'surfaceProperties');
    });

    it('SendDataModel 应为 sendDataModel', () => {
      assert.equal(SurfaceKeys.SendDataModel, 'sendDataModel');
    });
  });
});
