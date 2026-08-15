/**
 * 状态管理模块统一导出
 */

// 路径工具
export { parsePointer, serializePointer, normalizePath, getParentPath, isAncestorPath } from './path-utils.js';

// DataModel
export {
  DataModel,
  dataModelChangeEventSchema,
  type DataModelChangeEvent,
  type DataModelChangeHandler,
} from './data-model.js';

// ComponentModel
export { ComponentModel, componentUpdateEventSchema, type ComponentUpdateEvent } from './component-model.js';

// SurfaceComponentsModel
export {
  SurfaceComponentsModel,
  componentDeletedEventSchema,
  type ComponentCreatedEvent,
  type ComponentDeletedEvent,
} from './surface-components-model.js';

// SurfaceModel
export {
  SurfaceModel,
  surfaceActionEventSchema,
  surfaceErrorEventSchema,
  surfaceConfigSchema,
  type SurfaceActionEvent,
  type SurfaceErrorEvent,
  type SurfaceConfig,
} from './surface-model.js';

// SurfaceGroupModel
export {
  SurfaceGroupModel,
  surfaceDeletedEventSchema,
  type SurfaceCreatedEvent,
  type SurfaceDeletedEvent,
} from './surface-group-model.js';

// ComponentNode
export {
  ComponentNode,
  PLACEHOLDER,
  componentNodeDestroyedEventSchema,
  type Placeholder,
  type ComponentNodeDestroyedEvent,
} from './component-node.js';

// NodeGraph
export { NodeGraph, nodeDestroyedEventSchema, type NodeCreatedEvent, type NodeDestroyedEvent } from './node-graph.js';

// DataContext (原 rendering/data-context.ts)
export {
  DataContext,
  dynamicValueChangeEventSchema,
  type DataContextConfig,
  type DynamicValueChangeEvent,
  type DynamicValueChangeHandler,
} from './data-context.js';

// ComponentContext (原 rendering/component-context.ts)
export { ComponentContext, type ComponentContextConfig } from './component-context.js';

// GenericBinder (原 rendering/generic-binder.ts)
export {
  GenericBinder,
  bindingResultEventSchema,
  checkRuleResultSchema,
  type BindingResultEvent,
  type CheckRuleResult,
} from './generic-binder.js';
