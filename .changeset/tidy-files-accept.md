---
'@freezestudio/a2ui-sdk': major
'@freezestudio/a2ui-web-core': major
'@freezestudio/a2ui-angular': minor
---

对齐官方 a2ui v1.0 协议：`callableFrom` → `allowedCallers` 改名 + `requiresUserActivation` 收紧

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
