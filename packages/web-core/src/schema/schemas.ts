import { z } from 'zod';

const VersionSchema = z.literal('v1.0');

export const ComponentIdSchema = z.string().min(1);
export type ComponentId = z.infer<typeof ComponentIdSchema>;

/**
 * 元数据 — 非渲染属性通道（遥测标识、厂商扩展等），见 v1.0 #2187。
 * 合规渲染器 MUST NOT reject 含 extensions 的载荷，故此处保持宽松透传。
 */
export const MetadataSchema = z
  .object({
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();
export type Metadata = z.infer<typeof MetadataSchema>;

export const DataBindingSchema = z.strictObject({
  path: z.string(),
});
export type DataBinding = z.infer<typeof DataBindingSchema>;

export const FunctionCallSchema = z.strictObject({
  call: z.string(),
  catalogId: z.string().optional(),
  args: z.record(z.string(), z.any()).optional(),
});
export type FunctionCall = z.infer<typeof FunctionCallSchema>;

export const DynamicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.any()),
  DataBindingSchema,
  FunctionCallSchema,
]);

export const DynamicStringSchema = z.union([z.string(), DataBindingSchema, FunctionCallSchema]);

export const DynamicBooleanSchema = z.union([z.boolean(), DataBindingSchema, FunctionCallSchema]);

export const DynamicNumberSchema = z.union([z.number(), DataBindingSchema, FunctionCallSchema]);

export const CreateSurfacePayloadSchema = z.strictObject({
  surfaceId: z.string(),
  catalogId: z.string().optional(),
  surfaceProperties: z.record(z.string(), z.any()).optional(),
  sendDataModel: z.boolean().optional(),
  components: z.array(z.any()).optional(),
  dataModel: z.record(z.string(), z.any()).optional(),
  metadata: MetadataSchema,
});

export const UpdateComponentsPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  components: z.array(z.any()),
});

export const UpdateDataModelPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  path: z.string().optional(),
  value: z.any(),
});

export const DeleteSurfacePayloadSchema = z.strictObject({
  surfaceId: z.string(),
});

export const CallRendererFunctionPayloadSchema = z.strictObject({
  call: z.string(),
  catalogId: z.string(),
  args: z.record(z.string(), z.any()).optional(),
});

export const CallRendererFunctionMessageSchema = z.strictObject({
  version: VersionSchema,
  callRendererFunction: z.strictObject({
    functionCallId: z.string(),
    callFunction: CallRendererFunctionPayloadSchema,
  }),
});

export const AgentFunctionResponsePayloadSchema = z
  .strictObject({
    functionCallId: z.string(),
    value: z.any().optional(),
    error: z.strictObject({ code: z.string(), message: z.string() }).optional(),
  })
  .refine((d) => (d.value !== undefined) !== (d.error !== undefined), {
    message: 'agentFunctionResponse 必须且只能包含 value 或 error 之一',
  });

export const AgentFunctionResponseMessageSchema = z.strictObject({
  version: VersionSchema,
  agentFunctionResponse: AgentFunctionResponsePayloadSchema,
});

export const A2uiMessageSchema = z.union([
  z.strictObject({ version: VersionSchema, createSurface: CreateSurfacePayloadSchema }),
  z.strictObject({ version: VersionSchema, updateComponents: UpdateComponentsPayloadSchema }),
  z.strictObject({ version: VersionSchema, updateDataModel: UpdateDataModelPayloadSchema }),
  z.strictObject({ version: VersionSchema, deleteSurface: DeleteSurfacePayloadSchema }),
  CallRendererFunctionMessageSchema,
  AgentFunctionResponseMessageSchema,
]);
export type A2uiMessage = z.infer<typeof A2uiMessageSchema>;

export const CheckRuleSchema = z.strictObject({
  condition: z.union([DataBindingSchema, FunctionCallSchema]),
  message: z.string().optional(),
});

export const ActionEventSchema = z.strictObject({
  name: z.string(),
  userMessage: DynamicStringSchema.optional(),
  context: z.record(z.string(), DynamicValueSchema).optional(),
  metadata: MetadataSchema,
});

export const ActionSchema = z.union([
  z.strictObject({ event: ActionEventSchema }),
  z.strictObject({ functionCall: FunctionCallSchema }),
]);

const AccessibilityAttributesSchema = z.strictObject({
  label: DynamicStringSchema.optional(),
  description: DynamicStringSchema.optional(),
  live: z.enum(['off', 'polite', 'assertive']).optional(),
  hidden: DynamicBooleanSchema.optional(),
});

/** 组件基础字段（basic/geo 组件 schema 共用；geo 扩展见各 catalog 自定义 schema） */
export const ComponentBase = z
  .object({
    id: z.string(),
    component: z.string(),
    catalogId: z.string().optional(),
    weight: z.number().optional(),
    accessibility: AccessibilityAttributesSchema.optional(),
  })
  .loose(); // 宽松：上游各组件为 unevaluatedProperties:false，拼写错误不应静默通过校验

export const TextComponentSchema = ComponentBase.extend({
  component: z.literal('Text'),
  text: DynamicStringSchema,
  variant: z.enum(['caption', 'body']).optional(),
});
export type TextComponent = z.infer<typeof TextComponentSchema>;

export const ButtonComponentSchema = ComponentBase.extend({
  component: z.literal('Button'),
  child: z.string(),
  variant: z.enum(['default', 'primary', 'borderless']).optional(),
  action: ActionSchema,
  checks: z.array(CheckRuleSchema).optional(),
});

export const ImageComponentSchema = ComponentBase.extend({
  component: z.literal('Image'),
  url: DynamicStringSchema,
  description: DynamicStringSchema.optional(),
  fit: z.enum(['contain', 'cover', 'fill', 'none', 'scaleDown']).optional(),
  variant: z.enum(['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header']).optional(),
});

export const RowComponentSchema = ComponentBase.extend({
  component: z.literal('Row'),
  children: z.union([z.array(z.string()), z.strictObject({ componentId: z.string(), path: z.string() })]),
  justify: z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
});

export const ColumnComponentSchema = ComponentBase.extend({
  component: z.literal('Column'),
  children: z.union([z.array(z.string()), z.strictObject({ componentId: z.string(), path: z.string() })]),
  justify: z.enum(['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
});

export const CardComponentSchema = ComponentBase.extend({
  component: z.literal('Card'),
  child: z.string(),
});

export const TextFieldComponentSchema = ComponentBase.extend({
  component: z.literal('TextField'),
  label: DynamicStringSchema,
  value: z.union([z.string(), DataBindingSchema, FunctionCallSchema]).optional(),
  variant: z.enum(['shortText', 'longText', 'number', 'obscured']).optional(),
  placeholder: DynamicStringSchema.optional(),
  checks: z.array(CheckRuleSchema).optional(),
});

export const CheckBoxComponentSchema = ComponentBase.extend({
  component: z.literal('CheckBox'),
  label: DynamicStringSchema,
  value: DynamicBooleanSchema,
  checks: z.array(CheckRuleSchema).optional(),
});

export const SliderComponentSchema = ComponentBase.extend({
  component: z.literal('Slider'),
  label: DynamicStringSchema.optional(),
  min: z.number().optional().default(0),
  max: z.number(),
  value: DynamicNumberSchema,
  steps: z.number().int().min(1).optional(),
  checks: z.array(CheckRuleSchema).optional(),
});

export const ChoicePickerComponentSchema = ComponentBase.extend({
  component: z.literal('ChoicePicker'),
  label: DynamicStringSchema.optional(),
  options: z.array(z.strictObject({ value: z.string(), label: DynamicStringSchema })),
  value: z.union([z.array(z.string()), DataBindingSchema, FunctionCallSchema]),
  variant: z.enum(['mutuallyExclusive', 'multipleSelection']).optional(),
  displayStyle: z.enum(['checkbox', 'chips']).optional(),
  filterable: z.boolean().optional(),
  checks: z.array(CheckRuleSchema).optional(),
});

export const DateTimeInputComponentSchema = ComponentBase.extend({
  component: z.literal('DateTimeInput'),
  value: DynamicStringSchema,
  enableDate: z.boolean().optional(),
  enableTime: z.boolean().optional(),
  min: DynamicStringSchema.optional(),
  max: DynamicStringSchema.optional(),
  label: DynamicStringSchema.optional(),
  checks: z.array(CheckRuleSchema).optional(),
});

export const DividerComponentSchema = ComponentBase.extend({
  component: z.literal('Divider'),
  axis: z.enum(['horizontal', 'vertical']).optional(),
});

export const ListComponentSchema = ComponentBase.extend({
  component: z.literal('List'),
  children: z.union([z.array(z.string()), z.strictObject({ componentId: z.string(), path: z.string() })]),
  direction: z.enum(['vertical', 'horizontal']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
});

export const IconComponentSchema = ComponentBase.extend({
  component: z.literal('Icon'),
  name: z.union([
    z.enum([
      'accountCircle',
      'add',
      'arrowBack',
      'arrowForward',
      'attachFile',
      'calendarToday',
      'call',
      'camera',
      'check',
      'close',
      'delete',
      'download',
      'edit',
      'event',
      'error',
      'fastForward',
      'favorite',
      'favoriteOff',
      'folder',
      'help',
      'home',
      'info',
      'locationOn',
      'lock',
      'lockOpen',
      'mail',
      'menu',
      'moreVert',
      'moreHoriz',
      'notificationsOff',
      'notifications',
      'pause',
      'payment',
      'person',
      'phone',
      'photo',
      'play',
      'print',
      'refresh',
      'rewind',
      'search',
      'send',
      'settings',
      'share',
      'shoppingCart',
      'skipNext',
      'skipPrevious',
      'star',
      'starHalf',
      'starOff',
      'stop',
      'upload',
      'visibility',
      'visibilityOff',
      'volumeDown',
      'volumeMute',
      'volumeOff',
      'volumeUp',
      'warning',
    ]),
    z.strictObject({ svgPath: DynamicStringSchema }),
    DataBindingSchema,
  ]),
});

export const TabsComponentSchema = ComponentBase.extend({
  component: z.literal('Tabs'),
  tabs: z.array(z.strictObject({ title: DynamicStringSchema, child: z.string() })).min(1),
});

export const ModalComponentSchema = ComponentBase.extend({
  component: z.literal('Modal'),
  trigger: z.string(),
  content: z.string(),
});

export const VideoComponentSchema = ComponentBase.extend({
  component: z.literal('Video'),
  url: DynamicStringSchema,
  posterUrl: DynamicStringSchema.optional(),
});

export const AudioPlayerComponentSchema = ComponentBase.extend({
  component: z.literal('AudioPlayer'),
  url: DynamicStringSchema,
  description: DynamicStringSchema.optional(),
});

export const AnyComponentSchema = z.union([
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
]);
export type AnyComponent = z.infer<typeof AnyComponentSchema>;

/**
 * 组件类型名 → 属性 Schema 映射（basic catalog）。
 *
 * 对齐上游 web_core `Catalog<T>` + 5be36dbf
 * `createComponentImplementation(api, component)` 的语义：
 * 组件实现与 schema 配对，处理器按 catalog schema 精确校验属性。
 *
 * 自定义 catalog（如 geo-sensor）的组件 schema 由宿主应用通过
 * `registerComponentSchemas()` 扩展注册，`validateComponentByType`
 * 会合并 basic 与扩展注册的映射进行校验。
 */
export const COMPONENT_SCHEMA_BY_TYPE: Readonly<Record<string, z.ZodTypeAny>> = {
  Text: TextComponentSchema,
  Button: ButtonComponentSchema,
  Image: ImageComponentSchema,
  Row: RowComponentSchema,
  Column: ColumnComponentSchema,
  Card: CardComponentSchema,
  TextField: TextFieldComponentSchema,
  CheckBox: CheckBoxComponentSchema,
  Slider: SliderComponentSchema,
  ChoicePicker: ChoicePickerComponentSchema,
  DateTimeInput: DateTimeInputComponentSchema,
  Divider: DividerComponentSchema,
  List: ListComponentSchema,
  Icon: IconComponentSchema,
  Tabs: TabsComponentSchema,
  Modal: ModalComponentSchema,
  Video: VideoComponentSchema,
  AudioPlayer: AudioPlayerComponentSchema,
};

/** 宿主应用扩展注册的自定义 catalog 组件 schema（basic 之外） */
const EXTRA_COMPONENT_SCHEMAS = new Map<string, ComponentSchemaLike>();

/**
 * 组件属性 Schema 的结构化接口（跨包使用，避免 zod 类型实例身份冲突）。
 *
 * zod v4 中 ZodObject 到 `z.ZodTypeAny`（泛型类默认实例化）的赋值存在
 * 不变型参数冲突（toJSONSchema 等），故对外扩展注册采用仅要求 safeParse
 * 的结构类型，与 catalog-registry 的 ComponentSchemaLike 同构。
 */
export interface ComponentSchemaLike {
  safeParse(input: unknown): { success: boolean; error?: unknown };
}

/**
 * 注册自定义 catalog 组件 schema（basic 之外，如宿主应用的行业扩展组件）。
 *
 * 使渲染核心的组件校验（validateComponentByType）可感知宿主扩展组件；
 * 幂等：重复注册同类型以最新为准。
 */
export function registerComponentSchemas(schemas: Readonly<Record<string, ComponentSchemaLike>>): void {
  for (const [type, schema] of Object.entries(schemas)) {
    EXTRA_COMPONENT_SCHEMAS.set(type, schema);
  }
}

export function validateComponent(comp: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const result = AnyComponentSchema.safeParse(comp);
  if (result.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: result.error?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`) ?? ['校验失败'],
  };
}

/**
 * 按组件类型精确校验组件属性。
 *
 * 优先使用该类型的 Schema（basic 注册表 → 宿主扩展注册表），
 * 类型未知时回退到 basic 全量 union 校验。
 */
export function validateComponentByType(
  comp: Record<string, unknown>,
  componentType: string,
): { valid: boolean; errors: string[] } {
  const schema = COMPONENT_SCHEMA_BY_TYPE[componentType] ?? EXTRA_COMPONENT_SCHEMAS.get(componentType);
  const target = schema ?? AnyComponentSchema;
  const result = target.safeParse(comp);
  if (result.success) return { valid: true, errors: [] };
  const issues = (result.error as { issues?: Array<{ path: (string | number)[]; message: string }> } | undefined)
    ?.issues;
  return {
    valid: false,
    errors: issues?.map((i) => `${i.path.join('.')}: ${i.message}`) ?? ['校验失败'],
  };
}

// ============================================================================
// Renderer → Agent 消息（v1.0 client-to-server）
// ============================================================================

/** Renderer 动作载荷（v1.0 renderer_to_agent action；#2210 移除 wantResponse/actionId，#2228 新增 userMessage） */
export const ClientActionPayloadSchema = z.object({
  name: z.string(),
  userMessage: z.string().optional(),
  surfaceId: z.string(),
  sourceComponentId: z.string(),
  timestamp: z.string(),
  context: z.record(z.string(), z.unknown()),
});
export type ClientActionPayload = z.infer<typeof ClientActionPayloadSchema>;

/** Renderer 动作消息 */
export const A2uiClientActionMessageSchema = z
  .strictObject({
    version: z.literal('v1.0'),
    action: ClientActionPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiClientActionMessage = z.infer<typeof A2uiClientActionMessageSchema>;

/** callAgentFunction 载荷（v1.0 #2210 renderer→agent 远程函数调用） */
export const CallAgentFunctionPayloadSchema = z.strictObject({
  surfaceId: z.string(),
  functionCallId: z.string(),
  callFunction: z.strictObject({
    call: z.string(),
    catalogId: z.string().optional(),
    args: z.record(z.string(), z.any()).optional(),
  }),
});

/** callAgentFunction 消息 */
export const A2uiClientCallAgentFunctionMessageSchema = z
  .strictObject({
    version: z.literal('v1.0'),
    callAgentFunction: CallAgentFunctionPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });

/** rendererFunctionResponse 载荷（v1.0 #2210，对应 agent 的 callRendererFunction） */
export const RendererFunctionResponsePayloadSchema = z
  .strictObject({
    functionCallId: z.string(),
    value: z.any().optional(),
    error: z.strictObject({ code: z.string(), message: z.string() }).optional(),
  })
  .refine((d) => (d.value !== undefined) !== (d.error !== undefined), {
    message: 'rendererFunctionResponse 必须且只能包含 value 或 error 之一',
  });

/** rendererFunctionResponse 消息 */
export const A2uiRendererFunctionResponseMessageSchema = z
  .strictObject({
    version: z.literal('v1.0'),
    rendererFunctionResponse: RendererFunctionResponsePayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });

/** Renderer 错误载荷（v1.0 renderer_to_agent error） */
export const ClientErrorPayloadSchema = z.union([
  z.strictObject({
    surfaceId: z.string(),
    path: z.string(),
    message: z.string(),
    code: z.literal('VALIDATION_FAILED'),
  }),
  z.strictObject({
    surfaceId: z.string().optional(),
    path: z.string().optional(),
    message: z.string(),
    code: z.string(),
    functionCallId: z.string().optional(),
  }),
]);
export type ClientErrorPayload = z.infer<typeof ClientErrorPayloadSchema>;

/** Renderer 错误消息 */
export const A2uiClientErrorMessageSchema = z
  .strictObject({
    version: z.literal('v1.0'),
    error: ClientErrorPayloadSchema,
  })
  .refine((obj) => Object.keys(obj).length === 2, { message: '消息只能包含 version 和一个操作类型' });
export type A2uiClientErrorMessage = z.infer<typeof A2uiClientErrorMessageSchema>;
