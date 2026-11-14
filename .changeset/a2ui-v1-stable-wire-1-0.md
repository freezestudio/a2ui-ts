---
'@freezestudio/a2ui-sdk': major
'@freezestudio/a2ui-web-core': major
'@freezestudio/a2ui-angular': major
'@freezestudio/a2ui-shared': minor
'@freezestudio/a2ui-agent': minor
---

对齐上游 A2UI v1.0 稳定版（`db430653` → `3ed960186`）：

- wire 版本号统一为 `1.0`（不再接受 `v1.0`）
- 组件信封键改为 `@catalogId` / `@accessibility` / `@metadata` / `@checks`
- `TextField.value` 必填；`callRendererFunction` 支持可选 `surfaceId`
- Catalog 支持叶子 `$defs` 与 `#/$defs/<Type>` 引用，禁止 `$defs` 内定义组件
- `DynamicBoolean` / `CheckRule` 强制转换规则
- 新增 A2UI 正则方言解析器与静态安全规则（`@freezestudio/a2ui-shared`）
