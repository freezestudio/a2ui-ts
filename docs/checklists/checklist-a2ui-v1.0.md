# A2UI v1.0 协议核查表

> 规范: https://a2ui.org/specification/v1.0-a2ui/
> A2A 扩展: https://a2ui.org/specification/v1.0-a2ui-extension-specification/
> 数据绑定: https://a2ui.org/concepts/data-binding/
> Action: https://a2ui.org/concepts/actions/

---

## 一、消息 Envelope

### 类型结构

```typescript
// 每条消息必须是 { version, [消息类型key] }
interface ServerToClientMessage {
  version: 'v1.0'; // ★ 必填
  createSurface?: CreateSurfaceMessage;
  updateComponents?: UpdateComponentsMessage;
  updateDataModel?: UpdateDataModelMessage;
  deleteSurface?: DeleteSurfaceMessage;
  callFunction?: CallFunctionMessage;
  actionResponse?: ActionResponseMessage;
  // exactly one of the above must be present
}

interface ClientToServerMessage {
  version: 'v1.0'; // ★ 必填
  action?: ActionMessage;
  functionResponse?: FunctionResponseMessage;
  error?: ErrorMessage;
}
```

### 核查项

| #   | 核查项                                                                                                                                                          | ✓   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1.1 | 每条消息是否都有 `"version": "v1.0"`？                                                                                                                          |     |
| 1.2 | 每条消息是否**恰好包含一个**操作 key（如 `createSurface`）而非多个？                                                                                            |     |
| 1.3 | 每条消息的 Schema 是否验证了 `version` 字段的值必须为 `"v1.0"`？                                                                                                |     |
| 1.4 | 消息 Envelope 是否使用 `oneOf` 分发 6 种消息类型（`createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface`、`callFunction`、`actionResponse`）？ |     |
| 1.5 | `callFunction` 消息中，`functionCallId` 和 `wantResponse` 是否作为**顶层兄弟字段**（与 `version` 同级，非嵌套在 `callFunction` 内部）？                         |     |
| 1.6 | 校验失败后是否返回 error 对象而非抛异常？                                                                                                                       |     |
| 1.7 | 校验失败后是否**继续处理**后续消息（A2UI v1.0 规范要求）？                                                                                                      |     |
| 1.8 | DataPart 的 `data` 字段是否为**消息数组**（而非单个消息对象）？                                                                                                 |     |

### 常见误用

- ❌ version 为 `"1.0"` 或 `"v1"` → ✅ 必须是 `"v1.0"`
- ❌ 一条消息包含 `createSurface` + `updateComponents` 两个 key → ✅ 分开两条
- ❌ version 字段放在操作 key 内部 → ✅ 必须在顶层
- ❌ `callFunction` 的 `functionCallId`/`wantResponse` 嵌套在 `callFunction` 内部 → ✅ 必须是顶层兄弟字段
- ❌ 遇到无效消息时抛异常终止后续消息 → ✅ 只报告错误，继续处理后续

---

## 二、createSurface

### 类型结构

```typescript
interface CreateSurfaceMessage {
  surfaceId: string; // ★ 必填，全局唯一
  catalogId?: string; // v1.0: 可选，surface 级默认 catalog（组件级 catalogId 可覆盖，见 §mixable catalog）
  surfaceProperties?: Record<string, unknown>; // ⚠ 项目扩展：上游 v1.0 已移除（#2126），本项目保留用于 Agent 身份标识
  sendDataModel?: boolean; // default false
  components?: ComponentDef[]; // v1.0: 可内联初始组件
  dataModel?: Record<string, unknown>; // v1.0: 可内联初始数据
}
```

### 核查项

| #    | 核查项                                                                                                             | ✓   |
| ---- | ------------------------------------------------------------------------------------------------------------------ | --- |
| 2.1  | `surfaceId` 是否全局唯一（不会重复创建同一 surfaceId）？                                                           |     |
| 2.2  | 重复创建同一 surfaceId 是否返回 `DUPLICATE_SURFACE` 错误？                                                         |     |
| 2.3  | `catalogId`（可选）是否为该 surface 的默认 catalog？组件级 `catalogId` 覆盖是否正确解析（mixable catalog）？       |     |
| 2.4  | 如果内联了 `components`，是否有一个 `id="root"` 的组件作为根？                                                     |     |
| 2.5  | `sendDataModel: true` 时，客户端的每次 action 是否携带了该 surface 的完整 data model？                             |     |
| 2.6  | ⚠ 项目扩展：`surfaceProperties` 是否符合 catalog 定义的 surfaceProperties schema？（上游 v1.0 已移除，本项目保留） |     |
| 2.7  | ⚠ 项目扩展：`surfaceProperties` 是否包含标准字段 `agentDisplayName`（用于 Agent 身份标识）？（上游 v1.0 已移除）   |     |
| 2.8  | surface 创建后，后续的 `updateComponents`/`updateDataModel` 是否指向同一个 `surfaceId`？                           |     |
| 2.9  | `createSurface.metadata.extensions` 是否被透传且不阻断渲染（v1.0 #2187 厂商扩展接缝）？                            | ✅  |
| 2.10 | `metadata.extensions` 键是否为 UAX #31 合法标识符（`a2ui_` 为官方保留前缀，协议 schema 不拒绝、厂商不得占用）？    | ✅  |
| 2.11 | 组件未声明 `catalogId` 时，是否回退到 surface 级默认 catalog 解析？                                                |     |
| 2.12 | `accessibility.live` / `accessibility.hidden` 是否支持（上游 #2209，SDK/渲染器已实现）？                           | ✅  |

### 常见误用

- ❌ surfaceId 使用中文或特殊字符 → ✅ 建议 ASCII 标识符
- ❌ catalogId 指向不存在的 URL → ✅ catalogId 只是标识符，不要求可解析，但必须与前端一致
- ❌ 内联 components 中没有 `id="root"` → ✅ 至少一个组件 ID 为 `"root"`
- ❌ 前端未注册对应 catalog 就收到 createSurface → 渲染失败

---

## 三、updateComponents

### 类型结构

```typescript
interface UpdateComponentsMessage {
  surfaceId: string; // ★ 必填
  components: ComponentDef[]; // ★ 必填，邻接表（非嵌套树）
}

interface ComponentDef {
  id: string; // ★ 必填，组件唯一 ID
  component: string; // ★ 必填，组件类型名（如 "Text"、"SensorCard"）
  // ...其他属性由 Catalog schema 定义
}
```

### 核查项

| #    | 核查项                                                                                                     | ✓   |
| ---- | ---------------------------------------------------------------------------------------------------------- | --- |
| 3.1  | `surfaceId` 是否已通过 `createSurface` 创建？                                                              |     |
| 3.2  | 如果 surface 不存在，是否将消息缓存到 pending 队列而非丢弃？                                               |     |
| 3.3  | 已存在的组件 ID 发送新的 `updateComponents` 是否为**覆盖更新**（声明式）？                                 |     |
| 3.4  | 组件的 `component` 字段是否使用**PascalCase**（如 `"Text"`，与 Catalog 定义大小写严格一致）？              |     |
| 3.5  | 组件类型名是否符合 UAX #31 命名规则（`/^[\p{XID_Start}_][\p{XID_Continue}]*$/u`）？                        |     |
| 3.6  | 组件属性是否使用了 `Dynamic*` 类型（字面值 / path / FunctionCall 三态）？                                  |     |
| 3.7  | 组件的 `children` 是否使用了 `ChildList`（`array` 或 `object` 模式）？                                     |     |
| 3.8  | `array` 模式的 children 是否是 `ComponentId[]`？                                                           |     |
| 3.9  | `object` 模式的 children 是否包含 `path` 和 `componentId`？                                                |     |
| 3.10 | 孤儿子引用（child 引用的 ID 不在当前 componentRegistry 中）是否显示 placeholder 而非崩溃？                 |     |
| 3.11 | 缺失的子组件在后续 `updateComponents` 消息中到达后，placeholder 是否自动替换为真实组件（`linkedSignal`）？ |     |

### 常见误用

- ❌ `component` 写成大写 `"TEXT"` → ✅ 组件类型名大小写与 Catalog 定义一致
- ❌ children 使用嵌套 JSON 而非邻接表 ID → ✅ 必须用 ID 引用
- ❌ 待更新组件不存在 → ✅ 应视为新组件添加
- ❌ `DynamicString` 写成 `{ "path": "name" }` 而非 `{ "path": "/name" }`
- ❌ `FunctionCall` 使用不存在的函数名（如 `call: "myFunc"`）→ 前端 functionRegistry 中查不到

---

## 四、updateDataModel / deleteSurface

### 核查项

| #   | 核查项                                                                    | ✓   |
| --- | ------------------------------------------------------------------------- | --- |
| 4.1 | `updateDataModel` 的 `path` 是否为有效的 JSON Pointer（RFC 6901）？       |     |
| 4.2 | `path` 省略或为 `/` 时是否替换整个 data model？                           |     |
| 4.3 | `value` 为 `null` 时，是否为删除该路径的 key？（v1.0 标准化语义）         |     |
| 4.4 | `value` 为 `null` 时，是否为删除该路径的 key？（v1.0 标准化语义）         |     |
| 4.5 | `updateDataModel` 后，绑定到该 path 的组件的值是否自动更新？              |     |
| 4.6 | `deleteSurface` 是否级联清理该 surface 的 DataModel + ComponentRegistry？ |     |
| 4.7 | surface 被删除后到达的该 surfaceId 的消息是否静默忽略？                   |     |

### 常见误用

- ❌ `path` 不带前导 `/`（如 `"user/name"`）→ ✅ RFC 6901 要求 `"/user/name"`
- ❌ `path` 中的数组索引写成 `"/items.0"` → ✅ RFC 6901 用 `"/items/0"`
- ❌ 删除 surface 后未清理 DataModelStore → 内存泄漏

---

## 五、Dynamic\* 类型（DynamicString / DynamicNumber / DynamicBoolean）

### 三态结构

```typescript
// 字面值
{ "text": "Hello" }                              // string
{ "text": 42 }                                   // number
{ "text": true }                                 // boolean

// JSON Pointer 路径
{ "text": { "path": "/user/name" } }             // 从 DataModel 读取

// FunctionCall
{ "text": { "call": "formatString", "args": { "template": "${/name}: ${/value}" } } }
```

### 核查项

| #   | 核查项                                                                                                                                                         | ✓   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 5.1 | Zod Schema 的 DynamicString 是否定义为 `z.union([z.string(), z.object({ path: z.string() }), z.object({ call: z.string(), args: z.record(...) })])`？          |     |
| 5.2 | JSON Pointer 路径的解析是否使用 RFC 6901 标准（`/user/name` → data.user.name）？                                                                               |     |
| 5.3 | scope-aware 路径解析：collection scope 内 `/name` 是否解析为 `/items/2/name`？                                                                                 |     |
| 5.4 | `FunctionCall` 的 Schema 是否使用 `oneOf` 匹配 `anyFunction` 或 `IndexSystemFunction`（即只允许 catalog 注册的函数和 `@index` 系统函数）？                     |     |
| 5.5 | FunctionCall 的 args 是否可以**递归**包含 path 或另一个 call？                                                                                                 |     |
| 5.6 | `formatString` 函数是否支持 `${...}` 插值语法（`${/path}`、`${relativeName}`、`${fnName(args)}`、`${fn1(${fn2(args)})}`）而非 v0.9 的 `{path}`/`{call}` 语法？ |     |
| 5.7 | `${...}` 中的转义 `\${` 是否显示为字面 `${`？                                                                                                                  |     |
| 5.7 | `@index` 函数是否只能在 collection scope 内使用？                                                                                                              |     |
| 5.8 | `@index` 的返回值是否为 0-based 整数？                                                                                                                         |     |

### 常见误用

- ❌ `{ "path": "name" }` 缺少前导 `/` → ✅ `{ "path": "/name" }`（绝对路径）或在前端做 scoped 解析
- ❌ FunctionCall 的 `args` 中有死循环引用（A call B，B call A）→ 渲染器应设置最大递归深度
- ❌ `@index` 在 root scope 中使用 → 应返回错误

---

## 六、ChildList（array / object 模式）

### 类型结构

```typescript
// array 模式
{ "children": ["header", "body", "footer"] }

// object（模板）模式
{
  "children": {
    "path": "/items",          // 数据数组路径
    "componentId": "item-card"  // 模板组件 ID
  }
}
```

### 核查项

| #   | 核查项                                                                                                            | ✓   |
| --- | ----------------------------------------------------------------------------------------------------------------- | --- |
| 6.1 | `array` 模式是否直接返回 `ComponentId[]`？                                                                        |     |
| 6.2 | `object` 模式是否用 `computed` Signal 追踪 dataModel 变化？                                                       |     |
| 6.3 | `object` 模式的 `computed` 是否在 dataModel 变化时只改变子组件内容，不重建组件实例（`@for trackBy instanceId`）？ |     |
| 6.4 | 模板实例的 `instanceId` 是否格式为 `${templateComponentId}:${index}`？                                            |     |
| 6.5 | 数组长度减少时，多余的实例是否被 Angular 自动销毁？                                                               |     |
| 6.6 | 数组长度增加时，新实例的 scope 是否正确（`/items/2` 等）？                                                        |     |

### 常见误用

- ❌ `object` 模式的 `path` 指向非数组数据 → ✅ 返回空数组 `[]`
- ❌ `componentId` 引用的模板组件不存在 → ✅ placeholder
- ❌ 改变了数据但 `computed` 的 `equal` 函数太粗糙 → 触发不必要的重渲染

---

## 七、Action + FunctionResponse + Error（双向 RPC）

### 类型结构

```typescript
// Client → Server: action
interface ActionMessage {
  name: string; // ★ action 名称
  surfaceId: string; // ★
  sourceComponentId: string; // ★ 触发组件
  timestamp: string; // ★ ISO 8601（必填）
  context: Record<string, unknown>; // ★ action 上下文（必填）
  wantResponse?: boolean; // 是否需要 actionResponse
  actionId?: string; // 如有 wantResponse 则为必填
}

// Server → Client: actionResponse
interface ActionResponseMessage {
  actionId: string; // ★ 对应 action.actionId
  actionResponse: {
    value?: unknown; // 成功时
    error?: { code: string; message: string }; // 失败时
  };
  // value 和 error 互斥
}

// Client → Server: functionResponse
interface FunctionResponseMessage {
  functionCallId: string; // ★ 对应 callFunction 的 functionCallId
  call: string; // 函数名
  value?: unknown;
}

// Client → Server: error
interface ErrorMessage {
  code: string; // ★ 如 "INVALID_FUNCTION_CALL"
  message: string; // ★
  surfaceId?: string;
  path?: string;
  functionCallId?: string;
}
```

### 核查项

| #   | 核查项                                                                                                                                   | ✓   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 7.1 | 客户端发出的 `action` 是否通过 DataPart（`mimeType: "application/a2ui+json"`）包装后发送？                                               |     |
| 7.2 | `wantResponse: true` 时，client 是否**设置了 `actionId`**？（规范要求 `actionId` 在 `wantResponse: true` 时必填）                        |     |
| 7.3 | Server 端的 `actionResponse` 是否符合 `value` 和 `error` 互斥的规则？                                                                    |     |
| 7.4 | 客户端 `functionResponse` 消息中 `value` 字段是否为必填？                                                                                |     |
| 7.5 | `rendererOnly` 函数被 agent 端调用时，是否返回 `error { code: "INVALID_FUNCTION_CALL" }`？                                               |     |
| 7.6 | 函数调用查找流程是否正确：①查询 catalog 中的 `callableFrom` → ②未注册或 `rendererOnly` 则拒绝？                                          |     |
| 7.7 | `sendDataModel: true` 时，每次 action 是否在 transport metadata 中包含当前 surface 的 data model？                                       |     |
| 7.8 | `a2uiClientDataModel` 是否只定向投递给创建该 surface 的 server（防止数据泄漏）？                                                         |     |
| 7.9 | 渲染端校验失败时，error `code` 是否使用规范枚举（`VALIDATION_FAILED` / `UNALLOWED_PARENT` / `UNALLOWED_CHILD`，后两者上游 #2155 新增）？ |     |

### 常见误用

- ❌ action 消息忘记 `wantResponse: true` 但 Agent 期望结果 → 永久等待
- ❌ `callFunction` 的 `callableFrom` 检查放在 `function-registry.ts` 深处，错误无法正确回传
- ❌ client-side action 也走 A2A 通道 → 不必要的延迟
- ❌ `sendDataModel` 的所有 surface 的 data model 发给所有 Agent → 数据泄漏。应定向投递

---

## 八、callFunction（Server → Client）

### 类型结构

```typescript
interface CallFunctionMessage {
  functionCallId: string; // ★ 唯一 ID
  wantResponse?: boolean; // default false
  callFunction: {
    call: string; // ★ 函数名
    args?: Record<string, unknown>;
  };
}
```

### 核查项

| #   | 核查项                                                              | ✓   |
| --- | ------------------------------------------------------------------- | --- |
| 8.1 | `functionCallId` 是否唯一（可用 `crypto.randomUUID()`）？           |     |
| 8.2 | Server 端是否在调用前检查了函数存在于客户端？                       |     |
| 8.3 | `agentOnly` 函数是否可以被 agent 端正常调用？                       |     |
| 8.4 | `rendererOnly` 函数被 agent 端调用时，是否拦截并返回 error？        |     |
| 8.5 | `wantResponse: true` 时，server 端是否正确等待 `functionResponse`？ |     |

### 常见误用

- ❌ agent 端试图调用 `rendererOnly` 的本地函数 → 安全风险
- ❌ `functionCallId` 重复 → 无法正确匹配响应
- ❌ server 端未等待 `functionResponse` 就结束 → 函数执行结果丢失

---

## 九、Client Capabilities + Data Model Sync

### 核查项

| #   | 核查项                                                                                       | ✓   |
| --- | -------------------------------------------------------------------------------------------- | --- |
| 9.1 | 客户端是否在**每一条** A2A Message 的 `metadata` 中发送 `a2uiClientCapabilities`？           |     |
| 9.2 | `a2uiClientCapabilities.v1_0.supportedCatalogIds` 是否包含所有已注册 Catalog？               |     |
| 9.3 | `a2uiClientCapabilities.v1_0.inlineCatalogs`（如果使用）的格式是否符合 `CatalogDefinition`？ |     |
| 9.4 | 当 `createSurface.sendDataModel: true` 时，`a2uiClientDataModel` 是否在每次 action 时同步？  |     |
| 9.5 | `a2uiClientDataModel.version` 是否设为 `"v1.0"`？                                            |     |
| 9.6 | `a2uiClientDataModel.surfaces` 是否为 `Record<surfaceId, data>`？                            |     |
| 9.7 | 是否只同步 `sendDataModel: true` 的 surface 的数据？                                         |     |
| 9.8 | Server 端是否检查了客户端的 `supportedCatalogIds` 再生成 A2UI JSON？                         |     |

### 常见误用

- ❌ 客户端未在消息 metadata 中携带 capabilities → Server 端不知道客户端支持什么
- ❌ `a2uiClientDataModel` 的 surfaces 包含了不应同步的 surface → 数据泄漏
- ❌ Server 端忽略客户端 capabilities 直接生成 A2UI → 客户端渲染失败

---

## 十、Schema 实现注意事项

> 以下为 Schema 实现时的常见检查点。具体技术选型（Zod 版本、JSON Schema 库等）由各 SDK 决定，不属于协议合规范围。

| #    | 核查项                                                                                                                             | ✓   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | --- |
| 10.1 | 函数 Schema 是否设置了 `returnType`，且枚举值严格为 `string`、`number`、`boolean`、`array`、`object`、`any`、`void` 之一？         |     |
| 10.2 | 函数 Schema 是否设置了 `callableFrom`，且枚举值严格为 `rendererOnly`、`agentOnly`、`rendererOrAgent` 之一（默认 `rendererOnly`）？ |     |
| 10.3 | 每个组件的 Schema 是否设置了 `unevaluatedProperties: false`（拒绝未定义的额外属性）？                                              |     |
| 10.4 | 组件 Schema 中是否包含 `weight` 属性（`type: number`，用于 Row/Column 中的 flex-grow）？                                           |     |

---

---

> **注意**：以下 §11 原为"渲染器测试"章节，内容涉及具体实现和测试策略。协议合规检查仅关注行为正确性，实现细节由各 SDK 自行验证。下面是协议层面对渲染行为的要求检查项。

## 十一、渲染行为校验

### 核查项

| #    | 核查项                                                                                                               | ✓   |
| ---- | -------------------------------------------------------------------------------------------------------------------- | --- |
| 11.1 | 孤儿组件引用（child 引用的 ID 不在当前组件列表中）是否显示 placeholder 而非崩溃？                                    |     |
| 11.2 | 缺失的子组件在后续 `updateComponents` 消息中到达后，是否自动替换 placeholder？                                       |     |
| 11.3 | `updateDataModel` 后，是否只变更受影响 path 绑定的组件内容（非全量重渲染）？                                         |     |
| 11.4 | `object` 模式 ChildList 在数据长度变化时是否正确增删模板实例？                                                       |     |
| 11.5 | 数据绑定路径的数据尚未到达时，是否显示空值而非崩溃（渐进渲染）？                                                     |     |
| 11.6 | 在同一组消息中，`createSurface` 先于 `updateComponents` 到达时是否正确处理？                                         |     |
| 11.7 | `updateComponents` 先于 `createSurface` 到达时是否缓存到 pending 队列？                                              |     |
| 11.8 | 消息列表中单条消息校验失败时，是否继续处理后续消息（规范要求）？                                                     |     |
| 11.9 | `callFunction` 的 `callableFrom` 组合是否正确执行（`rendererOnly` 拒绝、`agentOnly` 允许、`rendererOrAgent` 允许）？ |     |

---

## 十二、formatString 语法（v1.0 `${...}` 插值）

v1.0 将插值语法统一为 `${...}` 模式，替代 v0.9 的 `{/path}` 和 `{call:...}` 混合语法。

```typescript
// v1.0 标准语法
"加速度: ${/sensor/value} m/s², 时间: ${formatDate(value:${/sensor/time}, format:'yyyy-MM-dd')}";

// 支持的语法:
// ${/path}                    — JSON Pointer 绝对路径
// ${relativeName}             — JSON Pointer 相对路径（Collection Scope）
// ${fnName(args)}             — FunctionCall
// ${fnName(arg:${/path})}     — 嵌套：call args 内嵌 path
// ${fn1(${fn2(args)})}        — 嵌套函数调用
// \${                          — 转义字面量 ${（显示为 ${）
```

| #    | 核查项                                                                                | ✓   |
| ---- | ------------------------------------------------------------------------------------- | --- |
| 12.1 | formatString 是否正确解析 `${/path}` 中的 JSON Pointer（绝对路径）？                  |     |
| 12.2 | formatString 是否正确解析 `${relativeName}` 中的相对路径（Collection Scope）？        |     |
| 12.3 | formatString 是否正确解析 `${fnName(arg:value)}` 函数调用？                           |     |
| 12.4 | 嵌套函数调用 `${fn1(${fn2(args)})}` 是否支持？                                        |     |
| 12.5 | 转义 `\${` 是否显示为字面 `${`？                                                      |     |
| 12.6 | 未解析的占位符/变量是显示空字符串还是保留原文？                                       |     |
| 12.7 | 插值表达式解析为 `null`/`undefined` 时是否显示空字符串？                              |     |
| 12.8 | formatString 支持的数据类型转换：number→string、boolean→string、object→JSON.stringify |     |

---

## 十三、@index 系统函数

| #    | 核查项                                                                            | ✓   |
| ---- | --------------------------------------------------------------------------------- | --- |
| 13.1 | `@index` 是否只能在 collection scope 内使用？                                     |     |
| 13.2 | root scope 中使用 `@index` 是否报错？                                             |     |
| 13.3 | `@index` 的返回值是否为 0-based 整数？                                            |     |
| 13.4 | `@index(offset: N)` 是否支持命名参数偏移（如 `@index(offset: 1)` 返回 1-based）？ |     |

---

## 十四、邻接表模型（v1.0 关键设计）

| #    | 核查项                                                                               | ✓   |
| ---- | ------------------------------------------------------------------------------------ | --- |
| 14.1 | 所有组件是否使用**平铺的 ID 引用**（非嵌套 JSON 树）？                               |     |
| 14.2 | `updateComponents` 发送已存在的组件 ID 时是否为**覆盖更新**（更新属性）？            |     |
| 14.3 | 父组件 `children` 中移除某个 ID 时，该子组件是否停止渲染（但不从 registry 中删除）？ |     |
| 14.4 | 组件增删改是否只需修改相关 ID（无需重建整棵树）？                                    |     |
| 14.5 | LLM 生成的 A2UI JSON 是否使用描述性 ID（如 `"sensor-chart"`）而非 `"c1"`？           |     |

---

## 十五、Incremental Updates（增量更新）

| #    | 核查项                                                           | ✓   |
| ---- | ---------------------------------------------------------------- | --- |
| 15.1 | 新组件是否通过新增 ID 并加入父组件 children 实现？               |     |
| 15.2 | 更新组件属性是否通过重新发送同一 ID 的 `updateComponents` 实现？ |     |
| 15.3 | 删除组件是否通过从父组件 children 中移除 ID 实现？               |     |
| 15.4 | 增量更新过程中是否不需要 `createSurface` 重建 surface？          |     |

---

## 十六、Checks 校验流

```typescript
// v1.0 CheckRule: condition 包裹校验逻辑
interface CheckRule {
  condition: DynamicBoolean; // FunctionCall / DataBinding / boolean 字面量
  message: string; // 校验失败时显示的错误信息
}
```

| #    | 核查项                                                                                                                | ✓   |
| ---- | --------------------------------------------------------------------------------------------------------------------- | --- |
| 16.1 | `CheckRule` 是否使用 `condition` 包裹校验逻辑（`{ condition: { call: "required", args: {...} }, message: "..." }`）？ |     |
| 16.2 | `condition` 的类型是否为 `DynamicBoolean`（支持 FunctionCall / DataBinding / boolean 字面量三种形态）？               |     |
| 16.3 | 多个 checks 是否按数组顺序执行（第一个 `condition` 为 false 就停止后续）？                                            |     |
| 16.4 | Button 的 `disabled` 是否从下游组件的 checks 结果汇总（任一 fail → disabled）？                                       |     |
| 16.5 | checks 中的函数（如 `required`、`email`、`regex`、`and`、`or`、`not`）是否在 `FunctionRegistry` 中正确注册？          |     |
| 16.6 | checks 中是否支持嵌套逻辑（`and`/`or`/`not` 组合多个 condition）？                                                    |     |
| 16.7 | Button checks 失败时，样式是否灰化且点击事件不触发？                                                                  |     |

---

## 十七、A2A 扩展激活流程

| #    | 核查项                                                                                                   | ✓   |
| ---- | -------------------------------------------------------------------------------------------------------- | --- |
| 17.1 | 客户端是否通过 `X-A2A-Extensions: https://a2ui.org/a2a-extension/a2ui/v1.0` HTTP header 激活 A2UI 扩展？ |     |
| 17.2 | 服务端响应是否回显已激活的扩展？                                                                         |     |
| 17.3 | 扩展未激活时，a2ui-agent 是否仍然发送 text/plain 消息（回退）？                                          |     |

---

## 十八、渐进渲染（Progressive Rendering）

| #    | 核查项                                                                       | ✓   |
| ---- | ---------------------------------------------------------------------------- | --- |
| 18.1 | 未到达的子组件是否显示 placeholder（而非报错）？                             |     |
| 18.2 | 数据绑定路径的数据尚未到达时，是否显示空值而非崩溃？                         |     |
| 18.3 | 所有消息处理完毕后，渲染器是否一次性 flush UI 变更（避免闪烁）？             |     |
| 18.4 | 消息列表中单条消息失败时，是否继续处理后续消息（规范要求）？                 |     |
| 18.5 | 在同一组消息中，`createSurface` 先于 `updateComponents` 到达时是否正确处理？ |     |
| 18.6 | `updateComponents` 先于 `createSurface` 到达时是否缓存到 pending 队列？      |     |

---

## 十九、Transport 绑定（v1.0 新增）

### 19.1 AG-UI Transport（标准绑定）

| #    | 核查项                                                                  | ✓   |
| ---- | ----------------------------------------------------------------------- | --- |
| 19.1 | 是否理解 AG-UI（https://docs.ag-ui.com）是 A2UI 的标准 Transport 绑定？ |     |
| 19.2 | AG-UI 是否提供低延迟、共享状态的消息传递通道？                          |     |

### 19.2 MCP Transport

| #    | 核查项                                                                          | ✓   |
| ---- | ------------------------------------------------------------------------------- | --- |
| 19.3 | A2UI 是否可以通过 MCP tool calls / tool outputs / resource subscriptions 承载？ |     |
| 19.4 | MCP 初始化时是否通过 server capabilities 声明 A2UI 支持？                       |     |

### 19.3 SSE + JSON-RPC / WebSocket / REST

| #    | 核查项                                                                      | ✓   |
| ---- | --------------------------------------------------------------------------- | --- |
| 19.5 | SSE Transport 是否使用 JSONL 格式（每条消息一行，`\n` 分隔）？              |     |
| 19.6 | JSON-RPC 是否用于 client→server 的 action/functionResponse/error 消息通道？ |     |
| 19.7 | WebSocket Transport 是否支持双向实时会话？                                  |     |
| 19.8 | REST Transport（简单场景）是否缺少流式能力（注意局限性）？                  |     |

### 19.4 Transport 通用合约

| #     | 核查项                                                                  | ✓   |
| ----- | ----------------------------------------------------------------------- | --- |
| 19.9  | Transport 是否保证有序投递（消息顺序不可乱）？                          |     |
| 19.10 | Transport 是否提供清晰的消息分帧（JSONL/SSE/WebSocket frame）？         |     |
| 19.11 | Transport 是否支持元数据传递（用于 sendDataModel、capabilities 交换）？ |     |
| 19.12 | Transport 是否支持双向通信（action 返回通道）？                         |     |

---

## 二十、Spacer 弹性空白组件（非 v1.0 标准组件）

> **注意**: Spacer 不是 A2UI v1.0 Basic Catalog 的标准组件。如需要弹性空白效果，可考虑使用 `weight` 属性或自定义组件实现。
>
> 以下核查项仅在使用自定义 Spacer 实现时参考：

```typescript
interface SpacerProps {
  // 无自定义属性，仅继承 ComponentCommon
  // 作用：填充父容器剩余空间（弹性空白）
}
```

| #    | 核查项                                                      | ✓   |
| ---- | ----------------------------------------------------------- | --- |
| 20.1 | Spacer 是否渲染为弹性空白元素（填充 Row/Column 剩余空间）？ |     |
| 20.2 | Spacer 是否已注册到自定义 Catalog？                         |     |
| 20.3 | Spacer 在渲染器中是否已实现？                               |     |
| 20.4 | 多个 Spacer 在同级时是否按比例分配剩余空间？                |     |

### 常见误用

- ❌ 用空的 `Column` 或 `Row` 作为间距 → ✅ 使用 `Spacer`
- ❌ 在非 flex 容器中使用 Spacer → 无效果

---

## 二十一、Leaf-Margin 布局策略（实现指南）

来自 A2UI v1.0 Basic Catalog Implementation Guide §3，防止间距乘数效应。

| #    | 核查项                                                                                 | ✓   |
| ---- | -------------------------------------------------------------------------------------- | --- |
| 21.1 | 不可见容器（Row/Column/List）是否**零内边距、零外边距**（纯结构容器）？                |     |
| 21.2 | 可视叶子组件（Text/Image/Icon/Video/AudioPlayer/Slider）是否应用**统一外边距**？       |     |
| 21.3 | 有可见边界的容器（Card/Button/TextField/CheckBox/ChoicePicker）是否也应用外部 margin？ |     |
| 21.4 | 嵌套结构容器时是否不会累积间距（避免 spacing multiplication）？                        |     |
| 21.5 | 容器内部 padding 是否仅用于保持内容远离自身边界（不影响外部布局）？                    |     |

**核心原则**：

- 结构容器（Row/Column） → margin=0, padding=0
- Leaf 组件（Text/Image） → 统一外部 margin（如 8dp）
- 可见容器（Card/Button） → 内部 padding + 外部 margin

---

## 二十二、颜色对比度与嵌套（实现指南）

来自 A2UI v1.0 Basic Catalog Implementation Guide §4，依赖框架原生主题继承。

| #    | 核查项                                                                                        | ✓   |
| ---- | --------------------------------------------------------------------------------------------- | --- |
| 22.1 | 叶子组件（Text/Icon）是否**从不硬编码颜色**（始终从环境继承）？                               |     |
| 22.2 | Button primary variant 是否通过框架原生机制设置文本颜色（CSS `color`、CompositionLocal 等）？ |     |
| 22.3 | Card 嵌套 Card 时是否使用**透明背景 + 边框**（非交替底色）区分层级？                          |     |
| 22.4 | 是否**避免**手动传递颜色属性到 A2UI 组件树（完全依赖原生主题继承）？                          |     |

**核心原则**：不要手动计算或传递颜色属性。依赖框架的原生 context/theme 继承机制（Web CSS `color` 继承、Compose `CompositionLocal`、SwiftUI `.foregroundColor`、Flutter `DefaultTextStyle.merge`）。

---

## 二十三、openUrl 安全约束

| #    | 核查项                                                                                         | ✓   |
| ---- | ---------------------------------------------------------------------------------------------- | --- |
| 23.1 | `openUrl` 是否在打开前解析相对 URL 为绝对 URL（resolve against current environment context）？ |     |
| 23.2 | 是否严格验证 URL scheme 只能为 `https:` 或 `http:`（拒绝 `javascript:`、`data:` 等）？         |     |
| 23.3 | 新窗口打开时是否设置 `noopener,noreferrer`（防止 tab-nabbing 攻击）？                          |     |
| 23.4 | 无效 scheme 时是否抛 `A2uiExpressionError` 并终止操作？                                        |     |

---

## 二十四、Checks 校验 `condition` 包装模式（v1.0 规范更新）

v1.0 的 `CheckRule` 使用 `condition: DynamicBoolean` 包裹校验条件，而非直接使用 `{ call, args }`。

```typescript
// v1.0 标准 CheckRule
interface CheckRule {
  condition: DynamicBoolean; // ★ 可以是 FunctionCall 或 path 或 boolean 字面量
  message: string; // ★ 校验失败错误信息
}
```

| #    | 核查项                                                                            | ✓   |
| ---- | --------------------------------------------------------------------------------- | --- |
| 24.1 | CheckRule 是否使用 `condition` 包裹校验逻辑（而非平铺 `call` + `args`）？         |     |
| 24.2 | `condition` 是否支持 FunctionCall、DataBinding（path）和 boolean 字面量三种形态？ |     |
| 24.3 | Button 的 `disabled` 是否汇总 checks 中所有 `condition` 的结果？                  |     |
| 24.4 | TextField 的 checks 是否按顺序执行，第一个 `condition` 为 false 时停止后续？      |     |

**常见误用**：

- ❌ 仍使用 v0.9 格式 `{ call: "required", args: {...}, message: "..." }` → ✅ 必须包装在 `condition` 中
- ❌ `condition` 中使用了不存在的函数名 → FunctionRegistry 查不到时返回 false

---

## 二十五、Catalog 定义与合规性

### Catalog 顶层结构

```typescript
interface CatalogDefinition {
  $schema?: string; // "https://json-schema.org/draft/2020-12/schema"
  $id?: string; // Catalog JSON Schema 唯一 ID
  protocolVersion?: string; // ★ 规范版本（semver 格式如 "1.0"），缺省默认 "0.9"（上游 2b8f8661）
  title?: string;
  description?: string;
  catalogId: string; // ★ 必填，唯一标识符（URI 格式）
  instructions?: string; // Markdown，LLM 设计指南
  components: Record<string, ComponentSchema>; // ★ 必填
  functions: Record<string, FunctionSchema>; // 可选
  $defs?: {
    anyComponent?: object; // ★ 必填（如果 components 存在）
    anyFunction?: object; // ★ 必填（如果 functions 存在）
    // 注：surfaceProperties 已从 v1.0 规范移除（上游 #2126），$defs 仅允许以上 2 个 key
  };
}
```

| #    | 核查项                                                                                                                                                                 | ✓   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 25.1 | Catalog 顶层是否**仅**包含 `$schema`、`$id`、`protocolVersion`、`title`、`description`、`catalogId`、`instructions`、`components`、`functions`、`$defs` 这 10 个 key？ |     |
| 25.2 | `catalogId` 是否使用 URI 格式命名空间（如 `https://geo-system.com/a2ui/v1.0/geo-sensor-catalog`）？                                                                    |     |
| 25.3 | `instructions` 字段是否包含 LLM 设计指南（布局偏好、颜色主题、组件使用惯例）？                                                                                         |     |
| 25.4 | `catalogId` 是否与前端 `supportedCatalogIds` 中注册的 ID 完全一致（区分大小写）？                                                                                      |     |
| 25.5 | 是否避免了在 Catalog 顶层定义自定义 key（会被验证器拒绝）？                                                                                                            |     |

### Catalog 组件/函数命名（UAX #31）

| #     | 核查项                                                                                                       | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------ | --- |
| 25.6  | 组件名是否符合正则 `/^[\p{XID_Start}_][\p{XID_Continue}]*$/u`（如 `SensorCard` 合法，`1stComponent` 非法）？ |     |
| 25.7  | 组件名是否**不含**空格、连字符、特殊符号（如 `submit-form`、`user#name` 非法）？                             |     |
| 25.8  | 函数名是否符合相同的 UAX #31 规则？                                                                          |     |
| 25.9  | 函数名是否**不以** `@` 开头（`@` 前缀保留给系统函数如 `@index`）？                                           |     |
| 25.10 | 自定义 Catalog 是否**禁止**定义 `@` 前缀的函数？                                                             |     |

### `$defs` 与 Discriminator 规则

| #     | 核查项                                                                                                                     | ✓   |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | --- |
| 25.11 | `$defs` 中是否**仅**包含 `anyComponent`、`anyFunction` 两个 key？（surfaceProperties 已从 v1.0 移除，上游 #2126）          |     |
| 25.12 | 是否避免了在 `$defs` 中定义自定义 helper schema（如共享的 property group）？                                               |     |
| 25.13 | 公共属性是否**内联**在每个组件的 `allOf` 本地对象中？                                                                      |     |
| 25.14 | ⚠ 项目扩展：`surfaceProperties` 仅允许在**运行时消息**中使用（渲染器宽松处理），Catalog `$defs` 中不得声明（上游已移除）？ |     |
| 25.15 | 每个组件 schema 是否包含 `component: { const: "组件名" }` 判别器？                                                         |     |
| 25.16 | `anyComponent` 的 `discriminator.propertyName` 是否指向 `"component"`？                                                    |     |
| 25.17 | `anyComponent` 是否使用 `oneOf` 引用所有组件（`#/components/组件名`）？                                                    |     |
| 25.18 | 是否每个组件都遵循 `allOf` 结构（`ComponentCommon` + 本地属性对象）？                                                      |     |
| 25.19 | 每个组件 schema 是否设置了 `unevaluatedProperties: false`（防止额外属性）？                                                |     |

### 外部引用限制

| #     | 核查项                                                                                                                                                                                                                                                                                                             | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| 25.20 | 本地 `$ref` 是否**仅**指向当前 Catalog 的 components/functions（如 `#/components/Text`）？                                                                                                                                                                                                                         |     |
| 25.21 | 外部 `$ref` 是否**仅**指向 `common_types.json` 中允许的 18 种类型（AccessibilityAttributes/Action/CallId/CheckRule/Checkable/Child/ChildList/ComponentCommon/ComponentId/DataBinding/DynamicBoolean/DynamicNumber/DynamicString/DynamicStringList/DynamicValue/FunctionCall/FunctionCommon/IndexSystemFunction）？ |     |
| 25.22 | 组件 ID 属性是否使用 `$ref: "common_types.json#/$defs/ComponentId"`（而非 `"type": "string"`）？                                                                                                                                                                                                                   |     |
| 25.23 | Children 属性是否使用 `$ref: "common_types.json#/$defs/ChildList"`（而非自定义数组类型）？                                                                                                                                                                                                                         |     |
| 25.24 | Dynamic\* 属性是否使用正确的 common_types 引用？                                                                                                                                                                                                                                                                   |     |

### 函数 Schema 规范

| #     | 核查项                                                                                                      | ✓   |
| ----- | ----------------------------------------------------------------------------------------------------------- | --- |
| 25.25 | 每个函数 schema 是否包含 `call: { const: "函数名" }` 属性？                                                 |     |
| 25.26 | 是否包含 `returnType` 元数据字段（`string \| number \| boolean \| array \| object \| any \| void`）？       |     |
| 25.27 | 是否包含 `callableFrom` 元数据字段（`rendererOnly \| agentOnly \| rendererOrAgent`，默认 `rendererOnly`）？ |     |
| 25.28 | 函数的 `args` 是否定义了 `required` 数组和 `additionalProperties: false`？                                  |     |
| 25.29 | 无参函数（如 `now()`）的 `args` 是否不定义或定义为 `{}`？                                                   |     |

### protocolVersion 声明（上游 2b8f8661 新增）

| #     | 核查项                                                                                            | ✓   |
| ----- | ------------------------------------------------------------------------------------------------- | --- |
| 25.30 | Catalog 顶层是否声明了 `protocolVersion`（如 `"1.0"`）？v1.0 catalog 必须声明，缺省视为 `"0.9"`？ |     |
| 25.31 | `protocolVersion` 值是否符合 semver 正则（`^(0\|[1-9]\d*)\.(...)`，不携带 `v` 前缀）？            |     |
| 25.32 | 前端 `supportedCatalogIds` 声明 catalog 时，是否与服务端加载的 catalog `protocolVersion` 一致？   |     |

### Mixable Catalog / 组件级 catalogId 解析（上游 706ed4d0 新增）

| #     | 核查项                                                                                          | ✓   |
| ----- | ----------------------------------------------------------------------------------------------- | --- |
| 25.33 | `createSurface.catalogId` 是否为**可选**（surface 级默认 catalog，`required` 仅 `surfaceId`）？ |     |
| 25.34 | 组件未声明 `catalogId` 时，是否回退到 surface 级默认 catalog 解析？                             |     |
| 25.35 | 组件级 `catalogId` 覆盖时，渲染器是否按组件自己的 catalog 查找组件定义（mixable catalogs）？    |     |
| 25.36 | 函数调用（FunctionCall）是否同样支持组件级 `catalogId` 解析？                                   |     |
| 25.37 | 单 surface 内混用多个 catalog 时，`catalogId` 是否全部在前端 `supportedCatalogIds` 中注册？     |     |

### 组合约束 allowedParents/allowedChildren + Surface 容器（上游 d849f485 新增）

> ⚠ 本项目实现状态：SDK/渲染器**尚未实现**组合约束校验与 `Surface` 容器（待办，规范副本已同步）。

| #     | 核查项                                                                                                                                                        | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 25.38 | Catalog 中是否**未定义**名为 `Surface` 的标准组件？（协议保留名，上游 #2155）                                                                                 |     |
| 25.39 | `createSurface` 是否被渲染器视为隐式实例化规范 `Surface` 容器（`common_types.json#/$defs/Surface`，始终 `"child": "root"`，不可被 `updateComponents` 修改）？ |     |
| 25.40 | 组件类型上的 `allowedParents` / `allowedChildren` 是否为**可选**（缺省允许所有父/子组件类型）？                                                               |     |
| 25.41 | 仅允许作为 surface 根的组件（如 `AppLayout`）是否声明 `allowedParents: ["Surface"]`？                                                                         |     |
| 25.42 | 嵌套校验是否覆盖整棵组件树（`Surface` 作为顶层容器父节点，`id: "root"` 组件挂载为其 child）？                                                                 |     |
| 25.43 | 违反组合约束时，error `code` 是否分别为 `UNALLOWED_PARENT`（子放在不允许的父下）/ `UNALLOWED_CHILD`（容器放入不允许的子）？                                   |     |

### Accessibility live/hidden（上游 #2209 新增，2026-08 同步）

| #     | 核查项                                                                                                          | ✓   |
| ----- | --------------------------------------------------------------------------------------------------------------- | --- |
| 25.44 | `ComponentCommon.accessibility.live` 是否支持 `"off" \| "polite" \| "assertive"` 三态枚举？                     | ✅  |
| 25.45 | `accessibility.hidden` 是否为 `DynamicBoolean`（支持布尔字面量 / DataBinding / FunctionCall）？                 | ✅  |
| 25.46 | 渲染器是否将 `live` 映射为 WAI-ARIA `aria-live`（组件模板绑定 `[attr.aria-live]`）？                            | ✅  |
| 25.47 | 渲染器是否将 `hidden` 映射为 WAI-ARIA `aria-hidden`（组件模板绑定 `[attr.aria-hidden]`，true/false 动态解析）？ | ✅  |
| 25.48 | `live`/`hidden` 缺省时是否不产生 ARIA 属性（live 默认 `off`、hidden 默认 false 由浏览器语义兜底）？             | ✅  |

### 规范副本与一致性测试（2026-08 同步上游 7dd839a3..dd7b7f3d）

| #     | 核查项                                                                                                       | ✓         |
| ----- | ------------------------------------------------------------------------------------------------------------ | --------- |
| 25.49 | `packages/a2ui/sdk/resources/specification/v1_0/` 是否与官方 `specification/v1_0/` 一致（`diff -rq` 为空）？ | ✅        |
| 25.50 | conformance-test 是否直接消费官方 `test/cases/`（与 run_tests.py 同源，不再维护私有 schema 快照）？          | ✅        |
| 25.51 | conformance-test 是否使用 Ajv2020（draft 2020-12，`unevaluatedProperties` 等关键字生效）？                   | ✅        |
| 25.52 | 官方用例中 SDK Zod 与规范 Schema 是否存在未消除差异（`差异报告` 用例）？                                     | ✅ 无差异 |

---

## 二十六、Scope 作用域解析补充

| #    | 核查项                                                                                              | ✓   |
| ---- | --------------------------------------------------------------------------------------------------- | --- |
| 26.1 | JSON Pointer 路径中特殊字符（`/`, `~`, `%`）是否按 RFC 6901 转义（`~0` 为 `~`，`~1` 为 `/`）？      |     |
| 26.2 | 嵌套模板（多层 ChildList）时，相对路径是否逐层拼接当前 scope（如内层 `/items/N/subitems/M/name`）？ |     |
| 26.3 | 模板实例的 scope 是否隔离（`/items/0` 下组件只看到 `/items/0/name`，不看到 `/items/1/name`）？      |     |
| 26.4 | 模板实例内部是否可通过绝对路径 `/company` 访问 Root Scope 数据（跨 scope 混合访问）？               |     |

---

## 二十七、Data Model 同步与收敛扩展

### Server → Client 更新

| #    | 核查项                                                                              | ✓   |
| ---- | ----------------------------------------------------------------------------------- | --- |
| 27.1 | `value` 为 `null` 时，是否删除该路径的 key（v1.0 语义）？                           |     |
| 27.2 | 超大 DataModel（>1MB）的 `updateDataModel` 是否分多次发送？                         |     |
| 27.3 | 部分更新（如 path=`/user/name`，value=`"Alice"`）是否只修改该路径，不影响其他路径？ |     |

### Client → Server 收敛

| #    | 核查项                                                                                          | ✓   |
| ---- | ----------------------------------------------------------------------------------------------- | --- |
| 27.4 | Server 端是否将收到的 DataModel 视为 action 触发时的**最新**状态（收敛语义）？                  |     |
| 27.5 | 多个 action 并发时，是否保证 DataModel 快照一致性（不出现 Time-of-check to time-of-use 问题）？ |     |
| 27.6 | 被动数据变更（如 TextField 打字）是否不触发网络请求（只在 action 触发时附带发送）？             |     |

---

## 二十八、类型转换与数据绑定规则

| #    | 核查项                                                                         | ✓   |
| ---- | ------------------------------------------------------------------------------ | --- |
| 28.1 | `number` → `string` 是否使用标准 toString（如 `42` → `"42"`）？                |     |
| 28.2 | `boolean` → `string` 是否使用标准 toString（如 `true` → `"true"`）？           |     |
| 28.3 | `null` / `undefined` → 是否转为空字符串 `""`（不显示 "null" 或 "undefined"）？ |     |
| 28.4 | `object` / `array` → 字符串化时是否使用 `JSON.stringify`（确保跨客户端一致）？ |     |
| 28.5 | 大型对象/数组字符串化时是否截断（避免 UI 崩溃）？                              |     |
| 28.6 | 组件销毁时是否清理双向绑定（避免内存泄漏）？                                   |     |
| 28.7 | `DynamicBinding.write()` 是否为**同步**操作（不得异步化）？                    |     |

---

## 二十九、Standard Functions 签名注册表

| #     | 核查项                                                                             | ✓   |
| ----- | ---------------------------------------------------------------------------------- | --- |
| 29.1  | `required` — 是否检查 null / undefined / 空字符串 / 空数组？                       |     |
| 29.2  | `regex` — 是否接收 `value` + `pattern` 两个参数？                                  |     |
| 29.3  | `email` — 是否使用标准 email 正则（不拒绝 `user+tag@domain.com`）？                |     |
| 29.4  | `length` — 是否接收 `value` + `min?` + `max?` 参数？                               |     |
| 29.5  | `numeric` — 是否接收 `value` + `min?` + `max?` 参数？                              |     |
| 29.6  | `and` / `or` / `not` — 是否支持布尔逻辑组合？                                      |     |
| 29.7  | `formatString` — 是否支持 `${...}` 插值语法和 `${fnName(args)}` 函数嵌套？         |     |
| 29.8  | `formatString` — `${` 转义为 `\${` 是否显示字面量？                                |     |
| 29.9  | `pluralize` — 是否根据 count 选择正确的本地化字符串？                              |     |
| 29.10 | `openUrl` — 是否执行 scheme 校验（仅 `https:` / `http:`）+ `noopener,noreferrer`？ |     |
| 29.11 | 所有 Functions 是否在 FunctionRegistry（client-side）中正确注册？                  |     |

---

## 三十、安全与身份认证

| #    | 核查项                                                                                                                 | ✓   |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | --- |
| 30.1 | ⚠ 项目扩展：`surfaceProperties.agentDisplayName` 是否用于标识该 surface 的创建 Agent？（上游 v1.0 已移除，本项目保留） |     |
| 30.2 | ⚠ 项目扩展：多 Agent 系统中，orchestrator 是否覆盖或验证 sub-agent 的 `surfaceProperties`（防身份冒充）？              |     |
| 30.3 | DataPart 的 MIME type 是否严格校验为 `application/a2ui+json`？                                                         |     |
| 30.4 | DataPart 的 `data` 是否为 JSON 数组（非单个对象或任意 JSON）？                                                         |     |
| 30.5 | 是否拒绝 `version` 不匹配的消息（如 `v0.9` 格式）？                                                                    |     |
| 30.6 | `a2uiClientDataModel` 是否只包含 `sendDataModel: true` 的 surface？                                                    |     |
| 30.7 | Agent A 创建的 surface 的 DataModel 是否不会被发送给 Agent B？                                                         |     |
| 30.8 | 前端是否实现了 surfaceId → Agent 连接映射（`Map<surfaceId, A2AConnection>`）防止错发？                                 |     |

---

## 三十一、Prompt-Generate-Validate 循环

| #    | 核查项                                                                                     | ✓   |
| ---- | ------------------------------------------------------------------------------------------ | --- |
| 31.1 | LLM prompt 中是否包含了 Catalog definition 和示例 A2UI JSON？                              |     |
| 31.2 | LLM 输出是否使用 Zod Schema 做第一轮校验？                                                 |     |
| 31.3 | 校验失败时，是否以 `VALIDATION_FAILED` 格式返回错误（含 `surfaceId`、`path`、`message`）？ |     |
| 31.4 | 校验失败后是否允许 LLM 最多重试 N 次（如 3 次）？                                          |     |
| 31.5 | 重试时是否提供简化的 schema 而非完整 catalog（减少 token 消耗）？                          |     |
| 31.6 | 3 次重试全部失败后是否降级为 text/plain 回复（不阻塞对话）？                               |     |
| 31.7 | 生成的 A2UI JSON 是否使用描述性组件 ID（如 `station-chart`）而非无意义 ID（如 `c1`）？     |     |

---

---

> **注意**：以下 §32-§33 原为"渲染器 Angular 实现专项"和"多 Agent 场景"章节。这些涉及具体框架实现和架构设计，不属于 A2UI v1.0 协议规范范围。具体实现的合规检查应参考各自的实现指南。

## 三十二、Transport 绑定合规

| #    | 核查项                                                                  | ✓   |
| ---- | ----------------------------------------------------------------------- | --- |
| 32.1 | Transport 是否保证有序投递（消息顺序不可乱）？                          |     |
| 32.2 | Transport 是否提供清晰的消息分帧（JSONL/SSE/WebSocket frame）？         |     |
| 32.3 | Transport 是否支持元数据传递（用于 sendDataModel、capabilities 交换）？ |     |
| 32.4 | Transport 是否支持双向通信（action 返回通道）？                         |     |
| 32.5 | A2UI DataPart 的 MIME type 是否严格为 `application/a2ui+json`？         |     |
| 32.6 | DataPart 的 `data` 字段是否为消息数组（非单个对象）？                   |     |

---

## 三十三、安全合规

| #    | 核查项                                                                                                                       | ✓   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --- |
| 33.1 | `openUrl` 是否验证 URL scheme 仅允许 `https:` 和 `http:`（拒绝 `javascript:`、`data:` 等）？                                 |     |
| 33.2 | 新窗口打开时是否设置 `noopener,noreferrer`（防止 tab-nabbing 攻击）？                                                        |     |
| 33.3 | 相对 URL 是否先解析为绝对 URL 再验证 scheme？                                                                                |     |
| 33.4 | `rendererOnly` 函数被 agent 端调用时，是否返回 `error { code: "INVALID_FUNCTION_CALL" }`？                                   |     |
| 33.5 | ⚠ 项目扩展：多 Agent 系统中，surface 的 `surfaceProperties` 身份信息是否被 orchestrator 验证（防冒充）？（上游 v1.0 已移除） |     |
| 33.6 | Agent A 创建的 surface 的 DataModel 是否不会被发送给 Agent B（定向投递）？                                                   |     |

---

## 三十四、演化兼容性清单（v0.9.1 → v1.0）

| #    | 核查项                                                                                                                           | ✓   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --- |
| 34.1 | 是否确认了旧版 `v0.9` 的 `theme` 属性已移除？视觉样式完全交由目标框架原生主题（上游 a06b22ba 已连 surfaceProperties 一并移除）？ |     |
| 34.2 | 是否确认了 `actionResponse` 和 `callFunction` 的支持已就绪？                                                                     |     |
| 34.3 | 是否确认了 `createSurface` 的内联 `components` + `dataModel` 已实现？                                                            |     |
| 34.4 | 是否确认了 Catalog 的 `$defs` 限制规则已满足？                                                                                   |     |
| 34.5 | 是否确认了 `version` 字段统一为 `"v1.0"`（而非 `"1.0"` 或 `"v1"`）？                                                             |     |
| 34.6 | 是否确认了 `functions` 从数组改为对象 Map（keyed by function name）？                                                            |     |
| 34.7 | 是否确认了 MIME 类型从 `application/json+a2ui` 改为 `application/a2ui+json`？                                                    |     |
| 34.8 | 是否确认了 Icon 的自定义 SVG 属性名仍为 `svgPath`（未重命名）？                                                                  |     |
| 34.9 | 是否确认了 `updateDataModel` 删除语义：`null` 表示删除 key？                                                                     |     |

---

## 参考

- A2UI v1.0 规范全文: https://a2ui.org/specification/v1.0-a2ui/
- 演化指南 v0.9.1 → v1.0: https://a2ui.org/specification/v1.0-evolution-guide/
- A2A 扩展: https://a2ui.org/specification/v1.0-a2ui-extension-specification/
- 数据绑定: https://a2ui.org/concepts/data-binding/
- 组件 Catalog 规范: https://a2ui.org/specification/v1.0-catalogs-basic-catalog.json/
- Common Types Schema: https://a2ui.org/specification/v1_0/common_types.json
- Agent → Renderer Schema: https://a2ui.org/specification/v1_0/agent_to_renderer.json
- Renderer → Agent Schema: https://a2ui.org/specification/v1_0/renderer_to_agent.json
- Catalog 定义 Schema: https://a2ui.org/specification/v1_0/catalog_definition.json
- Catalog 实现指南: https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/
- AG-UI Transport: https://docs.ag-ui.com
- SDK 架构: https://a2ui.org/specification/v1.0-sdks-spec/
