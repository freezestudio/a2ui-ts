---
'@freezestudio/a2ui-web-core': minor
'@freezestudio/a2ui-angular': minor
---

对齐上游 #3856 / #3579 / #4078：

- 新增结构化错误映射 `mapErrorToRendererMessage` / `extractEnvelopeErrorContext` / `normalizeJsonPointer`
- 新增 `RpcHandler`：`callAgentFunction` pending 关联、timeout/cancel/dispose、迟到响应忽略、`TOO_MANY_PENDING`
- `SurfaceManager` 新增 `onError` 错误订阅、deleteSurface 取消 pending 调用、`dispose`
- 新增 `processMessageSafe` / `processMessagesWithErrors`（错误不会中断消息批处理）
- 统一出站 `unifiedOutbound`：action / error / callAgentFunction / rendererFunctionResponse 共用一个 outboundListener（#4078）
- Angular 渲染器接入 RPC 生命周期，Action 求值失败发出 `EXPRESSION_ERROR` / `EXECUTION_ERROR`
