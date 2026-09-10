# @freezestudio/a2ui-web-core

## 3.1.0

### Minor Changes

- b74efd1: feat(a2ui): 落地 todo 清单三项 —— 渲染端组合约束错误码、angular testing 测试基座、agent 生成示例

  - web-core (minor): 新增 `composition-constraints.ts`（catalog 约束注册表 +
    `checkCompositionConstraints`），message-handler 组件校验链路主动产生
    UNALLOWED_PARENT / UNALLOWED_CHILD 标准错误码（v1.0 #2155）；新增结构化
    `validateComponentsDetailed`
  - angular (minor): 新增 `testing/` 二级入口（`createBoundProperty` /
    `setA2uiInputs`），对齐官方 renderers/angular/testing 布局
  - agent (patch): system prompt 中旧消息名 callFunction/actionResponse 修正为
    v1.0 #2210 的 callRendererFunction/agentFunctionResponse

### Patch Changes

- 6e13c03: feat(a2ui): 对齐官方 v1.0 协议 schema —— 新增 RendererDataModel（renderer_data_model.json）、强化 FunctionDefinition 校验（returnType/allowedCallers/requiresUserActivation 约束）

  - sdk: 新增 `RendererDataModelSchema`/`isRendererDataModel`（对应官方 renderer_data_model.json）；`FunctionDefinitionSchema` 补 returnType 8 枚举、allowedCallers 3 枚举、requiresUserActivation（true 时强制 rendererOnly）
  - web-core/angular: `getSendDataModelPayload()` 返回类型细化为 `RendererDataModel`（非破坏）
  - conformance: 新增官方 basic catalog examples（43 个）SDK zod 一致性测试

## 3.0.0

### Major Changes

- 2b34c44: 对齐官方 a2ui v1.0 协议：`callableFrom` → `allowedCallers` 改名 + `requiresUserActivation` 收紧

  - 同步官方规范副本到上游 HEAD（29b715fa，#2238）：
    - 将函数执行边界字段 `callableFrom` 更名为 `allowedCallers`（枚举 `rendererOnly | agentOnly | rendererOrAgent`，默认 `rendererOnly`）。
    - 收紧 `requiresUserActivation: true` 的条件约束：`allowedCallers` 仅允许 `rendererOnly`（原先误允许 `rendererOrAgent`，直接 Agent 调用无法提供用户激活上下文）。
  - **破坏性变更（breaking）**：SDK 公开 API 改名：
    - `FunctionApi.callableFrom` → `FunctionApi.allowedCallers`
    - `createFunctionApi({ callableFrom })` → `createFunctionApi({ allowedCallers })`
    - `Catalog.getFunctionCallableFrom()` → `Catalog.getFunctionAllowedCallers()`
    - web-core `getFunctionCallableFrom()` → `getFunctionAllowedCallers()`（angular 重新导出同步更新）
    - 所有 basic catalog 函数定义、prompt 生成文案、校验测试同步更新。
  - `validationResult` 返回类型（#2220）保持支持（regex/numeric/email/required/length 等校验类函数）。

## 2.0.0

### Major Changes

- a1291c0: 严格对齐 A2UI v1.0 协议：

  - 移除 `createSurface.surfaceProperties`（v1.0 已删除）
  - 移除 basic catalog 非规范兜底，严格按组件级/函数级 `catalogId` 解析
  - 函数名改为严格大小写匹配，并新增 catalog 函数调用校验
  - `createA2uiPart()` 现在要求 data 必须为消息数组
  - 修正 web-core renderer→agent error schema、组件未知属性校验、空组件数组校验
  - `Catalog.fromJson()` 支持官方 v1.0 catalog `allOf` 结构
  - Angular 移除 Spacer 的 basic catalog 注册，并修复 Icon SVG / userMessage / accessibility / Markdown 渲染
