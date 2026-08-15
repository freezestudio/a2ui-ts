# 更新记录（CHANGELOG）

本文件记录 a2ui-ts 仓库的重要变更（含未提交的工作区变更）。格式：

```markdown
## [YYYY-MM-DD] 标题

- 变更点（尽可能注明对应的官方规范 PR / commit）
```

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
