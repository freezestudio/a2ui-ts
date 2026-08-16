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
} from './common/errors.js';
export type { A2uiErrorPayload } from './common/errors.js';

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
  getFunctionCallableFrom,
  getFunctionRequiresActivation,
  isKnownFunction,
  registerRendererFunction,
} from './processing/function-call.js';
export type { ActionIntent } from './processing/function-call.js';

export {
  processMessage,
  isValidMessage,
  validateComponents,
  resolveCatalog,
  clearAllPending,
} from './processing/message-handler.js';
export type { A2UIMessage } from './processing/message-handler.js';

export { SurfaceManager, findRootComponent, surfaceSchema, a2uIDescriptorSchema } from './state/surface-manager.js';
export type { Surface, A2UIDescriptor } from './state/surface-manager.js';
