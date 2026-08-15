/**
 * ComponentModel — 单个活跃 UI 组件实例
 * 对应 Python: state/component_model.py
 *
 * 持有组件的 id、type、properties，并在属性变更时触发事件
 */

import { z } from 'zod';
import { EventSource } from '../core/events.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 组件属性变更事件 */
export const componentUpdateEventSchema = z.object({
  /** 组件 ID */
  componentId: z.string(),
  /** 变更后的完整属性 */
  properties: z.record(z.string(), z.unknown()),
});
export type ComponentUpdateEvent = z.infer<typeof componentUpdateEventSchema>;

// ============================================================================
// ComponentModel
// ============================================================================

/**
 * ComponentModel — 单个活跃 UI 组件实例
 *
 * 特性：
 * - 持有组件的类型和属性
 * - 属性变更时触发 onUpdated 事件
 * - 深拷贝保护（设置属性时）
 */
export class ComponentModel {
  /** 组件 ID */
  readonly id: string;

  /** 组件类型（如 'Text', 'Button'） */
  readonly type: string;

  private _properties: Record<string, unknown>;

  /** 属性变更事件源 */
  readonly onUpdated = new EventSource<ComponentUpdateEvent>();

  constructor(id: string, type: string, properties: Record<string, unknown> = {}) {
    this.id = id;
    this.type = type;
    this._properties = structuredClone(properties);
  }

  /** 获取组件属性的深拷贝 */
  get properties(): Record<string, unknown> {
    return structuredClone(this._properties);
  }

  /** 设置组件属性（深拷贝后存储，触发 onUpdated 事件） */
  set properties(value: Record<string, unknown>) {
    this._properties = structuredClone(value);
    this.onUpdated.emit({
      componentId: this.id,
      properties: this._properties,
    });
  }

  /**
   * 获取完整组件树（包含 id、type、properties）
   */
  get componentTree(): { id: string; type: string; properties: Record<string, unknown> } {
    return {
      id: this.id,
      type: this.type,
      properties: structuredClone(this._properties),
    };
  }

  /** 销毁 */
  dispose(): void {
    this.onUpdated.dispose();
  }
}
