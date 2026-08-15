/**
 * NodeGraph — 管理 ComponentNode 全生命周期
 * 对应 Python: state/node_graph.py
 *
 * 核心编排器，负责：
 * - 创建/获取 ComponentNode
 * - 增量更新节点属性
 * - 处理组件创建/删除事件
 * - 管理根节点
 */

import { z } from 'zod';
import { EventSource } from '../core/events.js';
import { ComponentNode } from './component-node.js';
import { SurfaceModel } from './surface-model.js';
import { ComponentModel } from './component-model.js';

// ============================================================================
// 类型定义
// ============================================================================

/** 节点创建事件 */
export interface NodeCreatedEvent {
  node: ComponentNode;
}

/** 节点销毁事件 */
export const nodeDestroyedEventSchema = z.object({
  instanceId: z.string(),
});
export type NodeDestroyedEvent = z.infer<typeof nodeDestroyedEventSchema>;

// ============================================================================
// NodeGraph
// ============================================================================

/**
 * NodeGraph — ComponentNode 全生命周期管理器
 *
 * 管理单个 Surface 上所有 ComponentNode 的创建、更新和销毁
 */
export class NodeGraph {
  /** 关联的 Surface */
  readonly surface: SurfaceModel;

  /** 节点映射表：instanceId → ComponentNode */
  private _nodes = new Map<string, ComponentNode>();

  /** componentId → instanceIds 映射（一个组件可能有多个实例） */
  private _componentInstances = new Map<string, Set<string>>();

  /** 根节点 */
  private _rootNode: ComponentNode | null = null;

  /** 节点创建事件 */
  readonly onNodeCreated = new EventSource<NodeCreatedEvent>();

  /** 节点销毁事件 */
  readonly onNodeDestroyed = new EventSource<NodeDestroyedEvent>();

  constructor(surface: SurfaceModel) {
    this.surface = surface;

    // 监听组件创建/删除事件
    surface.componentsModel.onCreated.subscribe(({ component }) => {
      this._onComponentCreated(component);
    });
    surface.componentsModel.onDeleted.subscribe(({ componentId }) => {
      this._onComponentDeleted(componentId);
    });
  }

  /** 获取根节点 */
  get rootNode(): ComponentNode | null {
    return this._rootNode;
  }

  /** 获取节点数量 */
  get nodeCount(): number {
    return this._nodes.size;
  }

  /**
   * 获取或创建节点
   *
   * @param componentId - 组件 ID
   * @param dataPath - 数据路径（默认 ''）
   */
  getOrCreateNode(componentId: string, dataPath = ''): ComponentNode {
    const instanceId = this._computeInstanceId(componentId, dataPath);

    // 检查是否已存在
    const existing = this._nodes.get(instanceId);
    if (existing && !existing.disposed) {
      return existing;
    }

    // 检查 ComponentModel 是否存在
    const componentModel = this.surface.componentsModel.getComponent(componentId);

    if (!componentModel) {
      // 创建占位符节点
      const node = new ComponentNode(instanceId, componentId, '__placeholder__', dataPath, { __placeholder__: true });
      this._registerNode(node);
      return node;
    }

    // 创建真实节点
    const node = new ComponentNode(instanceId, componentId, componentModel.type, dataPath, componentModel.properties);

    // 监听属性变更
    node.trackSubscription(
      componentModel.onUpdated.subscribe((event) => {
        if (!node.disposed) {
          node.props.value = event.properties;
        }
      }),
    );

    this._registerNode(node);
    return node;
  }

  /**
   * 获取节点
   */
  getNode(instanceId: string): ComponentNode | undefined {
    return this._nodes.get(instanceId);
  }

  /**
   * 获取组件的所有实例
   */
  getComponentInstances(componentId: string): ComponentNode[] {
    const instanceIds = this._componentInstances.get(componentId);
    if (!instanceIds) return [];
    return [...instanceIds]
      .map((id) => this._nodes.get(id))
      .filter((n): n is ComponentNode => n !== undefined && !n.disposed);
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): Map<string, ComponentNode> {
    return this._nodes;
  }

  /**
   * 序列化完整节点树
   */
  toDict(): Record<string, unknown> | null {
    if (!this._rootNode) return null;
    return this._rootNode.toDict();
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  /** 计算 instanceId */
  private _computeInstanceId(componentId: string, dataPath: string): string {
    const normalizedPath = dataPath || '';
    return `${componentId}-[${normalizedPath}]`;
  }

  /** 注册节点 */
  private _registerNode(node: ComponentNode): void {
    this._nodes.set(node.instanceId, node);

    // 更新 componentId → instanceIds 映射
    if (!this._componentInstances.has(node.componentId)) {
      this._componentInstances.set(node.componentId, new Set());
    }
    this._componentInstances.get(node.componentId)!.add(node.instanceId);

    // 监听销毁事件
    node.onDestroyed.subscribe(({ instanceId, componentId }) => {
      this._nodes.delete(instanceId);
      const instances = this._componentInstances.get(componentId);
      if (instances) {
        instances.delete(instanceId);
        if (instances.size === 0) {
          this._componentInstances.delete(componentId);
        }
      }
      this.onNodeDestroyed.emit({ instanceId });
    });

    // 更新根节点
    if (node.componentId === 'root' && node.dataPath === '') {
      this._rootNode = node;
    }

    this.onNodeCreated.emit({ node });
  }

  /** 处理组件创建事件 */
  private _onComponentCreated(component: ComponentModel): void {
    const instances = this.getComponentInstances(component.id);

    // 如果已有占位符节点，更新其类型和属性
    for (const node of instances) {
      if (node.type === '__placeholder__') {
        node.props.value = component.properties;
      }
    }
  }

  /** 处理组件删除事件 */
  private _onComponentDeleted(componentId: string): void {
    const instances = this.getComponentInstances(componentId);
    for (const node of instances) {
      node.dispose();
    }

    // 如果删除的是根组件，清空 rootNode
    if (this._rootNode?.componentId === componentId) {
      this._rootNode = null;
    }
  }

  /** 销毁 */
  dispose(): void {
    for (const node of this._nodes.values()) {
      node.dispose();
    }
    this._nodes.clear();
    this._componentInstances.clear();
    this._rootNode = null;
    this.onNodeCreated.dispose();
    this.onNodeDestroyed.dispose();
  }
}
