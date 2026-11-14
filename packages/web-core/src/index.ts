export { createRendererLogger, setRendererLogLevel, rendererLogLevelSchema } from './common/logger.js';
export type { RendererLogLevel, RendererLogger } from './common/logger.js';

export {
  A2uiError,
  A2uiValidationError,
  A2uiDataError,
  A2uiExpressionError,
  A2uiStateError,
  A2uiFunctionError,
  A2uiSecurityError,
  A2uiCatalogError,
  A2uiIntegrityError,
  A2uiRecursionError,
  A2uiRpcError,
  RpcErrorCode,
} from './common/errors.js';
export type { A2uiErrorPayload, A2uiErrorDetail } from './common/errors.js';

export {
  A2uiMessageSchema,
  DataBindingSchema,
  FunctionCallSchema,
  DynamicValueSchema,
  DynamicStringSchema,
  DynamicBooleanSchema,
  DynamicNumberSchema,
  CreateSurfacePayloadSchema,
  UpdateComponentsPayloadSchema,
  UpdateDataModelPayloadSchema,
  DeleteSurfacePayloadSchema,
  CallRendererFunctionMessageSchema,
  AgentFunctionResponseMessageSchema,
  CheckRuleSchema,
  ActionEventSchema,
  ActionSchema,
  TextComponentSchema,
  ButtonComponentSchema,
  ImageComponentSchema,
  RowComponentSchema,
  ColumnComponentSchema,
  CardComponentSchema,
  TextFieldComponentSchema,
  CheckBoxComponentSchema,
  SliderComponentSchema,
  ChoicePickerComponentSchema,
  DateTimeInputComponentSchema,
  DividerComponentSchema,
  ListComponentSchema,
  IconComponentSchema,
  TabsComponentSchema,
  ModalComponentSchema,
  VideoComponentSchema,
  AudioPlayerComponentSchema,
  ComponentBase,
  AnyComponentSchema,
  validateComponent,
  validateComponentByType,
  COMPONENT_SCHEMA_BY_TYPE,
  registerComponentSchemas,
  ClientActionPayloadSchema,
  A2uiClientActionMessageSchema,
  CallAgentFunctionPayloadSchema,
  A2uiClientCallAgentFunctionMessageSchema,
  RendererFunctionResponsePayloadSchema,
  A2uiRendererFunctionResponseMessageSchema,
  ClientErrorPayloadSchema,
  A2uiClientErrorMessageSchema,
} from './schema/schemas.js';
export type {
  A2uiMessage,
  DataBinding,
  FunctionCall,
  ComponentId,
  TextComponent,
  AnyComponent,
  ComponentSchemaLike,
  ClientActionPayload,
  A2uiClientActionMessage,
  ClientErrorPayload,
  A2uiClientErrorMessage,
} from './schema/schemas.js';

export { isDataBinding, isFunctionCall, resolvePath, setAtPath, deleteAtPath } from './processing/data-binding.js';

export {
  BASIC_CATALOG_ID,
  resolveDynamicValue,
  resolveDynamicString,
  callFunction,
  getFunctionAllowedCallers,
  getFunctionRequiresActivation,
  isKnownFunction,
  registerRendererFunction,
} from './processing/function-call.js';
export type { ActionIntent } from './processing/function-call.js';

export {
  processMessage,
  processMessageSafe,
  processMessagesWithErrors,
  isValidMessage,
  validateComponents,
  validateComponentsDetailed,
  resolveCatalog,
  clearAllPending,
} from './processing/message-handler.js';
export type { A2UIMessage, ComponentValidationIssue, MessageProcessingError } from './processing/message-handler.js';

// 结构化错误映射（v1.0 renderer→agent error，RFC 6901 path）
export {
  extractEnvelopeErrorContext,
  normalizeJsonPointer,
  mapErrorToRendererMessage,
} from './processing/message-error-mapper.js';
export type {
  A2uiRendererError,
  RendererErrorMessage,
  ValidationFailedErrorBody,
  GenericErrorBody,
  ErrorEnvelopeContext,
} from './processing/message-error-mapper.js';

// RPC 生命周期（callAgentFunction pending/timeout/cancel/dispose）
export { RpcHandler, DEFAULT_MAX_PENDING_CALLS, DEFAULT_RPC_TIMEOUT_MS } from './rpc/rpc-handler.js';
export type {
  CallAgentFunctionEnvelope,
  CallAgentFunctionOptions,
  RpcHandlerOptions,
  RpcOutboundListener,
} from './rpc/rpc-handler.js';

// 组合约束校验（allowedParents/allowedChildren + Surface，v1.0 #2155）
export {
  SURFACE_COMPONENT,
  UNALLOWED_PARENT,
  UNALLOWED_CHILD,
  registerCatalogConstraints,
  clearCatalogConstraints,
  getConstraintResolver,
  checkCompositionConstraints,
} from './schema/composition-constraints.js';
export type {
  CompositionConstraints,
  CompositionConstraintResolver,
  CompositionIssue,
} from './schema/composition-constraints.js';

export { SurfaceManager, findRootComponent, surfaceSchema, a2uIDescriptorSchema } from './state/surface-manager.js';
export type { Surface, A2UIDescriptor, RendererDataModel } from './state/surface-manager.js';
