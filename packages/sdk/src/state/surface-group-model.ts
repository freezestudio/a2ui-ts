/**
 * SurfaceGroupModel — 全局 Surface 容器
 * 对应 Python: state/surface_group_model.py
 *
 * 管理多 surface 生命周期和事件转发
 */

import { z } from 'zod';
import { EventSource } from '../core/events.js';
import { SurfaceModel, SurfaceConfig, SurfaceActionEvent, SurfaceErrorEvent } from './surface-model.js';

// ============================================================================
// 类型定义
// ============================================================================

/** Surface 创建事件 */
export interface SurfaceCreatedEvent {
  surfaceId: string;
  surface: SurfaceModel;
}

/** Surface 删除事件 */
export const surfaceDeletedEventSchema = z.object({
  surfaceId: z.string(),
});
export type SurfaceDeletedEvent = z.infer<typeof surfaceDeletedEventSchema>;

// ============================================================================
// SurfaceGroupModel
// ============================================================================

/**
 * SurfaceGroupModel — 全局 Surface 生命周期管理器
 *
 * 管理所有 Surface 的创建/删除，并转发事件
 */
export class SurfaceGroupModel {
  /** Surface 映射表 */
  private _surfaces = new Map<string, SurfaceModel>();

  /** Surface 创建事件 */
  readonly onSurfaceCreated = new EventSource<SurfaceCreatedEvent>();

  /** Surface 删除事件 */
  readonly onSurfaceDeleted = new EventSource<SurfaceDeletedEvent>();

  /** 动作事件（从所有 surface 转发） */
  readonly onAction = new EventSource<SurfaceActionEvent>();

  /** 错误事件（从所有 surface 转发） */
  readonly onError = new EventSource<SurfaceErrorEvent>();

  /** 获取 Surface */
  getSurface(surfaceId: string): SurfaceModel | undefined {
    return this._surfaces.get(surfaceId);
  }

  /** 获取所有 Surface ID */
  getSurfaceIds(): string[] {
    return [...this._surfaces.keys()];
  }

  /** 获取所有 Surface */
  getAllSurfaces(): Map<string, SurfaceModel> {
    return this._surfaces;
  }

  /** 检查 Surface 是否存在 */
  hasSurface(surfaceId: string): boolean {
    return this._surfaces.has(surfaceId);
  }

  /** Surface 数量 */
  get size(): number {
    return this._surfaces.size;
  }

  /**
   * 添加 Surface
   * @throws 如果 surfaceId 已存在
   */
  addSurface(config: SurfaceConfig): SurfaceModel {
    if (this._surfaces.has(config.surfaceId)) {
      throw new Error(`Surface "${config.surfaceId}" 已存在`);
    }

    const surface = new SurfaceModel(config);

    // 转发事件
    surface.onAction.subscribe((event) => this.onAction.emit(event));
    surface.onError.subscribe((event) => this.onError.emit(event));

    this._surfaces.set(config.surfaceId, surface);
    this.onSurfaceCreated.emit({ surfaceId: config.surfaceId, surface });

    return surface;
  }

  /**
   * 删除 Surface
   */
  deleteSurface(surfaceId: string): boolean {
    const surface = this._surfaces.get(surfaceId);
    if (!surface) return false;

    this._surfaces.delete(surfaceId);
    surface.dispose();
    this.onSurfaceDeleted.emit({ surfaceId });

    return true;
  }

  /** 销毁 — 批量销毁所有 surface */
  dispose(): void {
    for (const surface of this._surfaces.values()) {
      surface.dispose();
    }
    this._surfaces.clear();
    this.onSurfaceCreated.dispose();
    this.onSurfaceDeleted.dispose();
    this.onAction.dispose();
    this.onError.dispose();
  }
}
