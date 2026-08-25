---
'@freezestudio/a2ui-web-core': minor
'@freezestudio/a2ui-angular': minor
'@freezestudio/a2ui-agent': patch
---

feat(a2ui): 落地 todo 清单三项 —— 渲染端组合约束错误码、angular testing 测试基座、agent 生成示例

- web-core (minor): 新增 `composition-constraints.ts`（catalog 约束注册表 +
  `checkCompositionConstraints`），message-handler 组件校验链路主动产生
  UNALLOWED_PARENT / UNALLOWED_CHILD 标准错误码（v1.0 #2155）；新增结构化
  `validateComponentsDetailed`
- angular (minor): 新增 `testing/` 二级入口（`createBoundProperty` /
  `setA2uiInputs`），对齐官方 renderers/angular/testing 布局
- agent (patch): system prompt 中旧消息名 callFunction/actionResponse 修正为
  v1.0 #2210 的 callRendererFunction/agentFunctionResponse
