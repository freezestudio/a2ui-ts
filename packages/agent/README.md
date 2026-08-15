# @freezestudio/a2ui-agent

A2UI LLM 客户端：基于 AI SDK 的 A2UI JSON 生成器（DeepSeek / Ollama），供 LLM 评估框架使用。

## 安装

```bash
npm install @freezestudio/a2ui-agent
```

## 说明

- `deepseek-generator` — DeepSeek 模型生成 A2UI 可视化 JSON（配合 `@freezestudio/a2ui-sdk` 的 schema/解析器）
- `ollama-generator` — 本地 Ollama 模型生成（评估/离线场景）
- `schema-manager` — 生成结果与协议 schema 对齐校验

## 许可证

Apache-2.0
