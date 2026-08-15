/**
 * ComponentContext — 组件 Model + DataContext 的无头配对
 * 对应 Python: rendering/component_context.py
 *
 * 连接组件与其数据执行环境
 */

import { ComponentModel } from './component-model.js';
import { SurfaceComponentsModel } from './surface-components-model.js';
import { DataContext } from './data-context.js';
import type { SurfaceModel } from './surface-model.js';
import type { Catalog } from '../catalog/catalog.js';

// ============================================================================
// 类型定义
// ============================================================================

/** ComponentContext 配置 */
export interface ComponentContextConfig {
  /** 组件 Model */
  componentModel: ComponentModel;
  /** DataContext */
  dataContext: DataContext;
  /** Surface 组件集合 */
  surfaceComponents: SurfaceComponentsModel;
  /** 动作分发回调 */
  dispatchActionCallback?: (action: unknown, sourceComponentId: string) => void;
}

// ============================================================================
// ComponentContext
// ============================================================================

/**
 * ComponentContext — 组件 Model + DataContext 的无头配对
 *
 * 提供：
 * - 组件属性访问
 * - 数据求值
 * - 动作分发
 */
export class ComponentContext {
  /** 组件 Model */
  readonly componentModel: ComponentModel;

  /** DataContext */
  readonly dataContext: DataContext;

  /** Surface 组件集合 */
  readonly surfaceComponents: SurfaceComponentsModel;

  /** 动作分发回调 */
  private _dispatchActionCallback?: (action: unknown, sourceComponentId: string) => void;

  constructor(config: ComponentContextConfig) {
    this.componentModel = config.componentModel;
    this.dataContext = config.dataContext;
    this.surfaceComponents = config.surfaceComponents;
    this._dispatchActionCallback = config.dispatchActionCallback;
  }

  /**
   * 从 SurfaceModel 直接创建 ComponentContext
   */
  static fromSurface(componentModel: ComponentModel, surface: SurfaceModel, catalog?: Catalog): ComponentContext {
    const dataContext = new DataContext({
      dataModel: surface.dataModel,
      catalog,
      surface,
    });

    return new ComponentContext({
      componentModel,
      dataContext,
      surfaceComponents: surface.componentsModel,
      dispatchActionCallback: (action, sourceComponentId) => {
        surface.dispatchAction(action as Parameters<SurfaceModel['dispatchAction']>[0], sourceComponentId);
      },
    });
  }

  /**
   * 分发动作
   */
  dispatchAction(action: unknown): void {
    if (this._dispatchActionCallback) {
      this._dispatchActionCallback(action, this.componentModel.id);
    }
  }
}
