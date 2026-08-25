# @freezestudio/a2ui-agent-generator-demo

A2UI agent 侧示例 — 用 [`@freezestudio/a2ui-agent`](../../../packages/agent) 的 LLM 生成器执行
协议文档所述的 **prompt → generate → validate** 循环：

1. `Generator`（DeepSeek / Ollama）注入 v1.0 schema 的 system prompt 调用 LLM
2. 从 `<a2ui-json>` 标签提取消息数组
3. 用 [`@freezestudio/a2ui-sdk`](../../../packages/sdk) 的 `A2uiMessageSchema` 逐条校验
4. 校验失败信息可直接回喂 LLM 实现自纠闭环

## 运行

```bash
pnpm install   # workspace 链接 agent/sdk 包（需先构建：pnpm -r build）

# 本地 Ollama（默认，需 ollama serve 并拉取模型）
pnpm --filter @freezestudio/a2ui-agent-generator-demo start

# 或使用 DeepSeek
DEEPSEEK_API_KEY=sk-xxx pnpm --filter @freezestudio/a2ui-agent-generator-demo start
```

> 对齐官方仓库 `samples/agent/adk/` 的定位：agent 端接入示例。
> demo 为 PRIVATE 包，不发布 npm。
