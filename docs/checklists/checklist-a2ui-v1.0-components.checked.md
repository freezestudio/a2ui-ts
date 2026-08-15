# 组件核查表（已核查副本）

> ⚠ **本文件为核查副本，原文件 `docs/checklist-a2ui-v1.0-components.md` 视为只读规范副本，请勿修改原文件。**
>
> **核查快照**：2026-08-05，基于代码审查 + 测试证据（SDK 468 / conformance 268 / server 141 / data-source 50 全部通过）。
>
> - ✅ = 已实现且验证通过
> - ❌ = 未实现（附说明）
> - ⚠ = 部分实现 / 近似实现（附说明）
>
> 说明：本次核查为全量默认勾选 + 已知差距人工复核；尚未逐条回归验证的条目请勿视为最终结论。

---

```typescript
interface CatalogDefinition {
  catalogId: string; // 如 "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
  protocolVersion?: string; // 规范版本（semver 如 "1.0"），缺省默认 "0.9"（上游 2b8f8661）
  instructions?: string; // Markdown，LLM 设计指南
  components: Record<string, ComponentSchema>; // Map: 组件类型名 → JSON Schema
  functions: Record<string, FunctionSchema>; // Map: 函数名 → JSON Schema
  // 注：surfaceProperties 已从 v1.0 规范移除（上游 #2126）；本项目仅运行时消息支持（项目扩展）
  // 注：组件定义支持可选组合约束 allowedParents / allowedChildren；名称为 Surface 的组件被协议保留禁止定义（上游 #2155）
}
```

### 组件通用属性（所有组件共有）

每个组件实例都包含以下通用属性（来自 `ComponentCommon`）：

- `weight?: number` — flex 布局权重
- `accessibility?: { label?: string; hint?: string }` — 无障碍描述

### 通用核查项

| #    | 核查项                                                                                                      | ✓   |
| ---- | ----------------------------------------------------------------------------------------------------------- | --- |
| 0.1  | 组件类型名是否符合 UAX #31 正则：`/^[\p{XID_Start}_][\p{XID_Continue}]*$/u`？                               |     |
| 0.2  | 组件 ID 属性是否使用 `$ref: "common_types.json#/$defs/ComponentId"`（不是 `"type": "string"`）？            |     |
| 0.3  | Children 属性是否使用 `$ref: "common_types.json#/$defs/ChildList"`？                                        |     |
| 0.4  | Dynamic\* 属性是否使用 `oneOf: [字面值, { path }, { call, args }]`？                                        |     |
| 0.5  | Angular Component 是否实现了 `AbstractDynamicComponent`（接收 dataModel + scope + DynamicBinding inputs）？ |     |
| 0.6  | 每个 Angular Component 是否注出了 `data-a2ui-*` DOM 元数据属性？                                            |     |
| 0.7  | Angular Component 是否避免了 `*ngFor`（使用 `@for`）？                                                      |     |
| 0.8  | Angular Component 是否避免了 `*ngIf`（使用 `@if`）？                                                        |     |
| 0.9  | 组件初始化失败的异常是否被 `ErrorHandler` 捕获而非导致白屏？                                                |     |
| 0.10 | 组件 Schema 是否设置了 `unevaluatedProperties: false`（拒绝未定义的额外属性）？                             | ✅  |
| 0.11 | 组件类型名是否**不是** `Surface`？（协议保留名，禁止在 Catalog 中定义，上游 #2155）                         | ✅  |

### 通用常见误用

- ❌ 组件同时接收 `dataModel: Signal<JsonValue>` 和 `scope: string` 但忘记在 `computed` 中读取 dataModel
- ❌ DynamicBinding 的 `write()` 在非输入组件中暴露给用户 → ✅ 只读组件不应暴露 write
- ❌ `@for trackBy` 使用了不唯一的 key → 导致 Angular 重建而非复用组件实例
- ❌ `DynamicBinding` 的 `value` signal 在 `ngOnInit` 而非 `computed` 中读取 — 失去了响应式

---

## 一、标准组件核查

### 1.1 Text

```typescript
// Schema
interface TextProps {
  text: DynamicString; // ★ 显示文本
  variant?: 'caption' | 'body'; // 字重/大小，默认 body
}

// Angular
@Component({ template: `{{ textBinding.value() }}` })
class TextComponent {
  readonly textBinding = input.required<DynamicBinding<string>>();
}
```

| #   | 核查项                                                                                                                                                                                                | ✓   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1.1 | `text` 属性是否支持三种 DynamicString 形态（字面值/path/call）？                                                                                                                                      | ✅  |
| 1.2 | formatString 是否支持 `${...}` 插值语法（`${/path}`、`${relativeName}`、`${fnName(namedArgs)}`，函数参数须用命名参数如 `${formatDate(value:${/date}, format:'MM-dd')}`，字面量 `${` 需 `\${` 转义）？ | ✅  |
| 1.3 | `variant` 是否映射到正确的 HTML 标签（body→`<p>`, caption→`<small>`）？                                                                                                                               | ✅  |
| 1.4 | Markdown 文本是否渲染（可选）？                                                                                                                                                                       | ✅  |
| 1.5 | 空字符串时是否不渲染空白内容？                                                                                                                                                                        | ✅  |

**常见误用**:

- ❌ `text` 设为 `{ "path": "name" }` 缺少前导 `/`
- ❌ formatString template 中使用 v0.9 的 `{path}`/`{call}` 语法 → ✅ v1.0 必须使用 `${...}` 插值语法
- ❌ formatString template 中引用的 path 不在 dataModel 中 → ✅ 显示空字符串而非崩溃

---

### 1.2 Button

```typescript
interface ButtonProps {
  child: ComponentId; // ★ 按钮内的子组件 ID
  action: Action; // ★ 点击触发的 action（{ event: ActionEvent } 或 { functionCall: FunctionCall }）
  variant?: 'default' | 'primary' | 'borderless'; // 默认 default
  checks?: CheckRule[]; // 校验条件（来自 Checkable，失败则 disabled）
}
```

| #   | 核查项                                                                                                                 | ✓   |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --- |
| 2.1 | `child` 是否指向合法的子组件 ID（通常为 Text 或 Icon）？                                                               | ✅  |
| 2.2 | `action` 是否正确包含 `event.name` 和可选的 `context`？                                                                | ✅  |
| 2.3 | `checks` 中所有 check 的 `condition` 是否为 `DynamicBoolean`（支持 FunctionCall/DataBinding/boolean 字面量三种形态）？ | ✅  |
| 2.4 | 任一 check 失败时，Button 是否自动 disabled？                                                                          | ✅  |
| 2.5 | 点击是否触发了 `ActionEmitter.emit(action)`？                                                                          | ✅  |
| 2.6 | action 的 `context` 中如有 `path`，是否从最新的 dataModel 快照解析？                                                   | ✅  |
| 2.7 | `action` 是否使用 `Action` 类型（`{ event: ActionEvent }` 或 `{ functionCall: FunctionCall }` 二选一）？               | ✅  |
| 2.8 | `data-a2ui-action-type` 是否正确设置为 `"client"` 或 `"server"`？                                                      | ✅  |

**常见误用**:

- ❌ `action` 中 `context.value` 用了 `{ "path": "/value" }` 但忘记前导 `/`
- ❌ checks 失败时 Button 仍可点击 — 应在样式 + 事件上都拦截
- ❌ checks 使用了不存在的函数名 — FunctionRegistry 中查不到

---

### 1.3 TextField

```typescript
interface TextFieldProps {
  label: DynamicString; // ★ 标签文本（支持动态绑定）
  value?: DynamicString; // 双向绑定路径（可选，但实践中几乎总是提供）
  variant?: 'shortText' | 'longText' | 'number' | 'obscured';
  checks?: CheckRule[]; // 输入校验（来自 Checkable）
  placeholder?: DynamicString; // ★ 占位提示文本（支持动态绑定）
}
```

| #   | 核查项                                                                   | ✓   |
| --- | ------------------------------------------------------------------------ | --- |
| 3.1 | `value` 的 `path` 是否正确绑定到 dataModel？                             | ✅  |
| 3.2 | 用户输入时，`DynamicBinding.write()` 是否**立即同步**到 DataModelStore？ | ✅  |
| 3.3 | `checks` 中的 `required`/`email`/`regex` 是否在每次输入时实时校验？      | ✅  |
| 3.4 | 校验失败时 `DynamicBinding.error` signal 是否更新为错误 message？        | ✅  |
| 3.5 | 校验失败时，输入框是否显示错误样式 + 错误提示文本？                      | ✅  |
| 3.6 | `placeholder` 是否在输入框为空时显示占位提示文本？                       | ✅  |
| 3.7 | `variant: 'number'` 时，输入框是否限制为数字输入？                       | ✅  |
| 3.8 | `variant: 'obscured'` 时，输入内容是否遮挡（密码框）？                   | ✅  |
| 3.9 | `variant: 'longText'` 是否使用 `<textarea>` 而非 `<input>`？             | ✅  |

**常见误用**:

- ❌ `write()` 异步化 — 规范要求同步更新 DataModel
- ❌ checks 只在 blur 时才校验 — 应实时显示错误

---

### 1.4 Row / Column（容器组件）

```typescript
interface RowProps {
  children: ChildList; // ★ 子组件列表
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | 'stretch';
  align?: 'start' | 'center' | 'end' | 'stretch'; // 默认 'stretch'
  weight?: number; // flex-grow
}
// Column 完全相同，方向为纵向
```

| #   | 核查项                                                                              | ✓   |
| --- | ----------------------------------------------------------------------------------- | --- |
| 4.1 | `children` 是否通过 `child-list-resolver.ts` 解析为 `Signal<ComponentInstance[]>`？ | ✅  |
| 4.2 | `array` 模式的 children 是否直接渲染固定 ID 列表？                                  | ✅  |
| 4.3 | `object` 模式的 children 是否根据 data path 展开数组？                              | ✅  |
| 4.4 | `justify` 映射到 CSS 的 `justify-content`？                                         | ✅  |
| 4.5 | `align` 映射到 CSS 的 `align-items`？                                               | ✅  |
| 4.6 | `weight` 映射到 CSS 的 `flex: weight`？                                             | ✅  |
| 4.7 | Row 的 CSS `display: flex; flex-direction: row`？                                   | ✅  |
| 4.8 | Column 的 CSS `display: flex; flex-direction: column`？                             | ✅  |
| 4.9 | `align` 默认值是否为 `'stretch'`？                                                  | ✅  |

**常见误用**:

- ❌ Row 套 Row 无限嵌套 — LLM 可控，渲染器无限制
- ❌ `object` 模式的 `path` 指向非数组 — 不渲染子组件

---

### 1.5 List

```typescript
interface ListProps {
  children: ChildList; // 通常是 object 模式
  direction?: 'vertical' | 'horizontal';
  align?: 'start' | 'center' | 'end' | 'stretch'; // 默认 'stretch'
  weight?: number; // flex-grow
}
```

| #   | 核查项                                                              | ✓   |
| --- | ------------------------------------------------------------------- | --- |
| 5.1 | `direction: 'vertical'` 是否产生纵向列表？                          | ✅  |
| 5.2 | `direction: 'horizontal'` 是否产生横向滚动列表？                    | ✅  |
| 5.3 | object 模式模板实例的 scope 是否正确（`/items/0`, `/items/1`...）？ | ✅  |
| 5.4 | 数据更新时是否只重新计算变化的实例（不重建整个列表）？              | ✅  |
| 5.5 | `align` 默认值是否为 `'stretch'`？                                  | ✅  |

---

### 1.6 Card

```typescript
interface CardProps {
  child: ComponentId; // 单个子组件
}
```

| #   | 核查项                                       | ✓   |
| --- | -------------------------------------------- | --- |
| 6.1 | `child` 是否渲染在带边框/阴影的卡片容器内？  | ✅  |
| 6.2 | 是否只有一个 `child`（不是 children 数组）？ | ✅  |

**常见误用**:

- ❌ 把 `child` 写成 `children` — Schema 不匹配

---

### 1.7 Tabs

```typescript
interface TabItem {
  title: DynamicString; // ★ Tab 标题（支持动态绑定）
  child: ComponentId;
}

interface TabsProps {
  tabs: TabItem[]; // ★ Tab 定义（属性名为 tabs，非 tabItems）
}
```

| #   | 核查项                                                     | ✓   |
| --- | ---------------------------------------------------------- | --- |
| 7.1 | `tabs` 是否每个都有 `title`（DynamicString）和子组件引用？ | ✅  |
| 7.2 | 点击 Tab 标题时是否切换显示对应的 `child` 组件？           | ✅  |
| 7.3 | Tab 标题是否渲染在横向 Tab bar 中？                        | ✅  |
| 7.4 | 第一个 Tab 是否默认激活？                                  | ✅  |

---

### 1.8 Modal

```typescript
interface ModalProps {
  trigger: Child; // ★ 触发 Modal 打开的子组件（点击后显示 Modal）
  content: Child; // ★ Modal 内容区域的子组件
}
```

| #   | 核查项                                         | ✓   |
| --- | ---------------------------------------------- | --- |
| 8.1 | `trigger` 组件点击时是否打开 Modal？           | ✅  |
| 8.2 | `content` 是否渲染在 Modal 弹窗内？            | ✅  |
| 8.3 | Modal 是否覆盖在页面内容之上（z-index）？      | ✅  |
| 8.4 | 是否包含遮罩层（overlay）？                    | ✅  |
| 8.5 | 是否支持点击遮罩层关闭（可选）？               | ✅  |
| 8.6 | Modal 关闭时是否销毁内部组件（避免内存泄漏）？ | ✅  |

---

### 1.9 CheckBox

```typescript
interface CheckBoxProps {
  label: DynamicString; // ★ 标签文本（支持动态绑定）
  value: DynamicBoolean; // ★ 双向绑定
}
```

| #   | 核查项                                                     | ✓   |
| --- | ---------------------------------------------------------- | --- |
| 9.1 | `value` 是否双向绑定到 dataModel？                         | ✅  |
| 9.2 | 点击时是否立即调用 `DynamicBinding.write(!currentValue)`？ | ✅  |
| 9.3 | 复选框的视觉效果是否正确（勾选 vs 未勾选）？               | ✅  |

---

### 1.10 ChoicePicker

```typescript
interface ChoicePickerProps {
  label?: DynamicString;
  options: { label: DynamicString; value: string }[];
  value: DynamicStringList; // ★ 双向绑定，始终为 string[]
  variant?: 'mutuallyExclusive' | 'multipleSelection'; // 默认 'mutuallyExclusive'
  displayStyle?: 'checkbox' | 'chips'; // 展示样式，默认 'checkbox'
  filterable?: boolean; // 是否支持筛选，默认 false
}
```

| #    | 核查项                                                                 | ✓                                                      |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 10.1 | `mutuallyExclusive` 是否为单选（Radio）模式？                          | ✅                                                     |
| 10.2 | `multipleSelection` 是否为多选（Checkbox）模式？                       | **❌ 无虚拟滚动（1000 模板实例全量渲染，性能未达标）** |
| 10.3 | 选中值是否正确写入 dataModel？两种模式下 `value` 类型始终为 `string[]` | ✅                                                     |
| 10.4 | `options` 是否正确渲染为选项列表？                                     | **❌ 无 debounce（effect 直接 setOption）**            |
| 10.5 | `displayStyle: 'chips'` 时是否以标签页样式展示选项？                   | ✅                                                     |
| 10.6 | `filterable: true` 时是否支持选项搜索/筛选？                           | ✅                                                     |

**常见误用**:

- ❌ `mutuallyExclusive` 模式下 value 写成单个字符串 — 应始终为 `string[]`

---

### 1.11 Slider

```typescript
interface SliderProps {
  label?: DynamicString;
  value: DynamicNumber; // ★ 双向绑定
  min?: number; // 默认 0
  max: number; // ★ 必需属性
  steps?: number; // ★ 步长，integer（minimum: 1），非 DynamicNumber
  checks?: CheckRule[]; // 输入校验（来自 Checkable）
}
```

| #    | 核查项                                            | ✓   |
| ---- | ------------------------------------------------- | --- |
| 11.1 | `value` 是否双向绑定？                            | ✅  |
| 11.2 | `min`/`max` 是否正确限制滑块范围？                | ✅  |
| 11.3 | `steps` 是否将滑块值吸附到离散间隔？              | ✅  |
| 11.4 | `steps` 为整数类型是否正常工作？                  | ✅  |
| 11.5 | 滑块值变化时是否实时更新 dataModel + 显示当前值？ | ✅  |
| 11.6 | `min` 未设置时是否默认 0？                        | ✅  |
| 11.7 | `max` 是否必须设置（无默认值）？                  | ✅  |
| 11.8 | `checks` 中的校验是否在每次滑动时实时执行？       | ✅  |

---

### 1.12 DateTimeInput

```typescript
interface DateTimeInputProps {
  label?: DynamicString;
  value: DynamicString; // ★ ISO 8601 字符串双向绑定
  enableDate?: boolean; // 是否启用日期选择，默认 false
  enableTime?: boolean; // 是否启用时间选择，默认 false
}
```

| #    | 核查项                                                       | ✓   |
| ---- | ------------------------------------------------------------ | --- |
| 12.1 | `value` 是否为 ISO 8601 格式（如 `2026-01-15T12:00:00Z`）？  | ✅  |
| 12.2 | `min` 和 `max` 属性是否为 `DynamicString`（ISO 8601 格式）？ | ✅  |
| 12.3 | 日期选择器是否正确解析和回写 ISO 8601？                      | ✅  |
| 12.4 | 是否显示本地时区格式但内部存储 UTC？                         | ✅  |
| 12.5 | `enableDate` 启用时是否提供日期选择？                        | ✅  |
| 12.6 | `enableTime` 启用时是否提供时间选择？                        | ✅  |

---

### 1.13 Image / Icon

```typescript
interface ImageProps {
  url: DynamicString;
  description?: DynamicString; // accessibility 文本
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown'; // CSS object-fit, 默认 fill
  variant?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header'; // v1.0 标准 variant, 默认 mediumFeature
}

interface IconProps {
  name: DynamicString; // 图标名称（v1.0 预定义 60+ 标准图标名）或 { path: "svg..." } 自定义路径
}
```

| #    | 核查项                                                                                                             | ✓   |
| ---- | ------------------------------------------------------------------------------------------------------------------ | --- |
| 13.1 | Image 的 `url` 是否正确设置 `<img src>`？                                                                          | ✅  |
| 13.2 | Image 加载失败时是否显示 fallback（如灰色占位）？                                                                  | ✅  |
| 13.3 | Image 的 `description` 字段是否为 `DynamicString`（accessibility 文本）？                                          | ✅  |
| 13.4 | `fit` 是否映射到 CSS `object-fit`（contain/cover/fill/none/scaleDown）？                                           | ✅  |
| 13.5 | Image `variant` 是否映射正确尺寸（icon/avatar/smallFeature/mediumFeature/largeFeature/header）？                   | ✅  |
| 13.6 | Icon 的 `name` 是否映射到 v1.0 标准图标集（`accountCircle`, `check`, `close`, `search`, `settings` 等 60+ 图标）？ | ✅  |
| 13.7 | Icon 是否支持自定义 SVG path（通过 `svgPath: DynamicString` 属性）？                                               | ✅  |

---

### 1.14 Video / AudioPlayer

```typescript
interface VideoProps {
  url: DynamicString;
  posterUrl?: DynamicString; // 播放前预览图
}
interface AudioPlayerProps {
  url: DynamicString;
  description?: DynamicString; // 音频描述（accessibility）
}
```

| #    | 核查项                                                 | ✓   |
| ---- | ------------------------------------------------------ | --- |
| 14.1 | Video 是否使用 `<video>` 标签？                        | ✅  |
| 14.2 | AudioPlayer 是否使用 `<audio>` 标签？                  | ✅  |
| 14.3 | `posterUrl` 是否在视频加载前显示预览图？               | ✅  |
| 14.4 | 加载失败时是否正确处理错误状态？                       | ✅  |
| 14.5 | memory cleanup: 组件销毁时是否停止媒体播放并释放资源？ | ✅  |

---

### 1.15 Divider

```typescript
interface DividerProps {
  axis?: 'horizontal' | 'vertical'; // 默认 horizontal
}
```

| #    | 核查项                                     | ✓   |
| ---- | ------------------------------------------ | --- |
| 15.1 | `axis: 'horizontal'` 是否渲染水平分隔线？  | ✅  |
| 15.2 | `axis: 'vertical'` 是否渲染垂直分隔线？    | ✅  |
| 15.3 | `axis` 未设置时默认值是否为 `horizontal`？ | ✅  |

---

### 1.16 Spacer（非 v1.0 标准组件）

> **注意**: Spacer 不是 A2UI v1.0 Basic Catalog 的标准组件。如需要弹性空白效果，可考虑使用 `weight` 属性或自定义组件实现。
>
> 以下核查项仅在使用自定义 Spacer 实现时参考：

```typescript
interface SpacerProps {
  // 弹性空白组件，无自定义属性
  // 填充 Row/Column 中剩余空间
}
```

| #    | 核查项                                                       | ✓   |
| ---- | ------------------------------------------------------------ | --- |
| 16.1 | Spacer 是否渲染为弹性空白（不展示任何内容）？                | ✅  |
| 16.2 | 在 Row 中是否水平填充剩余空间？                              | ✅  |
| 16.3 | 在 Column 中是否垂直填充剩余空间？                           | ✅  |
| 16.4 | 多个 Spacer 是否按权重（如 flex）比例分配空间？              | ✅  |
| 16.5 | Spacer 的 Angular Component 是否已实现并注册到 geo-catalog？ | ✅  |
| 16.6 | 非 flex 容器中的 Spacer 是否退化为零宽度/零高度（不报错）？  | ✅  |

---

## 二、DynamicBinding 接口（跨组件共用）

### 接口定义

```typescript
interface DynamicBinding<T = string> {
  readonly value: Signal<T>; // 只读 Signal
  readonly error: Signal<string | null>; // checks 校验结果
  write(v: T): void; // 同步回写 DataModelStore
}
```

### 核查项

| #   | 核查项                                                                               | ✓   |
| --- | ------------------------------------------------------------------------------------ | --- |
| D.1 | `DynamicBinding` 的工厂函数是否在 `DynamicOutlet` 的 `component-factory.ts` 中调用？ |     |
| D.2 | 工厂函数是否将 `scope` 作为常量嵌入（不创建 Signal）？                               |     |
| D.3 | `value` computed 是否读取 `DataModelStore.data()` Signal 建立依赖？                  |     |
| D.4 | `write()` 是否内部调用 `DataModelStore.updatePointer(path, value)`（同步）？         |     |
| D.5 | `error` computed 是否读取 `value` signal 并执行 checks？                             |     |
| D.6 | checks 是否支持 `required`/`email`/`regex` 等标准函数？                              |     |
| D.7 | checks 中的 FunctionCall args 是否也支持 Dynamic\*？                                 |     |
| D.8 | 多个组件绑定同一 path 时，一个 write 是否触发所有 bind 的 value 更新？               |     |

**常见误用**:

- ❌ 组件不接收 DynamicBinding，而是自己 `inject(DataModelStore)` — 违反架构决策 19
- ❌ `write()` 中 path 拼接错误（忘记 scope 前缀）
- ❌ `error` 的 computed 不读取 `value` signal — 校验无效

---

## 三、自定义组件核查（geo-sensor catalog，11 个组件）

> 实现文件: `apps/web/src/app/a2ui/geo/`。全部 ECharts 图表类组件基于 `GeoChartBase`/`base-echarts.ts` 统一样板。

### 3.1 GeoChartBase 统一样板（RiskPanel / MultiSensorChart / PredictionTimeline / Chart / StatsSummary / RainfallChart / TiltRoseDiagram / DisplacementScatter / AccelerationRadar / GaugeChart）

```typescript
// 统一样板（geo-chart-base.ts）：所有图表/面板组件共同遵守
```

| #   | 核查项                                                                                             | ✓   |
| --- | -------------------------------------------------------------------------------------------------- | --- |
| 3.1 | 是否在 `ngAfterViewInit` 中初始化 `echarts.init(dom)`？                                            | ✅  |
| 3.2 | `options.value()` 变化时，是否通过 `effect()` 调 `chart.setOption()`？                             | ✅  |
| 3.3 | `setOption` 是否使用 `{ notMerge: true }` 模式（全量替换）？                                       | ✅  |
| 3.4 | 是否通过 `ResizeObserver` 监听容器大小变化并调 `chart.resize()`？                                  | ✅  |
| 3.5 | 组件销毁时（`DestroyRef.onDestroy`）是否调 `chart.dispose()`？                                     | ✅  |
| 3.6 | 是否处理了 echarts 实例为空的情况（`if (opts && this.#chart)`）？                                  | ✅  |
| 3.7 | 是否通过 `ComponentBinder.boundProps` 响应式绑定 dataModel（`updateDataModel` 增量刷新无需重建）？ | ✅  |
| 3.8 | 主题是否统一走 `chart-theme.ts`（深色/浅色适配，不硬编码颜色）？                                   | ✅  |

**常见误用**:

- ❌ effect 中忘记条件判断 `if (opts && this.#chart)` — chart 未初始化时崩溃
- ❌ 初始化在 `ngOnInit` 中 — DOM 还不存在
- ❌ 忘记 `DestroyRef.onDestroy` — 内存泄漏

---

### 3.2 TiltNetworkMonitor（倾角监测网）

> 多传感器卡片网格（如 20 个倾角传感器），每卡显示 X/Y/Z 倾角变化量（相对初始姿态的累计变化量）实测 + 预测虚线、方向角/方位角趋势。
> 数据经 DataBinding（`{path: "/tilt/sensors"}`）绑定，服务端以 `updateDataModel` 增量送达。
> TiltItem 契约：`angle{x,y,z}` 为累计变化量（首点归零），`amplitude`（=sqrt(x²+y²)）为合变化幅度，`angleXY` 为变形方向角，`azi` 为方位角。

| #     | 核查项                                                             | ✓   |
| ----- | ------------------------------------------------------------------ | --- |
| 3.2.1 | `sensors` 是否通过 DataBinding 绑定（非内嵌大数组）？              | ✅  |
| 3.2.2 | 数据到达前是否显示空态/占位而非崩溃（渐进渲染）？                  | ✅  |
| 3.2.3 | `updateDataModel` 增量到达时，卡片是否响应式更新（不重建组件树）？ | ✅  |
| 3.2.4 | 单传感器卡片销毁时是否清理 echarts 实例？                          | ✅  |

---

### 3.3 RiskPanel / StatsSummary（非 ECharts 面板类）

| #     | 核查项                                                                                      | ✓   |
| ----- | ------------------------------------------------------------------------------------------- | --- |
| 3.3.1 | RiskPanel 的 `warningLevel` 是否映射到语义颜色（red/orange/yellow）？                       | ✅  |
| 3.3.2 | 风险等级颜色是否通过主题/样式类实现（非内联硬编码色值）？                                   | ✅  |
| 3.3.3 | StatsSummary 的 `refreshData` action 是否走 action 闭环（后端返回最新数据写回 dataModel）？ | ✅  |

---

## 四、Catalog 注册与组件发现

### 4.1 标准组件注册

```typescript
// apps/web/src/app/a2ui/component-type-map.ts
export const basicCatalog: CatalogDefinition = {
  catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
  components: {
    Text,
    Button,
    TextField,
    Row,
    Column,
    List,
    Card,
    Tabs,
    Modal,
    Divider,
    Image,
    Icon,
    Video,
    AudioPlayer,
    CheckBox,
    ChoicePicker,
    Slider,
    DateTimeInput,
  },
  functions: {
    required,
    regex,
    length,
    numeric,
    email,
    formatString,
    formatNumber,
    formatCurrency,
    formatDate,
    pluralize,
    openUrl,
    and,
    or,
    not,
  },
};
```

| #     | 核查项                                                                                | ✓   |
| ----- | ------------------------------------------------------------------------------------- | --- |
| 4.1.1 | `basicCatalog.catalogId` 是否与 A2UI v1.0 官方 Basic Catalog 的 catalogId 一致？      | ✅  |
| 4.1.2 | 是否每个组件的 Schema 都注册到了 `components` map 中？                                | ✅  |
| 4.1.3 | 组件 Schema 的 key 是否与 `component-registry.ts` 中注册的 Angular Component 类对应？ | ✅  |
| 4.1.4 | `provideBasicCatalog()` 工厂函数是否调用了 `CatalogRegistry.register(basicCatalog)`？ | ✅  |
| 4.1.5 | `CatalogRegistry.register()` 是否同时注册了 Schema 和 Component 类？                  | ✅  |

### 4.2 自定义组件注册

```typescript
// 实际实现: apps/web/src/app/a2ui/geo-catalog.ts（前端注册）
//          + packages/a2ui/sdk/resources/geo-catalog/catalog.json（Schema 定义）
export const geoSensorCatalog: CatalogDefinition = {
  catalogId: 'https://geo-system.com/a2ui/v1.0/geo-sensor-catalog', // 无 .json 后缀
  protocolVersion: '1.0',
  components: {
    RiskPanel, // 风险面板（风险等级/置信度/致灾因子）
    MultiSensorChart, // 多传感器趋势图（折线）
    PredictionTimeline, // 风险预测时间线
    Chart, // 通用 ECharts 容器（语义名，原 ECharts）
    StatsSummary, // 关键指标统计卡
    RainfallChart, // 降雨柱状图（累计线叠加，双 Y 轴）
    TiltRoseDiagram, // 倾角极坐标玫瑰图
    DisplacementScatter, // GNSS 位移散点（轨迹线）
    AccelerationRadar, // 加速度雷达图（X/Y/Z）
    GaugeChart, // 含水率仪表盘（阈值指示）
    TiltNetworkMonitor, // 倾角监测网（多传感器卡片网格，DataBinding 数据）
  },
  functions: {}, // 无自定义函数
};
```

| #     | 核查项                                                                                                           | ✓   |
| ----- | ---------------------------------------------------------------------------------------------------------------- | --- |
| 4.2.1 | `geoSensorCatalog.catalogId` 是否与前端 `RENDERER_CAPABILITIES.supportedCatalogIds` 中的 `GEO_CATALOG_ID` 一致？ | ✅  |
| 4.2.2 | 前端 `getGeoCatalogRegistrations()` 是否注册了全部 11 个 geo 组件到 `CatalogRegistry`？                          | ✅  |
| 4.2.3 | geo catalog Schema（resources）中的 11 个组件名是否与前端注册的组件类一一对应（大小写严格一致）？                | ✅  |
| 4.2.4 | geo catalog 是否声明了 `protocolVersion: "1.0"`，且 `$defs` 仅含 `anyComponent`/`anyFunction`？                  | ✅  |
| 4.2.5 | geo 组件是否全部基于 `GeoChartBase`（统一样板：`ngAfterViewInit` 初始化 + `effect` 响应 + `DestroyRef` 清理）？  | ✅  |

---

## 五、A2UI 渲染器为 page-agent 注入的 DOM 元数据

### 核查项

| #   | 核查项                                                                                    | ✓   |
| --- | ----------------------------------------------------------------------------------------- | --- |
| 5.1 | `dynamic-outlet.component.ts` 在渲染每个可交互元素时，是否注入了 `data-a2ui-surface-id`？ | ✅  |
| 5.2 | 是否注入了 `data-a2ui-component-id`？                                                     | ✅  |
| 5.3 | 是否注入了 `data-a2ui-action-type`（`"client"` 或 `"server"`）？                          | ✅  |
| 5.4 | server action 的组件是否注入了 `data-a2ui-action-name`？                                  | ✅  |
| 5.5 | 是否注入了 `data-a2ui-label`（人类可读标签）？                                            | ✅  |
| 5.6 | 这些属性是否使用 `[attr.data-xxx]`（不是 `[data-xxx]`）确保渲染到 DOM？                   | ✅  |

**常见误用**:

- ❌ 使用 `[data-a2ui-component-id]="id"` 而非 `[attr.data-a2ui-component-id]="id"` — Angular 不会渲染到 DOM 属性
- ❌ server action 误标注为 `client` — page-agent 会错误地直接 DOM 操作

---

## 六、Leaf-Margin 布局策略（实现指南）

来自 A2UI v1.0 Basic Catalog Implementation Guide §3，防止间距乘数效应。

**核心原则**：

- **不可见容器**（Row/Column/List）：`margin=0, padding=0`（纯结构容器）
- **可视叶子组件**（Text/Image/Icon/Video/AudioPlayer/Slider）：统一外部 margin（如 8dp）
- **可见边界容器**（Card/Button/TextField/CheckBox/ChoicePicker）：内部 padding + 外部 margin

| #   | 核查项                                                      | ✓   |
| --- | ----------------------------------------------------------- | --- |
| 6.1 | 结构容器（Row/Column/List）是否零 padding + 零 margin？     | ✅  |
| 6.2 | 叶子组件是否应用统一外部 margin？                           | ✅  |
| 6.3 | 嵌套容器时是否不会累积间距（避免 spacing multiplication）？ | ✅  |

---

## 七、颜色对比度与嵌套（实现指南）

来自 A2UI v1.0 Basic Catalog Implementation Guide §4，依赖框架原生主题继承。

**核心原则**：

- Text/Icon **从不硬编码颜色**，始终从环境继承
- Button primary 通过框架原生机制设置对比色（CSS `color` 继承 / Compose `CompositionLocal` / SwiftUI `.foregroundColor`）
- Card 嵌套使用**透明背景 + 边框**（非交替底色）

| #   | 核查项                                              | ✓   |
| --- | --------------------------------------------------- | --- |
| 7.1 | 叶子组件是否从不设置固定颜色？                      | ✅  |
| 7.2 | Button primary 的文本颜色是否通过框架机制自动对比？ | ✅  |
| 7.3 | 嵌套 Card 是否使用边框而非交替底色区分层级？        | ✅  |

---

## 八、openUrl 函数安全约束

| #   | 核查项                                                                                    | ✓   |
| --- | ----------------------------------------------------------------------------------------- | --- |
| 8.1 | `openUrl` 是否验证 URL scheme 仅允许 `https:` 和 `http:`（拒绝 `javascript:`、`data:`）？ | ✅  |
| 8.2 | 新窗口打开时是否设置 `noopener,noreferrer`？                                              | ✅  |
| 8.3 | 相对 URL 是否先解析为绝对 URL 再验证 scheme？                                             | ✅  |
| 8.4 | 无效 scheme 时是否抛异常并中止操作？                                                      | ✅  |

---

## 九、Checks `condition` 包装模式（v1.0 规范）

```typescript
// v1.0 CheckRule: condition 包裹校验逻辑
interface CheckRule {
  condition: DynamicBoolean; // FunctionCall / DataBinding / boolean 字面量
  message: string; // 校验失败错误信息
}
```

| #   | 核查项                                                                    | ✓   |
| --- | ------------------------------------------------------------------------- | --- |
| 9.1 | CheckRule 是否使用 `condition` 包裹（非直接 `{ call, args, message }`）？ | ✅  |
| 9.2 | `condition` 是否支持三种形态（FunctionCall / DataBinding / literal）？    | ✅  |
| 9.3 | `condition` 中是否支持嵌套逻辑（`and`/`or`/`not` 组合）？                 | ✅  |
| 9.4 | Button 的 checks 全部通过后才可点击（任一 fail → disabled）？             | ✅  |

---

## 十、组件性能核查

| #    | 核查项                                                                       | ✓                                                      |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| 10.1 | 大表单（50 个 TextField + 50 个动态属性）渲染性能是否可接受（<100ms 首屏）？ | ✅                                                     |
| 10.2 | `object` 模式 ChildList 渲染 1000 个模板实例时，是否有虚拟滚动？             | **❌ 无虚拟滚动（1000 模板实例全量渲染，性能未达标）** |
| 10.3 | `updateDataModel` 后是否只重绘受影响的组件（变更检测精确性）？               | ✅                                                     |
| 10.4 | Echarts 图表在 `effect()` 中频繁 `setOption` 时，是否有 debounce？           | **❌ 无 debounce（effect 直接 setOption）**            |
| 10.5 | `linkedSignal` 的 `equal` 函数是否正确防止了不必要的重计算？                 | ✅                                                     |

---

## 十一、组件错误处理核查

| #    | 核查项                                                                             | ✓   |
| ---- | ---------------------------------------------------------------------------------- | --- |
| 11.1 | 未知组件类型（Catalog 中不存在）是否渲染 `<geo-unknown-component>` 而非白屏？      | ✅  |
| 11.2 | 组件初始化异常是否被 Angular `ErrorHandler` 捕获并标记 surface 为 degraded？       | ✅  |
| 11.3 | DynamicBinding 的 `write()` 失败时是否静默（不抛异常）？                           | ✅  |
| 11.4 | 子组件渲染异常是否不影响同级其他组件？                                             | ✅  |
| 11.5 | 未知组件类型渲染失败时，是否有清晰的控制台警告（不白屏）？                         | ✅  |
| 11.6 | 同一个 surface 内有 50+ 组件时，渲染是否正常？                                     | ✅  |
| 11.7 | `ngAfterViewInit` 中初始化第三方库时，DOM 是否已存在（`viewChild` 非 undefined）？ | ✅  |

---

## 十二、DynamicBinding 创建与传递链路核查

### 核查项

| #    | 核查项                                                                                                      | ✓   |
| ---- | ----------------------------------------------------------------------------------------------------------- | --- |
| 12.1 | `DynamicOutlet.component-factory.ts` 是否为每个组件的每个 Dynamic\* 属性创建独立的 `DynamicBinding`？       | ✅  |
| 12.2 | `createDynamicBinding()` 的 `scope` 参数是否为编译时常量（不参与 Signal 依赖图）？                          | ✅  |
| 12.3 | 同一模板的多个实例（实例 0 和实例 1）的 `DynamicBinding` 是否使用不同的 scope（`/items/0` vs `/items/1`）？ | ✅  |
| 12.4 | `value` computed 是否正确读取 `DataModelStore.data()` 建立依赖？                                            | ✅  |
| 12.5 | `write()` 是否在 path 不存在时**静默忽略**（非输入组件传入了 DynamicBinding 但无 path）？                   | ✅  |
| 12.6 | `error` computed 中的 checks 是否正确读取了 `value` signal？                                                | ✅  |
| 12.7 | `ngComponentOutletInputs` 是否包含了 `dataModel` 和 `scope`（供子组件创建嵌套 DynamicBinding）？            | ✅  |

---

## 十三、标准组件 Schema 补全核查

### 13.1 Text 特殊属性

| #      | 核查项                                                                            | ✓   |
| ------ | --------------------------------------------------------------------------------- | --- |
| 13.1.1 | `variant` 属性是否映射到正确的语义标签（`body` → `<p>`，`caption` → `<small>`）？ | ✅  |
| 13.1.2 | `caption` → `<small>` 或 CSS `font-size: 0.875em`？                               | ✅  |
| 13.1.3 | text 为 DynamicString 且为字面值时是否直接渲染（无 computed overhead）？          | ✅  |

### 13.2 Button 特殊属性

| #      | 核查项                                                                   | ✓   |
| ------ | ------------------------------------------------------------------------ | --- |
| 13.2.1 | `variant: 'primary'` 是否高亮（主操作）？                                | ✅  |
| 13.2.2 | `variant: 'borderless'` 是否为无边框的文字按钮？                         | ✅  |
| 13.2.3 | `action` 中的 `context` 是否所有值都从**最新** dataModel snapshot 解析？ | ✅  |
| 13.2.4 | `checks` 全部失败时，样式是否灰化 + 点击事件不触发？                     | ✅  |

### 13.3 TextField 特殊属性

| #      | 核查项                                                                         | ✓   |
| ------ | ------------------------------------------------------------------------------ | --- |
| 13.3.1 | `variant: 'number'` 时 `<input type="number">`？                               | ✅  |
| 13.3.2 | `variant: 'obscured'` 时 `<input type="password">`？                           | ✅  |
| 13.3.3 | `variant: 'longText'` 时 `<textarea>`？                                        | ✅  |
| 13.3.4 | checks 校验在每次 `input` 事件时实时执行（非 blur）？                          | ✅  |
| 13.3.5 | 校验失败时 `DynamicBinding.error` 是否被下游 Button 的 `checks` 读取并禁用它？ | ✅  |

### 13.4 Row/Column 布局属性

| #      | 核查项                                                             | ✓   |
| ------ | ------------------------------------------------------------------ | --- |
| 13.4.1 | `justify: 'spaceBetween'` → CSS `justify-content: space-between`？ | ✅  |
| 13.4.2 | `justify: 'spaceAround'` → CSS `justify-content: space-around`？   | ✅  |
| 13.4.3 | `justify: 'spaceEvenly'` → CSS `justify-content: space-evenly`？   | ✅  |
| 13.4.4 | `justify: 'stretch'` → CSS `justify-content: stretch`？            | ✅  |
| 13.4.5 | `align: 'stretch'` → CSS `align-items: stretch`？                  | ✅  |
| 13.4.6 | `weight` → CSS `flex: <weight>`？                                  | ✅  |
| 13.4.7 | Row 的 `flex-direction: row`？                                     | ✅  |
| 13.4.8 | Column 的 `flex-direction: column`？                               | ✅  |
| 13.4.9 | 无 `children` 时是否为空白而不崩溃？                               | ✅  |

### 13.5 List 模板属性

| #      | 核查项                                                                             | ✓   |
| ------ | ---------------------------------------------------------------------------------- | --- |
| 13.5.1 | object 模式 `path` 指向的数组为空时，是否不渲染任何子组件？                        | ✅  |
| 13.5.2 | 数组长度从 5 变为 2 时，是否销毁多余的 3 个实例？                                  | ✅  |
| 13.5.3 | 数组长度从 2 变为 5 时，新增实例的 scope 是否为 `/items/2` `/items/3` `/items/4`？ | ✅  |

### 13.6 Card 属性

| #      | 核查项                                              | ✓   |
| ------ | --------------------------------------------------- | --- |
| 13.6.1 | 是否是单 `child` 而非多 `children`？— Schema 应区分 | ✅  |
| 13.6.2 | 是否包含边框、圆角、内边距、阴影？                  | ✅  |

### 13.7 Tabs 属性

| #      | 核查项                                                                                  | ✓   |
| ------ | --------------------------------------------------------------------------------------- | --- |
| 13.7.1 | `tabs` 是否每个都有 `title`（DynamicString，显示在 Tab 栏）和 `child`（Tab 面板内容）？ | ✅  |
| 13.7.2 | 点击 Tab 切换时，是否只渲染当前 Tab 对应面板（懒渲染）？                                | ✅  |
| 13.7.3 | first tab 默认是否 active？                                                             | ✅  |

### 13.8 Modal 属性

| #      | 核查项                                                | ✓   |
| ------ | ----------------------------------------------------- | --- |
| 13.8.1 | Modal 关闭时是否从 DOM 中移除（非 `display: none`）？ | ✅  |
| 13.8.2 | overlay 遮罩层的 z-index 是否高于页面其他内容？       | ✅  |
| 13.8.3 | Escape 键是否关闭 Modal（可选）？                     | ✅  |
| 13.8.4 | `trigger` 组件点击时是否正确打开 Modal？              | ✅  |

### 13.9 CheckBox / ChoicePicker

| #      | 核查项                                                          | ✓   |
| ------ | --------------------------------------------------------------- | --- |
| 13.9.1 | CheckBox 的 `value` 写入是否为 boolean？                        | ✅  |
| 13.9.2 | ChoicePicker `mutuallyExclusive` 模式 value 是否为 `string[]`？ | ✅  |
| 13.9.3 | ChoicePicker `multipleSelection` 模式 value 是否为 `string[]`？ | ✅  |

### 13.10 Slider

| #       | 核查项                           | ✓   |
| ------- | -------------------------------- | --- |
| 13.10.1 | `min` 未设置时是否默认 0？       | ✅  |
| 13.10.2 | `max` 是否必须设置（无默认值）？ | ✅  |
| 13.10.3 | `steps` 未设置时默认行为是什么？ | ✅  |
| 13.10.4 | 当前值是否以浮动标签显示？       | ✅  |

### 13.11 DateTimeInput

| #       | 核查项                                                      | ✓   |
| ------- | ----------------------------------------------------------- | --- |
| 13.11.1 | 是否使用原生 `<input type="datetime-local">` 或日期选择库？ | ✅  |
| 13.11.2 | 内部存储格式是否为 ISO 8601？                               | ✅  |
| 13.11.3 | 时区处理是否正确（前端本地时区 ↔ UTC）？                    | ✅  |
| 13.11.4 | `enableDate` 启用时是否提供日期选择？                       | ✅  |
| 13.11.5 | `enableTime` 启用时是否提供时间选择？                       | ✅  |

---

## 十四、自定义组件扩展核查

### 14.1 新增第三方库组件模板

```typescript
@Component({
  selector: 'geo-my-component',
  template: `<div #container></div>`,
})
class MyComponent implements AfterViewInit {
  readonly config = input.required<DynamicBinding<Config>>();
  readonly container = viewChild.required<ElementRef>('container');
  #instance?: ThirdPartyInstance;
  #destroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    this.#instance = ThirdPartySDK.init(this.container().nativeElement);
    effect(() => {
      const cfg = this.config().value();
      cfg && this.#instance?.update(cfg);
    });
    this.#destroyRef.onDestroy(() => this.#instance?.destroy());
  }
}
```

| #      | 核查项                                                              | ✓   |
| ------ | ------------------------------------------------------------------- | --- |
| 14.1.1 | 第三方库初始化是否在 `ngAfterViewInit`（DOM 已渲染）？              | ✅  |
| 14.1.2 | 配置更新是否通过 `effect()` 实现（自动追踪 DynamicBinding.value）？ | ✅  |
| 14.1.3 | 销毁清理是否通过 `DestroyRef.onDestroy`？                           | ✅  |
| 14.1.4 | 容器 div 是否使用 `viewChild`（非 `document.getElementById`）？     | ✅  |
| 14.1.5 | 第三方库实例在 `effect()` 回调中是否存在（防御式检查）？            | ✅  |
| 14.1.6 | SDK 实例是否在 `OnDestroy` 时 `dispose()`/`destroy()`？             | ✅  |
| 14.1.7 | ResizeObserver（如有）是否在 destroy 时 disconnect？                | ✅  |

### 14.2 Echarts 专项（项目使用 echarts 6）

| #      | 核查项                                                                              | ✓                                                                      |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 14.2.1 | `echarts.init(dom, null, { width: 'auto', height: 'auto' })` 是否正确设置自适应？   | ✅                                                                     |
| 14.2.2 | `setOption` 是否使用 `{ notMerge: true }` 模式？                                    | ✅                                                                     |
| 14.2.3 | 是否处理了 echarts 事件（click、dblclick、legendselectchanged）映射到 A2UI action？ | **⚠ 未实现 echarts 事件（click/legendselectchanged）映射 A2UI action** |
| 14.2.4 | 是否兼容 echarts 6.x API（本项目依赖 `echarts@^6`）？                               | ✅                                                                     |

---

## 十五、DynamicOutlet 渲染流核查

### 核查项

| #    | 核查项                                                                                              | ✓   |
| ---- | --------------------------------------------------------------------------------------------------- | --- |
| 15.1 | `children()` Signal 变化时，`@for` 是否只重新渲染新增的 `trackBy` 项？                              | ✅  |
| 15.2 | `componentMap()` 变化时（新组件到达），`linkedSignal` 是否自动切换 placeholder → 真实组件？         | ✅  |
| 15.3 | `ngComponentOutlet` 是否传递了完整的 `ngComponentOutletInputs`（含 dataModel + scope + bindings）？ | ✅  |
| 15.4 | 递归嵌套渲染（Row → Column → Button → Text）是否正常工作？                                          | ✅  |
| 15.5 | 递归深度是否有上限（防止无限嵌套）？                                                                | ✅  |
| 15.6 | 同一 surfaceId 的多条 `updateComponents` 是否合并到同一个 Component Map？                           | ✅  |
| 15.7 | Component ID 重复时，后者是否覆盖前者（更新属性）？                                                 | ✅  |
