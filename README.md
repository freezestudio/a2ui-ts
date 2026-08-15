# a2ui-ts

A2UI v1.0 协议的 TypeScript 参考实现（自 geo-scout 拆分独立演进）。本仓库为 pnpm monorepo，包含协议 SDK、框架无关渲染核心、Angular 渲染器、一致性测试与 LLM 评估。

A2UI（Agent-to-User Interface）是面向 LLM/Agent 的流式 UI 协议：Agent 通过 `createSurface` / `updateDataModel` 消息动态生成并增量更新用户界面，支持双向数据绑定与本地函数求值。官方协议见 <https://a2ui.org/>，官方多语言实现（python / angular / lit / react）见 <https://github.com/a2ui-project/a2ui>；官方核心实现当前以 v0.9.1 为主版本，**本项目为官方 v1.0 协议的先行实现**。

> [!IMPORTANT]
> **协议支持范围**：本项目严格对齐 **A2UI 规范 v1.0**。与官方渲染器为向后兼容保留 v0.8/v0.9 布局不同，本仓库（协议 SDK、渲染核心、Angular 渲染器、一致性测试）**仅支持 v1.0，不实现任何旧版协议**（v0.8 / v0.9 / v0.9.1）。

## 核心组件（Core Components）

协议核心逻辑、解析与 schema 操作分布在以下包中：

### 协议 SDK（`packages/sdk` — `@freezestudio/a2ui-sdk`）

- **Schema 管理（`src/schema`）**：`A2uiSchemaManager` 加载规范 schema、管理 catalogs 并生成面向 LLM 的系统提示词；`A2uiValidator` 按协议/消息/组件/数据/函数 5 层校验 A2UI 消息；配套 `composition-checker`、`integrity-checker`、`topology-analyzer` 检查组件组合与引用完整性；`agent-to-renderer` / `renderer-to-agent` 定义双向往来消息类型。
- **Parser（`src/parser`）**：`IncrementalStreamParser` 增量流式解析器，边生成边产出 `createSurface` / `updateDataModel` 消息，带 `json-healer` / `brace-state-machine` 自动修复与校验 LLM 输出。
- **Catalog（`src/catalog`）**：`A2uiCatalog` / `CatalogConfig` / `createFullCatalog` 处理组件库，`component-validator` 校验组件定义，支持自定义 catalog 扩展注册。
- **Basic Catalog（`src/basic-catalog`）**：官方基础组件与函数的声明（`components/` + `functions/`），供客户端与 LLM 提示词共用。
- **A2A（`src/a2a`）**：`extension.ts` / `parts.ts` 管理 A2UI extension URI、激活逻辑与 A2A Parts 构造。
- **State（`src/state`）**：`DataModel` / `ComponentModel` / `SurfaceModel` / `GenericBinder` / `DataContext` 等数据绑定与响应式状态模型。
- **Logger（`src/logger`）**：pino 结构化日志（`createLogger` / `createLLMSaveLogger`）。

### 渲染核心（`packages/web-core` — `@freezestudio/a2ui-web-core`）

框架无关的渲染核心，与 Angular 渲染器对称：

- **Message Processing（`src/processing`）**：`MessageHandler` 处理 `createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface` 消息；`DataBinding` 与 `FunctionCall` 执行双向绑定与本地函数求值。
- **State（`src/state`）**：`SurfaceManager` 管理活跃 surface 的生命周期。
- **Schema（`src/schema`）**：基础协议 schema 与 `registerComponentSchemas` 扩展注册机制。

### 共享工具（`packages/shared` — `@freezestudio/a2ui-shared`）

表达式解析与求值（`expression-parser` / `evaluate`）、路径解析（`path-utils`）、JSON 修复（`json-healer`）、类型工具与国际化（`locale-config`）。

### LLM 生成器（`packages/agent` — `@freezestudio/a2ui-agent`）

`DeepSeekGenerator` / `OllamaGenerator`：基于 schema 系统提示词驱动 LLM 生成 A2UI 消息（`schema-manager` 管理提示词，`generator.ts` 定义统一生成接口）。

### Angular 渲染器（`renderers/angular` — `@freezestudio/a2ui-angular`）

- **basic 组件（`src/basic`）**：官方 basic 组件（text / button / card / tabs / slider / audio-player / image / video / modal 等）的 Angular 实现。
- **renderer（`src/renderer`）**：`MessageHandler` / `SurfaceManager` / `DataContext` / `ComponentBinder` 等渲染适配层。
- **catalog（`src/catalog`）**：`CatalogComponent` / `LayoutContainer` 与 `CatalogRegistry` 组件注册。

### 一致性测试（`conformance` — `@freezestudio/a2ui-conformance`，PRIVATE）

v1.0 协议一致性核查套件（561 用例）：`harness` + `tests/`（schema-validation / sdk-behavior / v1-protocol / a2a-integration），以 `packages/sdk/resources/specification/v1_0/` 官方规范副本（只读）为基准。

### 评估与演示

- **eval（`eval` — `@freezestudio/a2ui-eval`，PRIVATE）**：LLM 生成质量评估框架（`evaluator` / `validator` / `cli` / `prompts`）。
- **samples/client/angular（`@freezestudio/a2ui-angular-demo`）**：消费 `@freezestudio/a2ui-angular` 的最小演示壳（`ng serve`）。

## TODO：与官方对齐

> 对齐基准：官方仓库 `~/github/ai-tools/a2ui` 的 `renderers/` 与 `samples/` 布局（官方多语言实现范本）。当前仅对齐了 Angular 渲染器与最小演示壳，以下为待办清单。

### renderers/（框架适配器）

- [ ] **补 `testing/` 测试基座**：官方 `renderers/angular/testing/`（index.ts / public-api.ts / test-utils.ts / ng-package.json）为渲染器测试提供共享工具，我方尚未建立
- [ ] **演示壳归属对齐**：官方将演示壳收在 `renderers/angular/a2ui_explorer/`（含 e2e + playwright 配置）；我方演示壳在 `samples/client/angular/`——评估是否按官方方式把 explorer 移入渲染器目录
- [ ] **多框架适配器占位**：官方 `renderers/` 含 angular / lit / react / flutter / markdown / web_core 多个适配器；我方仅 angular，后续扩展多框架参考实现时按官方子目录约定组织
- [ ] **版本兼容层**：官方 `renderers/angular/{v0_8,v0_9}/` 承载旧版协议兼容；我方仅支持 v1.0，**无需引入**（标注以免误对齐）
- [ ] **web-core 归属说明**：官方框架无关核心位于 `renderers/web_core/`；我方按 SDK 栈放在 `packages/web-core/`（v1.0）——属有意差异，不做目录对齐

### samples/（示例与开发工具）

- [ ] **补 `samples/README.md` 注册表**：官方 samples/README.md 维护表格（Sample / Agent / Renderer / e2e / Video），我方未建
- [ ] **agent 侧示例**：官方 `samples/agent/adk/` 为 agent 端示例；我方对应 `@freezestudio/a2ui-agent` 的用法示例（当前缺失）
- [ ] **client 壳按框架分目录**：官方 `samples/client/{angular,flutter,lit,react,shared}/`；我方仅 client/angular，后续框架加壳沿用此布局
- [ ] **community/**：官方社区示例目录，可选跟进，非必须

## 运行测试

```bash
pnpm install
pnpm -r test    # 全仓测试：1234 用例全绿（shared 53 / web-core 11 / sdk 513 / angular 96 / conformance 561）
```

按包：

```bash
pnpm --filter @freezestudio/a2ui-sdk test
pnpm --filter @freezestudio/a2ui-conformance test
pnpm --filter @freezestudio/a2ui-angular test
```

## 构建

```bash
pnpm -r build    # 全部构建（拓扑序，含 angular 库与 demo）
```

## 格式化与检查

```bash
pnpm check    # vp check：format + lint + type（根 vite.config.ts 配置）
```

## 发布（公网 npm）

```bash
pnpm -r publish --access public    # 发布全部非 private 包（scope @freezestudio/a2ui-*）
```

- 手工发布：先在对应包 `package.json` 更新版本号并提交，再执行 `pnpm publish --access public`
- CI 自动发布：打 tag 触发 `.github/workflows/publish.yml`：`git tag v1.2.0 && git push origin v1.2.0`
- conformance / eval / demo 为 private，不发布

## 免责声明

与官方 A2UI 实现一致：示例代码仅用于演示 A2UI 与 A2A 协议的机制。构建生产应用时，应将任何不受直接控制的 Agent 视为潜在不可信实体——来自外部 Agent 的所有数据（AgentCard、消息、artifact、任务状态）都应作为不可信输入处理；未经净化地拼入 LLM 提示词可能引入提示注入攻击。任何 UI 定义或数据流同样必须按不可信输入对待：恶意 Agent 可能伪造界面诱导用户（钓鱼）、通过属性值注入脚本（XSS）、或生成过度复杂的布局拖垮客户端（DoS）。开发者有责任实施输入净化、Content Security Policy（CSP）、可选嵌入内容的严格隔离与安全的凭据处理。

## 许可证

Apache-2.0（与官方 A2UI 实现一致）。
