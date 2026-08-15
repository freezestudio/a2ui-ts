# @freezestudio/a2ui-sdk

A2UI v1.0 TypeScript SDK：协议 schema、5 层校验器、流式 JSON 解析（增量渲染）、BasicCatalog 与自定义 catalog 加载。

## 安装

```bash
npm install @freezestudio/a2ui-sdk
```

## 能力

- **Schema 管理** — 官方规范副本（`specification/v1_0`，只读）的 JSON schema 加载与校验
- **流式解析** — `IncrementalStreamParser`：LLM 输出分块解析，边生成边产出 `createSurface`/`updateDataModel` 消息
- **5 层校验** — 协议/消息/组件/数据/函数分层校验
- **Catalog** — `BasicCatalog`/`createFullCatalog` + 自定义 catalog 扩展注册
- **Logger** — pino 结构化日志（`createLogger`/`createLLMSaveLogger`）

## 许可证

Apache-2.0
