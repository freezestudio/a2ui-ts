/**
 * A2UI TypeScript SDK
 * 实现 a2ui v1.0 协议
 */

// ============================================================================
// Schema 模块 — 协议类型与校验
// ============================================================================

export * from './schema/index.js';

export {
  A2uiSchemaManager,
  createSchemaManager,
  schemaManagerConfigSchema,
  generatePromptConfigSchema,
  type SchemaManagerConfig,
  type GeneratePromptConfig,
} from './schema/manager.js';

export {
  A2uiValidator,
  createValidator,
  validationErrorSchema,
  validationResultSchema,
  validationConfigSchema,
  resolveComponentCatalog,
  type ValidationError,
  type ValidationResult,
  type ValidationConfig,
  STRICT_VALIDATION,
  RELAXED_VALIDATION,
} from './schema/validator.js';

// ============================================================================
// 拓扑分析与完整性检查
// ============================================================================

export {
  extractRefFields,
  analyzeTopology,
  refFieldsMapSchema,
  topologyConfigSchema,
  type RefFieldsMap,
  type TopologyConfig,
} from './schema/topology-analyzer.js';

export {
  checkComponentIntegrity,
  checkFunctionCallDepth,
  checkPathSyntax,
  validatePathSyntax,
} from './schema/integrity-checker.js';

// ============================================================================
// Parser 模块
// ============================================================================

export {
  A2uiStreamParser,
  parseResponse,
  createStreamParser,
  streamParserConfigSchema,
  responsePartSchema,
  parseResultSchema,
  type StreamParserConfig,
  type ResponsePart,
  type ParseResult,
} from './parser/streaming.js';

export {
  IncrementalStreamParser,
  IncrementalResponsePartSchema,
  PartialComponentSchema,
  IncrementalParserConfigSchema,
  DataModelDeltaSchema,
  type IncrementalResponsePart,
  type PartialComponent,
  type IncrementalParserConfig,
  type DataModelDelta,
} from './parser/incremental-stream-parser.js';

// ============================================================================
// Catalog 模块
// ============================================================================

export { Catalog } from './catalog/catalog.js';

export {
  validateComponentProps,
  validateValue,
  componentValidationIssueSchema,
  type ComponentValidationIssue,
} from './catalog/component-validator.js';

export { CatalogProvider, createDefaultCatalogProvider } from './catalog/provider.js';

export {
  componentApiSchema,
  catalogComponentCommonSchema,
  functionContextSchema,
  catalogConfigSchema,
  type CatalogConfig,
  type ComponentApi,
  type FunctionApi,
  type FunctionContext,
  type CatalogComponentCommon,
} from './catalog/types.js';

export { createComponentApi, createFunctionApi } from './catalog/types.js';

export { getSchemaDir, getCatalogDir, createBasicCatalogPath, getSchemaPath } from './catalog/resource-path.js';

// ============================================================================
// BasicCatalog — 内置组件与函数
// ============================================================================

export {
  BasicCatalog,
  createBasicCatalog,
  createFullCatalog,
  BASIC_CATALOG_ID,
  EXTENDED_CATALOG_ID,
} from './basic-catalog/index.js';

export {
  TextComponentSchema,
  ButtonComponentSchema,
  RowComponentSchema,
  ColumnComponentSchema,
  CardComponentSchema,
  ImageComponentSchema,
  TextFieldComponentSchema,
  IconComponentSchema,
  VideoComponentSchema,
  AudioPlayerComponentSchema,
  ListComponentSchema,
  TabsComponentSchema,
  ModalComponentSchema,
  DividerComponentSchema,
  CheckBoxComponentSchema,
  ChoicePickerComponentSchema,
  SliderComponentSchema,
  DateTimeInputComponentSchema,
  FULL_COMPONENTS,
} from './basic-catalog/components/index.js';

export { capitalizeFunction, FULL_FUNCTIONS } from './basic-catalog/functions/index.js';

export { ThemeSchema, MinimalThemeSchema, type Theme } from './basic-catalog/styles.js';

export {
  ExpressionParser,
  parseTemplateExpression,
  type ParseResult as ExpressionParseResult,
} from './basic-catalog/expression-parser.js';

export {
  type LocaleFormattingRules,
  getLocaleRules,
  registerLocaleRules,
  CURRENCY_SYMBOLS,
} from './basic-catalog/locale-config.js';

export { COMPONENT_CONSTRAINTS } from './basic-catalog/component-constraints.js';

// ============================================================================
// A2A 集成模块
// ============================================================================

export {
  A2UI_MIME_TYPE,
  createA2uiPart,
  isA2uiPart,
  extractA2uiParts,
  getA2uiData,
  a2uiMessagesToPart,
  partToA2uiMessages,
  createA2uiExtension,
  A2UI_EXTENSION_URI,
  A2UI_EXTENSION_URI_V1_0,
  A2UI_EXTENSION_VERSION,
  isA2uiExtension,
  extractA2uiParams,
  negotiateA2uiVersion,
  a2aTextPartSchema,
  a2aDataPartSchema,
  a2aRawPartSchema,
  a2aUrlPartSchema,
  a2aPartSchema,
  a2aTaskStateSchema,
  a2aTaskStatusSchema,
  a2aTaskSchema,
  a2uiServerCapabilitiesSchema,
  agentExtensionSchema,
} from './a2a/index.js';

export type {
  A2uiServerCapabilities as A2uiExtensionParams,
  AgentExtension,
  A2APart,
  A2ATextPart,
  A2ADataPart,
  A2ARawPart,
  A2AUrlPart,
  A2ATask,
  A2ATaskStatus,
  A2ATaskState,
} from './a2a/index.js';

// ============================================================================
// Logger 模块
// ============================================================================

export {
  LLMSaveLogger,
  createLLMSaveLogger,
  llmCallRecordSchema,
  llmSaveLoggerConfigSchema,
  type LLMCallRecord,
  type LLMSaveLoggerConfig,
} from './logger/llm-save-logger.js';

export { createLogger, createChildLogger, logger, type LogLevel } from './logger/pino-config.js';

// ============================================================================
// Core 模块 — 共享类型与工具
// ============================================================================

export {
  Subscription,
  EventSource,
  Signal,
  A2uiAbortSignal,
  type EventHandler,
  type ProtocolVersion,
  type SurfaceId,
  type ComponentId,
  type JsonValue,
  deepMerge,
  parseJsonPointer,
} from './core/index.js';

// ============================================================================
// 状态管理模块（实验性参考实现，不公开导出）
// ============================================================================
//
// state/ 是官方 Python SDK（core/state/ + core/rendering/）的 TypeScript 移植，
// 定位为"headless renderer 参考实现"。当前项目实际渲染器在 apps/web 独立实现
// （Angular Signal），未消费本模块；且本模块尚有缺口（NodeGraph 装配、@index、
// 集合作用域、sendDataModel 载荷等）未接通业务闭环。
//
// 故从公共 API 收敛：不在此处导出，仅保留源码与单测作为参考/未来基础。
// 若需引用，请直接 import 自 './state/index.js'。
//
// ============================================================================
// 版本信息
// ============================================================================

export const VERSION = '1.0.0';
export const PROTOCOL_VERSION = 'v1_0';
