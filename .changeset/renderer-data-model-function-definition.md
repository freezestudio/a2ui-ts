---
'@freezestudio/a2ui-sdk': minor
'@freezestudio/a2ui-web-core': patch
'@freezestudio/a2ui-angular': patch
---

feat(a2ui): 对齐官方 v1.0 协议 schema —— 新增 RendererDataModel（renderer_data_model.json）、强化 FunctionDefinition 校验（returnType/allowedCallers/requiresUserActivation 约束）

- sdk: 新增 `RendererDataModelSchema`/`isRendererDataModel`（对应官方 renderer_data_model.json）；`FunctionDefinitionSchema` 补 returnType 8 枚举、allowedCallers 3 枚举、requiresUserActivation（true 时强制 rendererOnly）
- web-core/angular: `getSendDataModelPayload()` 返回类型细化为 `RendererDataModel`（非破坏）
- conformance: 新增官方 basic catalog examples（43 个）SDK zod 一致性测试
