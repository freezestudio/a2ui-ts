# @freezestudio/a2ui-angular

## 0.2.0

### Minor Changes

- a1291c0: 严格对齐 A2UI v1.0 协议：

  - 移除 `createSurface.surfaceProperties`（v1.0 已删除）
  - 移除 basic catalog 非规范兜底，严格按组件级/函数级 `catalogId` 解析
  - 函数名改为严格大小写匹配，并新增 catalog 函数调用校验
  - `createA2uiPart()` 现在要求 data 必须为消息数组
  - 修正 web-core renderer→agent error schema、组件未知属性校验、空组件数组校验
  - `Catalog.fromJson()` 支持官方 v1.0 catalog `allOf` 结构
  - Angular 移除 Spacer 的 basic catalog 注册，并修复 Icon SVG / userMessage / accessibility / Markdown 渲染

### Patch Changes

- Updated dependencies [a1291c0]
  - @freezestudio/a2ui-web-core@2.0.0
