# @freezestudio/a2ui-web-core

A2UI v1.0 **框架无关渲染核心**：消息处理（`processMessage`）、Surface 状态管理、数据绑定（JSON Pointer）、函数调用、zod schema 校验。

不依赖任何 UI 框架；框架适配（Angular 等）见 `@freezestudio/a2ui-angular`。

## 安装

```bash
npm install @freezestudio/a2ui-web-core
```

## 快速使用

```ts
import { A2uiMessageSchema, validateComponentByType } from '@freezestudio/a2ui-web-core';

// 校验 A2UI 消息信封（createSurface/updateComponents/updateDataModel/...）
const ok = A2uiMessageSchema.safeParse({ version: '1.0', createSurface: { surfaceId: 's1', components: [] } });
```

## 核心能力

- `A2uiMessageSchema` — v1.0 消息信封 schema（createSurface/updateComponents/updateDataModel/deleteSurface/...）
- `processMessage` / `processMessageSafe` / `SurfaceManager` — 消息处理、结构化错误恢复与 Surface 生命周期
- `RpcHandler` — `callAgentFunction` 生命周期（pending/timeout/cancel/dispose，迟到响应忽略）
- `mapErrorToRendererMessage` — 内部错误映射为 v1.0 renderer→agent error 信封（RFC 6901 path）
- `resolveDynamicValue` / `callFunction` — 动态值解析与本地函数执行
- `registerComponentSchemas` — 宿主应用扩展自定义 catalog 组件 schema
- `COMPONENT_SCHEMA_BY_TYPE` — basic catalog 组件属性校验

## 许可证

Apache-2.0
