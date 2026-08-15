/**
 * SurfaceComponentsModel — 管理 surface 内组件的邻接映射表
 * 对应 Python: state/surface_components_model.py
 *
 * 管理一组 ComponentModel 实例的增删改查，并触发相应事件
 */

import { z } from 'zod';
import { EventSource } from '../core/events.js';
import { ComponentModel } from './component-model.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 组件创建事件 */
export interface ComponentCreatedEvent {
  componentId: string;
  component: ComponentModel;
}

/** 组件删除事件 */
export const componentDeletedEventSchema = z.object({
  componentId: z.string(),
});
export type ComponentDeletedEvent = z.infer<typeof componentDeletedEventSchema>;

// ============================================================================
// SurfaceComponentsModel
// ============================================================================

/**
 * SurfaceComponentsModel — 组件配置的邻接映射表
 *
 * 管理 surface 内所有 ComponentModel 实例
 */
export class SurfaceComponentsModel {
  private _components = new Map<string, ComponentModel>();

  /** 组件创建事件 */
  readonly onCreated = new EventSource<ComponentCreatedEvent>();

  /** 组件删除事件 */
  readonly onDeleted = new EventSource<ComponentDeletedEvent>();

  /** 获取组件 */
  getComponent(componentId: string): ComponentModel | undefined {
    return this._components.get(componentId);
  }

  /** 获取所有组件 ID */
  getComponentIds(): string[] {
    return [...this._components.keys()];
  }

  /** 获取所有组件 */
  getAllComponents(): Map<string, ComponentModel> {
    return this._components;
  }

  /** 检查组件是否存在 */
  hasComponent(componentId: string): boolean {
    return this._components.has(componentId);
  }

  /** 组件数量 */
  get size(): number {
    return this._components.size;
  }

  /**
   * 添加或更新组件
   * 如果组件已存在，更新其属性；否则创建新组件
   */
  addComponent(id: string, type: string, properties: Record<string, unknown> = {}): ComponentModel {
    const existing = this._components.get(id);

    if (existing) {
      // 更新已有组件
      existing.properties = properties;
      return existing;
    }

    // 创建新组件
    const component = new ComponentModel(id, type, properties);
    this._components.set(id, component);
    this.onCreated.emit({ componentId: id, component });
    return component;
  }

  /**
   * 删除组件
   */
  removeComponent(componentId: string): boolean {
    const component = this._components.get(componentId);
    if (!component) return false;

    this._components.delete(componentId);
    component.dispose();
    this.onDeleted.emit({ componentId });
    return true;
  }

  /** 销毁 — 清除所有组件和事件 */
  dispose(): void {
    for (const component of this._components.values()) {
      component.dispose();
    }
    this._components.clear();
    this.onCreated.dispose();
    this.onDeleted.dispose();
  }
}
