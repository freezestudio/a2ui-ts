# 更新记录（CHANGELOG）

本文件记录 a2ui-ts 仓库的重要变更（含未提交的工作区变更）。格式：

```markdown
## [YYYY-MM-DD] 标题

- 变更点（尽可能注明对应的官方规范 PR / commit）
```

---

## [2026-08-16] npm 发布（Changesets 首轮）

发布并推送包级 tag：

| 包                          | 版本  | tag                               |
| --------------------------- | ----- | --------------------------------- |
| @freezestudio/a2ui-sdk      | 2.0.0 | @freezestudio/a2ui-sdk@2.0.0      |
| @freezestudio/a2ui-web-core | 2.0.0 | @freezestudio/a2ui-web-core@2.0.0 |
| @freezestudio/a2ui-angular  | 0.2.0 | @freezestudio/a2ui-angular@0.2.0  |
| @freezestudio/a2ui-agent    | 1.1.3 | @freezestudio/a2ui-agent@1.1.3    |

- `@freezestudio/a2ui-shared` 未变更，npm 保持 1.1.1，不重复发布。

---

## [2026-08-16] 接入 Changesets 发布自动化

- 新增 `@changesets/cli` 与 `.changeset/config.json`
- 新增 `.github/workflows/release.yml`：合并 main 后自动创建 Version Packages PR，合并后按包发布并创建包级 tag
- `ci.yml` 增加 `pnpm release:check` 门禁：PR 中变更的 public 包必须附带 changeset
- `publish.yml` 改为 `workflow_dispatch` 单包人工补发 fallback，移除 `pnpm -r publish` 全量发布
- 根 `package.json` 增加 `changeset` / `release:check` / `release:version` / `release:publish` 快捷命令
- 为本次 v1.0 破坏性修复登记 changeset：sdk/web-core major，angular minor

---

## [2026-08-16] v1.0 协议深度审查修复

> 依据 `packages/sdk/resources/specification/v1_0` 官方协议副本逐项审查并修复。
> 全仓测试 **1263 用例全绿**（shared 53 / web-core 11 / sdk 536 / angular 95 / conformance 568），
> `pnpm check` 与 `pnpm -r build` 通过。

### 协议信封与 Schema 严格化

- 移除 `createSurface.surfaceProperties`（SDK / web-core），对齐官方 v1.0 schema（官方上游 #2126 已移除）
- 修正 web-core renderer→agent error schema：
  - `VALIDATION_FAILED / UNALLOWED_PARENT / UNALLOWED_CHILD` 三保留码
  - 通用错误 `surfaceId` 与 `functionCallId` 互斥
- web-core 组件 schema 严格化：`ComponentBase.strict()`、`components.min(1)`、`DynamicValue` object 分支、`Metadata.extensions` UAX #31 校验
- `ActionEvent` 移除越界 `metadata`；action 消息 `timestamp` 增加 ISO 8601 校验
- SDK message list wrapper 改为 strict

### Catalog 与函数调用

- `Catalog.fromJson()` 支持官方 v1.0 catalog 的 `allOf` 结构，正确解析 Checkable 组件与函数 `args`
- 读取函数元数据 `returnType / callableFrom / requiresUserActivation`；`callableFrom` 缺省 `rendererOnly`
- 新增 `Catalog.validateFunctionCall()`，并在 `validateComponentsWithCatalogs()` 中递归校验组件内嵌 FunctionCall
- 函数名恢复严格大小写匹配；新增 catalog UAX #31 名称与 `$defs` 白名单校验
- SDK `formatString` 修复：从 `FunctionContext.dataModel` 解析 `${/path}`

### 渲染器运行时

- 移除 web-core / Angular 的 basic catalog 兜底与 `resolveCatalog` 前缀匹配，严格按组件级 → surface 默认解析
- `findRootComponent()` 移除“第一个带 children 的 Column”启发式回退
- Surface 生命周期错误通过 `sendError` 回传；无效组件消息不再写入状态
- `callRendererFunction` 保留并校验 `catalogId`；新增 `registerRendererFunction()` 支持宿主 catalog 函数
- 官方 basic catalog（18 组件 + 14 函数）与项目扩展 catalog（18 组件 + 26 函数）分离
- 未知 renderer 函数改为抛 `UNKNOWN_FUNCTION`，不再返回占位字符串
- Angular：修复 Icon 自定义 SVG、`userMessage` DynamicString 解析、ChoicePicker FunctionCall value
- Angular：CheckBox / Slider / TextField / ChoicePicker 补齐 accessibility 映射；Text 增加安全 Markdown 子集渲染
- Angular：移除 Spacer 的 basic catalog 注册；`sendDataModel` 随 action / callAgentFunction transport metadata 传出
- Angular：移除 v1.0 已废弃的 `responsePath` 自动写回

### 校验器与增量解析

- 修复 `Image.description / AudioPlayer.description` 被误判为组件引用
- 修复 `Tabs.tabs[].child` 引用漏检
- `validateMessageList()` 支持 root 跨消息渐进到达
- 修复 `IncrementalStreamParser.updateDataModel` delta 损坏问题，并支持多 delta 输出

### A2A / Capabilities

- `createA2uiPart()` 强制 data 为消息数组；`partToA2uiMessages()` 对非数组返回 null
- `InlineCatalogSchema` 对齐官方 `catalog_definition.json`（functions 为对象映射，支持 `$defs` 等顶层键）

### Prompt / Eval / Conformance

- SchemaManager：允许模板相对路径；修正 minimal catalog / `variant: "h2"` / rendererOnly 函数示例；prompt 包含官方 basic catalog schema
- eval prompts：移除非法 `h2`、修正 `callRendererFunction` 示例与模板路径说明
- conformance 默认直接加载 `packages/sdk/resources/specification/v1_0` 官方只读副本，不再使用本地改写 schema

---

## [2026-08-15] 与官方 a2ui 对齐修复（v1.0 协议，工作区未提交）

> 对齐基准：官方仓库 `~/github/ai-tools/a2ui` HEAD `44a420b6`（spec HEAD `d59fb340` #2229）。
> 全仓测试 **1266 用例全绿**（shared 53 / web-core 11 / sdk 538 / angular 96 / conformance 568），`pnpm check` 通过。

### SDK 信封级协议修复（`packages/sdk/src/schema/`）

- `common-types.ts`：
  - `MetadataSchema` 严格化 —— 拒绝 `metadata` 未知属性（对齐规范 `additionalProperties: false`）
  - `FunctionCallSchema` 严格化（`strictObject`，对齐 `unevaluatedProperties: false`）+ `@index` 系统函数规则（禁 `catalogId`、args 仅允许 `offset`，对齐 `IndexSystemFunction`）
- `agent-to-renderer.ts`：
  - `ComponentPayloadSchema` 升级为完整组件信封：`id` 必填（`ComponentCommon`）、`component` 拒绝协议保留名 `"Surface"`（`component.not.const: "Surface"`）、`accessibility` / `metadata` 校验
  - `ComponentsListSchema` 随之收紧（数组元素逐个信封校验）
- `renderer-to-agent.ts`：
  - `ValidationFailedErrorSchema.code` 枚举补 `UNALLOWED_PARENT` / `UNALLOWED_CHILD`（上游 #2155）
  - `GenericErrorSchema` 排除全部三个保留校验码
- `catalog/component-validator.ts`：`validateComponentProps` 增加未知属性拒绝（组件信封 `unevaluatedProperties: false` 语义）
- `basic-catalog/components/button.ts`：移除 v0.9 残留的 `wantResponse` / `responsePath`，补 `userMessage`（#2228）

### 多目录解析（上游 #2079 mixable catalogs）

- `schema/validator.ts` 新增：
  - `resolveComponentCatalog` —— 解析顺序：①组件级 `catalogId` → ②surface 默认 `catalogId` → ③两者皆缺报错（不回退 capabilities）
  - `A2uiValidator.validateComponentsWithCatalogs` —— 多 catalog 属性校验 + 按解析 catalog 提供组合约束
- SDK 入口 `index.ts` 导出 `resolveComponentCatalog`

### 一致性测试（`conformance/`）

- `tests/schema-validation/protocol-schema.test.ts`：
  - 信封级差异从 **warning 升级为硬断言**（53 → 47 处，剩余全部为目录上下文差异，维护在 `CATALOG_CONTEXT_CASES` 允许清单并逐条注释）
  - 新增 2 个 catalog-aware 数据驱动测试：official `initial_state_validation.json` 非法用例全拒 / 合法用例全过
- 新增 accessibility 一致性套件（对齐上游 `conformance/core/accessibility.yaml`）：
  - `test-data/sdk-behavior/accessibility/accessibility.yaml`（4 用例：attributes plumbing / live region assertive / hidden subtree / implicit label inference）
  - `tests/schema-validation/accessibility.test.ts`（无障碍树构建：schema 校验、hidden 子树递归传播、Button title 隐式标签推断）
- `test-data/a2a-integration/extension/extension.yaml` + `tests/a2a-integration/a2a-conformance.test.ts`：补 `test_get_extension_with_inline`（`accepts_inline_catalogs` 参数）

### 文档

- `docs/checklists/checklist-a2ui-v1.0.checked.md`：
  - 修正 25.38 节组合约束状态（SDK `composition-checker` 已实现，此前标注为"待办"过时）
  - 7.9 错误码枚举状态更新；25.33-25.37 mixable catalog 标注 SDK 实现
  - 头部补充对齐修复摘要与测试数（SDK 538 / conformance 568）
- `README.md` / `AGENTS.md`：测试数更新（sdk 513→538、conformance 561→568、总数 1234→1266）

---

## [2026-08-15] Phase 2：发布与 CI（已提交）

- 包名 `@a2ui-ts/*` → `@freezestudio/a2ui-*`，发布到公网 npm（shared/web-core/sdk/agent 1.1.1，angular 0.1.2）
- npm 发布 CI（`.github/workflows/publish.yml`，v* tag 自动发布，bypass-2FA token）
- `AGENTS.md` 新增（工具链 / 验证命令 / 发布流程 / 规范副本同步）
- `docs/protocol-versioning.md` 协议版本化策略（对齐官方 authority rule）
- geo-scout 迁移的 v1.0 协议核查表入库（`docs/checklists/`）
- conformance 测试超时 5s → 30s（CI runner 较慢）
- README 重写（官方 SDK 结构对齐 + 仅支持 v1.0 声明 + renderers/samples 对齐 TODO）

## [2026-08-15] Phase 1：包名迁移与 Angular 渲染器（已提交）

- 包名 `@a2ui/*` → `@a2ui-ts/*`（发布前改名）
- `renderers/angular`（`@a2ui/angular` → `@freezestudio/a2ui-angular`）Angular 渲染器库，随迁 96 个单测
- `samples/client/angular` 演示壳（验证 npm 包可消费性）
- GitHub Actions 流水线（build / test / lint + 全仓测试）
