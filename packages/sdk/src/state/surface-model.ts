/**
 * SurfaceModel — 单个 UI Surface 状态树
 * 对应 Python: state/surface_model.py
 *
 * 持有 DataModel + ComponentsModel + Catalog，派发 action/error 事件
 */

import { z } from 'zod';
import { EventSource } from '../core/events.js';
import { DataModel } from './data-model.js';
import { SurfaceComponentsModel } from './surface-components-model.js';
import {
  ClientActionPayloadSchema,
  ClientErrorPayloadSchema,
  type ClientActionPayload,
  type ClientErrorPayload,
} from '../schema/renderer-to-agent.js';

// ============================================================================
// 类型定义
// ============================================================================

/** Surface 动作事件 */
export const surfaceActionEventSchema = z.object({
  /** Surface ID */
  surfaceId: z.string(),
  /** 动作来源组件 ID */
  sourceComponentId: z.string(),
  /** 动作负载 */
  action: ClientActionPayloadSchema,
});
export type SurfaceActionEvent = z.infer<typeof surfaceActionEventSchema>;

/** Surface 错误事件 */
export const surfaceErrorEventSchema = z.object({
  /** Surface ID */
  surfaceId: z.string(),
  /** 错误负载 */
  error: ClientErrorPayloadSchema,
});
export type SurfaceErrorEvent = z.infer<typeof surfaceErrorEventSchema>;

/** Surface 配置 */
export const surfaceConfigSchema = z.object({
  /** Surface ID */
  surfaceId: z.string(),
  /** Catalog ID */
  catalogId: z.string(),
  /** 是否在 A2A 消息中发送数据模型 */
  sendDataModel: z.boolean().optional(),
});
export type SurfaceConfig = z.infer<typeof surfaceConfigSchema>;

// ============================================================================
// SurfaceModel
// ============================================================================

/**
 * SurfaceModel — 单个 UI Surface 状态树
 *
 * 管理：
 * - 数据模型（DataModel）
 * - 组件模型（SurfaceComponentsModel）
 * - 动作/错误事件分发
 */
export class SurfaceModel {
  /** Surface ID */
  readonly surfaceId: string;

  /** Catalog ID */
  readonly catalogId: string;

  /** 是否在 A2A 消息中发送数据模型 */
  readonly sendDataModel: boolean;

  /** 数据模型 */
  readonly dataModel: DataModel;

  /** 组件模型 */
  readonly componentsModel: SurfaceComponentsModel;

  /** 动作事件源 */
  readonly onAction = new EventSource<SurfaceActionEvent>();

  /** 错误事件源 */
  readonly onError = new EventSource<SurfaceErrorEvent>();

  constructor(config: SurfaceConfig) {
    this.surfaceId = config.surfaceId;
    this.catalogId = config.catalogId;
    this.sendDataModel = config.sendDataModel ?? false;
    this.dataModel = new DataModel();
    this.componentsModel = new SurfaceComponentsModel();
  }

  /**
   * 派发动作事件
   */
  dispatchAction(payload: ClientActionPayload, sourceComponentId: string): void {
    this.onAction.emit({
      surfaceId: this.surfaceId,
      sourceComponentId,
      action: payload,
    });
  }

  /**
   * 派发错误事件
   */
  dispatchError(error: ClientErrorPayload): void {
    this.onError.emit({
      surfaceId: this.surfaceId,
      error,
    });
  }

  /**
   * 获取 Surface 的完整状态快照
   */
  getSnapshot(): {
    surfaceId: string;
    catalogId: string;
    dataModel: unknown;
    components: Array<{ id: string; type: string; properties: Record<string, unknown> }>;
  } {
    const components = [...this.componentsModel.getAllComponents().values()].map((c) => ({
      id: c.id,
      type: c.type,
      properties: c.properties,
    }));

    return {
      surfaceId: this.surfaceId,
      catalogId: this.catalogId,
      dataModel: this.dataModel.get(''),
      components,
    };
  }

  /** 销毁 — 递归释放所有子资源 */
  dispose(): void {
    this.dataModel.dispose();
    this.componentsModel.dispose();
    this.onAction.dispose();
    this.onError.dispose();
  }
}
