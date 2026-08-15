# a2ui-ts

A2UI v1.0 的 TypeScript 参考实现 —— 协议 SDK、框架无关渲染核心、Angular 渲染器、一致性测试与评估。

A2UI（Agent-to-User Interface）是面向 LLM/Agent 的流式 UI 协议：Agent 通过 `createSurface` / `updateDataModel` 消息动态生成并增量更新用户界面，支持双向数据绑定与本地函数求值。

> 状态：**WIP** —— 仓库骨架已就绪，代码迁移进行中（见 [docs/roadmap.md](docs/roadmap.md)）。

## 定位

- 官方协议：<https://a2ui.org/>（规范副本见 `specification/v1_0/`，只读）
- 官方多语言实现参考：<https://github.com/ai-tools/a2ui>（python / angular / lit / react）
- **本项目是官方 v1.0 协议的 TypeScript 先行实现**（官方核心实现当前以 v0.9.1 为主版本）

## 仓库结构（规划）

```
a2ui-ts/
├── specification/v1_0/     # 官方协议规范副本（只读，从官方仓库同步）
├── packages/
│   ├── shared/             # @a2ui/shared    通用工具（路径/JSON 修复/国际化）
│   ├── web-core/           # @a2ui/web-core  框架无关渲染核心（Zod schema、SurfaceManager、消息处理）
│   ├── sdk/                # @a2ui/sdk       协议 SDK（校验器、流式 JSON 解析、catalog）
│   └── agent/              # @a2ui/agent     LLM 生成器（DeepSeek / Ollama）
├── renderers/
│   └── angular/            # @a2ui/angular   Angular 渲染器（basic 组件 + catalog 注册 + explorer 演示）
├── conformance/            # 协议一致性测试（v1.0 核查）
├── eval/                   # LLM 评估框架
├── samples/client/angular/ # 最小可运行演示客户端
└── docs/                   # 文档与路线图
```

## 开发

- 包管理器：pnpm（`pnpm install`）
- 验证：根目录 `pnpm -r build` / `test` / `lint`（对齐官方标准脚本语义）
- Node.js >= 24，pnpm 11.x

## 许可证

Apache-2.0（与官方 A2UI 实现一致）。
