# @freezestudio/a2ui-sdk

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
