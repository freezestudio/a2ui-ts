/**
 * A2UI v1.0 公共类型定义
 * 对应 JSON Schema: common_types.json
 */

import { z } from 'zod';

// ============================================================================
// 厂商扩展接缝（v1.0 #2187 Vendor Extension Seam）
// ============================================================================

/**
 * 厂商扩展标识键 — UAX #31 标识符（XML NameStartChar / NameChar 子集）。
 * 规范保留 `a2ui_` 前缀给协议本身，厂商扩展不得占用。
 */
const UAX31_IDENTIFIER = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

/**
 * 扩展集合 — metadata.extensions 的取值。
 *
 * 键必须是 UAX #31 合法标识符；`a2ui_` 前缀保留给官方扩展（厂商不得占用，
 * 但验证器不拒绝——规范 schema 仅校验 UAX #31，见官方 common_types.json）。
 */
export const ExtensionsSchema = z
  .record(z.string(), z.unknown())
  .refine((ext) => Object.keys(ext).every((k) => UAX31_IDENTIFIER.test(k)), {
    message: '扩展键必须是 UAX #31 合法标识符',
    path: ['extensions'],
  });
export type Extensions = z.infer<typeof ExtensionsSchema>;

/**
 * 元数据 — 非渲染属性通道（遥测标识、厂商扩展等）。
 * 规范强制：合规渲染器 MUST NOT reject 含 extensions 的载荷。
 * 规范 common_types.json：metadata 仅允许 extensions（additionalProperties: false）。
 */
export const MetadataSchema = z
  .strictObject({
    extensions: ExtensionsSchema.optional(),
  })
  .optional();
export type Metadata = z.infer<typeof MetadataSchema>;

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 组件唯一标识符
 */
export const ComponentIdSchema = z.string();
export type ComponentId = z.infer<typeof ComponentIdSchema>;

/**
 * 函数调用唯一标识符（v1.0 新增）
 * 用于 Agent 发起的函数调用
 */
export const CallIdSchema = z.string().min(1);
export type CallId = z.infer<typeof CallIdSchema>;

/**
 * 可访问性属性
 * v1.0 (#2209): 新增 live（aria-live 动态更新播报）与 hidden（从辅助技术隐藏）
 */
export const AccessibilityAttributesSchema = z.strictObject({
  label: z.union([z.string(), z.lazy(() => DataBindingSchema), z.lazy(() => FunctionCallSchema)]).optional(),
  description: z.union([z.string(), z.lazy(() => DataBindingSchema), z.lazy(() => FunctionCallSchema)]).optional(),
  live: z.enum(['off', 'polite', 'assertive']).optional(),
  hidden: z.lazy(() => DynamicBooleanSchema).optional(),
});
export type AccessibilityAttributes = z.infer<typeof AccessibilityAttributesSchema>;

/**
 * 组件公共基础属性
 */
export const ComponentCommonSchema = z.object({
  id: ComponentIdSchema,
  catalogId: z.string().optional(),
  accessibility: AccessibilityAttributesSchema.optional(),
  metadata: MetadataSchema,
});
export type ComponentCommon = z.infer<typeof ComponentCommonSchema>;

// ============================================================================
// 数据绑定
// ============================================================================

/**
 * 数据绑定 — 指向 DataModel 中值的 JSON Pointer 路径
 */
export const DataBindingSchema = z.strictObject({
  path: z.string(),
});
export type DataBinding = z.infer<typeof DataBindingSchema>;

/**
 * 函数调用 — 在 Renderer 调用命名的函数
 * v1.0: 删除 returnType 字段
 *
 * 注意：JSON Schema 中 FunctionCall 定义含 oneOf 约束
 * （匹配 catalog 函数或 @index 系统函数），此处保留宽松版本以兼容运行时动态函数名。
 * 运行时需配合 catalog 校验函数名的合法性。
 *
 * 严格性（对齐规范 common_types.json#/$defs/FunctionCall）：
 * - strictObject：拒绝未知属性（unevaluatedProperties: false 语义）
 * - @index 系统函数（IndexSystemFunction）：不允许 catalogId，args 仅允许 offset
 */
export const FunctionCallSchema = z
  .strictObject({
    call: z.string().min(1, '函数名不能为空'),
    catalogId: z.string().optional(),
    args: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((fc, ctx) => {
    if (fc.call === '@index') {
      if (fc.catalogId !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: '@index 系统函数不允许携带 catalogId',
          path: ['catalogId'],
        });
      }
      if (fc.args) {
        for (const key of Object.keys(fc.args)) {
          if (key !== 'offset') {
            ctx.addIssue({
              code: 'custom',
              message: `@index 系统函数不允许参数 "${key}"（仅允许 offset）`,
              path: ['args', key],
            });
          }
        }
      }
    }
  }) satisfies z.ZodType<{ call: string; catalogId?: string; args?: Record<string, unknown> }>;
export type FunctionCall = z.infer<typeof FunctionCallSchema>;

/**
 * @index 系统函数（v1.0 新增）
 * 在模板列表渲染中返回当前项的 0-based 索引
 */
export const IndexSystemFunctionSchema = z.object({
  call: z.literal('@index'),
  args: z
    .object({
      offset: z.lazy(() => DynamicNumberSchema).optional(),
    })
    .optional(),
});
export type IndexSystemFunction = z.infer<typeof IndexSystemFunctionSchema>;

// ============================================================================
// 动态值类型
// ============================================================================

/**
 * 动态值 — 可以是字面量、数据绑定或函数调用
 * v1.0 #2229: 支持 object/array 字面量（object 需为普通字面量，不含 path/call）
 */
export const DynamicValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z
    .record(z.string(), z.unknown())
    .refine((v) => !('path' in v) && !('call' in v), { message: 'object 字面量不能包含 path/call' }),
  DataBindingSchema,
  FunctionCallSchema,
]);
export type DynamicValue = z.infer<typeof DynamicValueSchema>;

/**
 * 动态字符串
 * v1.0: 简化为 FunctionCall 引用（不再有 returnType 约束）
 */
export const DynamicStringSchema = z.union([z.string(), DataBindingSchema, FunctionCallSchema]);
export type DynamicString = z.infer<typeof DynamicStringSchema>;

/**
 * 动态数字
 */
export const DynamicNumberSchema = z.union([z.number(), DataBindingSchema, FunctionCallSchema]);
export type DynamicNumber = z.infer<typeof DynamicNumberSchema>;

/**
 * 动态布尔值
 */
export const DynamicBooleanSchema = z.union([z.boolean(), DataBindingSchema, FunctionCallSchema]);
export type DynamicBoolean = z.infer<typeof DynamicBooleanSchema>;

/**
 * 动态字符串数组
 */
export const DynamicStringListSchema = z.union([z.array(z.string()), DataBindingSchema, FunctionCallSchema]);
export type DynamicStringList = z.infer<typeof DynamicStringListSchema>;

// ============================================================================
// 子组件列表
// ============================================================================

/**
 * 模板子组件列表
 */
export const TemplateChildListSchema = z.strictObject({
  componentId: ComponentIdSchema,
  path: z.string(),
});
export type TemplateChildList = z.infer<typeof TemplateChildListSchema>;

/**
 * 子组件列表 — 静态 ID 列表或动态模板
 */
export const ChildListSchema = z.union([z.array(ComponentIdSchema), TemplateChildListSchema]);
export type ChildList = z.infer<typeof ChildListSchema>;

/** 单组件引用 */
export const SingleReferenceSchema = ComponentIdSchema;
export type SingleReference = z.infer<typeof SingleReferenceSchema>;

/** 列表引用 */
export const ListReferenceSchema = ChildListSchema;
export type ListReference = z.infer<typeof ListReferenceSchema>;

// ============================================================================
// 校验规则
// ============================================================================

/**
 * 校验规则
 * v1.0 #2220: condition 从 DynamicBoolean 改为 DataBinding / FunctionCall 的 oneOf，
 * 求值结果为 ValidationResult 对象（{valid, code?, message?, severity?}）；
 * message 变更为可选兜底错误信息。
 */
export const CheckRuleSchema = z.strictObject({
  condition: z.union([DataBindingSchema, FunctionCallSchema]),
  message: z.string().optional(),
});
export type CheckRule = z.infer<typeof CheckRuleSchema>;

/**
 * 动态校验结果对象（v1.0 #2220 新增）
 * 校验条件函数或数据绑定求值返回的标准结构。
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  severity: z.enum(['error', 'warning', 'info']).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * 可校验属性
 */
export const CheckableSchema = z.object({
  checks: z.array(CheckRuleSchema).optional(),
});
export type Checkable = z.infer<typeof CheckableSchema>;

// ============================================================================
// 动作系统（v1.0 #2210: 移除 wantResponse/responsePath，改由 callAgentFunction 双向函数调用）
// ============================================================================

/**
 * 事件包装器
 * v1.0 #2228: 新增 userMessage（人类可读的动作描述）
 * v1.0 #2210: 移除 wantResponse / responsePath（响应机制由 callAgentFunction/agentFunctionResponse 替代）
 */
export const ActionEventSchema = z.strictObject({
  name: z.string(),
  userMessage: DynamicStringSchema.optional(),
  context: z.record(z.string(), DynamicValueSchema).optional(),
  metadata: MetadataSchema,
});
export type ActionEvent = z.infer<typeof ActionEventSchema>;

/**
 * 动作定义
 * v1.0 #2210: functionCall 描述为 "Executes a renderer or agent-side function"
 */
export const ActionSchema = z.union([
  z.strictObject({
    event: ActionEventSchema,
  }),
  z.strictObject({
    functionCall: FunctionCallSchema,
  }),
]);
export type Action = z.infer<typeof ActionSchema>;

// ============================================================================
// 函数响应（v1.0 #2210 双向函数调用公共类型）
// ============================================================================

/**
 * 函数响应 — callAgentFunction / callRendererFunction 的执行结果或错误。
 * functionCallId 必填，value 与 error 二选一（互斥）。
 */
export const FunctionResponseSchema = z
  .strictObject({
    functionCallId: CallIdSchema,
    value: z.unknown().optional(),
    error: z
      .strictObject({
        code: z.string(),
        message: z.string(),
      })
      .optional(),
  })
  .refine((d) => (d.value !== undefined) !== (d.error !== undefined), {
    message: 'FunctionResponse 必须且只能包含 value 或 error 之一',
  });
export type FunctionResponse = z.infer<typeof FunctionResponseSchema>;

// ============================================================================
// 工具类型
// ============================================================================

/** 判断是否为 DataBinding */
export function isDataBinding(value: unknown): value is DataBinding {
  return typeof value === 'object' && value !== null && 'path' in value && !('call' in value);
}

/** 判断是否为 FunctionCall */
export function isFunctionCall(value: unknown): value is FunctionCall {
  return typeof value === 'object' && value !== null && 'call' in value && !('path' in value);
}

/** 判断 ChildList 是否为模板 */
export function isTemplateChildList(value: unknown): value is TemplateChildList {
  return typeof value === 'object' && value !== null && 'componentId' in value && 'path' in value;
}
