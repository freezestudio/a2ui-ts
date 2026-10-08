# @freezestudio/a2ui-agent

## 1.1.6

### Patch Changes

- 97dc87a: 对齐上游 a2ui v1.0 保留协议键 `@` 前缀迁移（上游 #2692 / #2891，commit `ae0a5253`）：

  - **破坏性**：A2UI v1.0 数据绑定改为 `{ "@path": "..." }`，函数调用改为 `{ "@call": "...", "args": {...} }`（含 `@index`）。
    普通 `path` / `call` 键在 v1.0 动态对象中不再被拦截，视为字面量。
  - 动态对象中任何未转义的单 `@` 键（`^@([^@]|$)`）一律拒绝；字面量 `@` 键需 `@@` 前缀加倍转义（求值时去转义）。
  - `ChildList` 模板指针 `{ componentId, path }` 与 `updateDataModel.path` 保持不加前缀。
  - `component-validator` 新增 `propertyNames` 支持，运行时拒绝未识别的保留键。
  - 安全：移植上游 ReDoS 加固（#2366），`regex` 校验使用 `redos-detector` 拒绝灾难性回溯模式并限制输入长度。
  - 健壮性：表达式解析器支持非 ASCII 数据模型键（#2527）。
  - 流式解析：v1.0 未闭合组件一律缓冲至其对象闭合后再下发，避免 `catalogId` 晚到时按 surface catalog 误校验（#3026）。
  - 多 catalog：补充 `catalogId` 覆盖场景下函数参数按实际运行的 catalog 校验的覆盖（#2715）。

  同步官方规范副本至上游 HEAD `db430653`。

- Updated dependencies [97dc87a]
  - @freezestudio/a2ui-sdk@4.0.0

## 1.1.5

### Patch Changes

- b74efd1: feat(a2ui): 落地 todo 清单三项 —— 渲染端组合约束错误码、angular testing 测试基座、agent 生成示例

  - web-core (minor): 新增 `composition-constraints.ts`（catalog 约束注册表 +
    `checkCompositionConstraints`），message-handler 组件校验链路主动产生
    UNALLOWED_PARENT / UNALLOWED_CHILD 标准错误码（v1.0 #2155）；新增结构化
    `validateComponentsDetailed`
  - angular (minor): 新增 `testing/` 二级入口（`createBoundProperty` /
    `setA2uiInputs`），对齐官方 renderers/angular/testing 布局
  - agent (patch): system prompt 中旧消息名 callFunction/actionResponse 修正为
    v1.0 #2210 的 callRendererFunction/agentFunctionResponse

- Updated dependencies [2c8b978]
- Updated dependencies [6e13c03]
- Updated dependencies [14831b5]
  - @freezestudio/a2ui-sdk@3.1.0

## 1.1.4

### Patch Changes

- Updated dependencies [2b34c44]
  - @freezestudio/a2ui-sdk@3.0.0

## 1.1.3

### Patch Changes

- Updated dependencies [a1291c0]
  - @freezestudio/a2ui-sdk@2.0.0
