---
'@freezestudio/a2ui-web-core': patch
'@freezestudio/a2ui-angular': patch
---

修复 `unifiedOutbound` 模式丢弃 `sendError()` 直发错误的问题：`VALIDATION_FAILED` / `SURFACE_NOT_FOUND` 等由 message-handler 直发的错误现在经 outboundListener 上报，同时避免内部错误重复出站（新增 `SurfaceManager.forwardError`）。
