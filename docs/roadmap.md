# A2UI 独立演进项目 · 实施计划（已审核通过）

> 状态：**已审核通过 · Phase 0 完成（2026-08-15）**
> 目标：把 geo-scout 中的 A2UI 实现（协议核心 + 渲染 + 治理资产）拆分为独立演进的项目，geo-scout 收缩为行业应用消费方
> 依据：官方 a2ui 仓库 `~/github/ai-tools/a2ui`（组织范本）、`docs/references.md`、`AGENTS.md` 规范同步流程

## 进度

- **Phase 0（geo-scout 内解耦）✅ 已完成** —— 见 geo-scout docs/a2ui-split-plan.md
- **Phase 1（仓库拆分）✅ 已完成**：
  - ✅ 6 个核心包迁入并改名 @freezestudio/a2ui-*；@freezestudio/a2ui-angular 渲染器库（ng-packagr）
  - ✅ 构建全过；测试 1138 全过（shared 53 / web-core 11 / sdk 513 / conformance 561）；vp check 全绿
  - ✅ 已发布公网 npm（@freezestudio/a2ui-shared|web-core|sdk|agent@1.1.1、@freezestudio/a2ui-angular@0.1.2）；
    geo-scout 已切换为版本依赖消费
- **Phase 2（独立演进治理）起步 ✅**：
  - ✅ GitHub Actions CI（.github/workflows/ci.yml：build/test/check）
  - ✅ @freezestudio/a2ui-angular 单元测试接线（96 测试恢复，全仓 1234 测试全绿）
  - ✅ samples/client/angular 演示壳（ng serve/build 验证 @freezestudio/a2ui-angular 可消费）
  - ✅ 公网 npm 发布（@freezestudio/a2ui-*，README + publish CI）
  - ✅ 协议版本化策略（docs/protocol-versioning.md）、AGENTS.md 治理文档
  - ⏳ 后续：SDD 蓝图（可选）、geo-scout 侧跟随协议演进

| 任务                          | 提交                                                        | 说明                                                                         |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P0-1 web-core geo schema 外移 | `refactor(a2ui): web-core 移出 geo 组件 schema...`          | 新增 `registerComponentSchemas` 扩展注册机制 + `geo-schemas.ts` + 5 用例测试 |
| P0-2 geo-catalog 外移         | `refactor(a2ui): geo-catalog 资源与加载器外移...`           | 新包 `@geo/geo-catalog`（资源+加载器+GEO_CATALOG_ID），sdk/a2ui-shared 净化  |
| P0-3 @geo/shared 反转依赖     | `refactor(a2ui): @geo/shared 移除 a2ui-shared re-export...` | 删除 3 个 re-export 壳，调用方改直连 `@geo/a2ui-shared`                      |
| P0-4 命名与引用点梳理         | `docs/a2ui-phase1-migration-map.md`                         | 包名映射 + 33 个引用文件清单 + 批量替换规则                                  |
| P0-5 全量验证                 | 本阶段                                                      | server 150 / web 240 / sdk / shared / vp check 全绿 + 联调冒烟通过           |

验证基线：server 150 测试、web 240 测试、sdk/shared/web-core 全绿、vp check 全绿、联调冒烟（dashboard 全 geo 组件 / chat 端到端 / 遥测 mock-stream）通过。

---

## 0. 背景与目标

### 0.1 现状

- geo-scout 内 A2UI 相关代码约 **35K LOC**，分布在：6 个 `@geo/a2ui-*` 包（~28K）、web 渲染适配层（~6K）、server 协议工具（~1.3K）
- **官方仓库是现成范本**：yarn workspace 单仓、`renderers/{web_core,angular,...}`、`agent_sdks/python`、`specification/{v0_8..v1_0}/test+eval`、`samples/`、`tools/`、`conformance/`，命名 `@freezestudio/a2ui-*`
- **geo-scout 是官方 v1.0 的先行 TS 实现**：官方 web_core 仅实现到 v0_8/v0_9，v1.0 为候选；geo-scout 的 conformance 已全量通过 v1.0 核查
- 官方 `specification/v1_0` 与 geo-scout 副本**完全同步**（diff 仅 .DS_Store）
- **铺垫已完成大半**：`@geo/a2ui-shared` 已从 `@geo/shared` 下沉通用工具（object-utils/json-healer/path-utils），注释明示"使 A2UI 协议 SDK 可独立复用"

### 0.2 目标架构（三层）

```
官方规范（external, a2ui.org / ~/github/ai-tools/a2ui）
   │  specification/v1_0 同步
   ▼
a2ui 独立项目（本计划产出, @freezestudio/a2ui-* scope）
   │  npm/git 依赖
   ▼
geo-scout（收缩为行业应用：geo-catalog + 引擎接线 + data-source + 应用壳）
```

---

## 1. 现状基线（盘点结果）

### 1.1 待拆资产清单

| 资产             | 位置                                                                                | 规模     | 独立性                           | 去向                            |
| ---------------- | ----------------------------------------------------------------------------------- | -------- | -------------------------------- | ------------------------------- |
| a2ui-shared      | `packages/a2ui/shared`                                                              | 1.3K 行  | ✅ 零依赖，已下沉工具            | → `@freezestudio/a2ui-shared`   |
| a2ui-web-core    | `packages/a2ui/web-core`                                                            | 2.1K 行  | ⚠️ 含 geo schema（见 4.1）       | → `@freezestudio/a2ui-web-core` |
| a2ui-sdk         | `packages/a2ui/sdk`                                                                 | 20.6K 行 | ⚠️ 含 geo-catalog 资源           | → `@freezestudio/a2ui-sdk`      |
| a2ui-agent       | `packages/a2ui/agent`                                                               | 268 行   | ✅ LLM 生成器（DeepSeek/Ollama） | → `@freezestudio/a2ui-agent`    |
| conformance-test | `packages/a2ui/conformance-test`                                                    | 1.8K 行  | ✅ v1.0 核查套件                 | → `conformance/`                |
| eval-test        | `packages/a2ui/eval-test`                                                           | 1.9K 行  | ✅ LLM 评估框架                  | → `eval/`                       |
| web 渲染适配层   | `apps/web/src/app/a2ui/`（renderer/basic/catalog 等 43 个非 geo 文件）              | ~3.5K 行 | ✅ 仅依赖 web-core + Angular     | → `renderers/angular/src`       |
| **geo 组件**     | `apps/web/src/app/a2ui/geo/`（28 个文件）                                           | ~2.5K 行 | ✅ 自包含但属行业扩展            | ⚠️ **决策点 D1**                |
| server 协议工具  | `apps/server/src/tools/{a2ui-parser,a2ui-extract}.ts`、`action-handler.ts` 协议部分 | ~0.5K 行 | ⚠️ 依赖 @geo/shared 少量工具     | ⚠️ **决策点 D8**                |
| 官方规范副本     | `packages/a2ui/sdk/resources/specification/v1_0/`                                   | —        | 只读                             | → `specification/v1_0/`         |
| **geo-catalog**  | `packages/a2ui/sdk/resources/geo-catalog/`                                          | —        | 自定义                           | **留在 geo-scout**              |

### 1.2 已确认的耦合点（Phase 0 必须处理）

1. **web-core 混入 geo schema**：`TimelineNode/RainfallItem/TiltItem/DisplacementItem/AccelerationItem/TiltNetworkSensor` 6 个 ItemSchema + `RiskPanel/MultiSensorChart/PredictionTimeline/Chart/StatsSummary/RainfallChart/TiltRoseDiagram/TiltNetworkMonitor` 8 个 ComponentSchema；`COMPONENT_SCHEMA_BY_TYPE` 含 geo 条目
2. **sdk 混入 geo-catalog**：`resources/geo-catalog/` + `src/catalog/geo-catalog.ts` 的 `loadGeoCatalog()`
3. **@geo/shared 反向依赖**：`@geo/shared` re-export a2ui-shared 工具保持公共 API（拆分后需改）
4. **命名空间**：全部 `@geo/a2ui-*` + `workspace:*`（改名波及所有 import）

### 1.3 已排除的耦合（无需处理）

- a2ui 核心包 **零依赖** `@geo/data-source` / `@geo/shared`（下沉已完成）
- geo 组件已自包含（无宿主应用/数据源导入）
- `programmatic-engine` 属应用层（深度耦合 data-source）——**不进 a2ui 项目**，无需解耦

---

## 2. 总体路线（3 阶段）

| 阶段        | 内容                         | 产出                                  | 验收                       |
| ----------- | ---------------------------- | ------------------------------------- | -------------------------- |
| **Phase 0** | 就地解耦重构（geo-scout 内） | web-core/sdk 边界干净、命名就绪       | 全量测试绿 + vp check 绿   |
| **Phase 1** | 仓库拆分                     | 独立 a2ui 仓库 + geo-scout 改外部依赖 | 两仓独立构建/测试/联调通过 |
| **Phase 2** | 独立演进（治理）             | 版本/发布/CI/规范同步机制             | conformance 持续绿         |

---

## 3. Phase 0：就地解耦重构（~1 周）

> 原则：所有改动在 geo-scout 内完成，每步保持测试全绿；**不产生行为变化**，纯结构迁移。

### 3.1 任务清单

| #    | 任务                         | 文件                                                                                                                            | 说明                                                                                                                                                                                              |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **web-core geo schema 外移** | `packages/a2ui/web-core/src/schema/schemas.ts` → 新 `apps/web/src/app/a2ui/geo/geo-schemas.ts`                                  | 移出 6 ItemSchema + 8 ComponentSchema + `COMPONENT_SCHEMA_BY_TYPE` 的 geo 条目；web-core 保留 basic 协议 schema；`renderer/schemas.ts`、`geo-catalog.ts`、`prediction-timeline.ts` 等改引用新位置 |
| P0-2 | **sdk geo-catalog 外移**     | `sdk/resources/geo-catalog/` + `src/catalog/geo-catalog.ts` → `apps/server/src/catalog/geo-catalog.ts`（或 `packages/geo/...`） | `loadGeoCatalog()` 移到 geo 侧；sdk 只留官方规范副本 + basic catalog                                                                                                                              |
| P0-3 | **@geo/shared 反转依赖**     | `packages/shared/src/...`                                                                                                       | 移除对 a2ui-shared 的 re-export，改为由 a2ui 项目反向提供（见 Phase 1 依赖调整）；确认无 geo-scout 代码依赖被破坏                                                                                 |
| P0-4 | **命名就绪**                 | 全局                                                                                                                            | 梳理所有 `@geo/a2ui-*` 引用点清单（供 Phase 1 批量替换），产出迁移映射表                                                                                                                          |
| P0-5 | **验证**                     | —                                                                                                                               | `vp check` + 全量 test（server/web/sdk/conformance）+ 联调冒烟（dashboard/chat/WS）                                                                                                               |

### 3.2 Phase 0 验收标准

- [ ] web-core 源码零 geo 关键词（grep `Timeline|RiskPanel|Tilt|Rainfall|Displacement|Acceleration|Gauge` 无命中）
- [ ] sdk 源码零 geo-catalog 引用
- [ ] 全部测试通过（server 150 / web 240+ / sdk / conformance）
- [ ] 联调功能无回归（dashboard 首帧、timeline、chat 全链路、导出）

---

## 4. Phase 1：仓库拆分（~3-4 天）

### 4.1 新建 a2ui 仓库（建议 pnpm monorepo，延续团队工具链；决策点 D3）

```
a2ui/
├── package.json                 # workspaces: packages/*, renderers/*, ...
├── specification/
│   └── v1_0/                    # 官方规范副本（从 sdk/resources/specification 迁入，只读）
├── packages/
│   ├── shared/                  # @freezestudio/a2ui-shared   （← geo-scout packages/a2ui/shared）
│   ├── web-core/                # @freezestudio/a2ui-web-core （← 同上，已 P0-1 净化）
│   ├── sdk/                     # @freezestudio/a2ui-sdk      （← 同上，已 P0-2 净化）
│   └── agent/                   # @freezestudio/a2ui-agent    （← 同上）
├── renderers/
│   └── angular/                 # @freezestudio/a2ui-angular  （← web a2ui 非 geo 部分）
│       ├── src/                 #   库代码（renderer 适配 + basic 组件 + catalog 注册）
│       ├── testing/             #   测试基座（echarts mock 等 geo 无关部分）
│       └── explorer/            #   演示壳（决策点 D7）
├── conformance/                 # @freezestudio/a2ui-conformance（← conformance-test）
├── eval/                        # @freezestudio/a2ui-eval     （← eval-test）
├── samples/
│   └── client/angular/          # 消费 @freezestudio/a2ui-angular 的最小演示（决策点 D7）
├── tools/                       # 占位（对齐官方 editor/composer/inspector，可选）
├── docs/                        # 迁移 developing-custom-a2ui-components.md、checklist 等
└── CHANGELOG.md                 # 独立版本基线（对齐官方 0.10.x 风格）
```

### 4.2 迁移映射（文件级）

| 来源（geo-scout）                                                                                                                                                                       | 目标（a2ui）                                    | 依赖改动                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/a2ui/shared/src/**`                                                                                                                                                           | `packages/shared/src/**`                        | `@geo/a2ui-shared` → `@freezestudio/a2ui-shared`                         |
| `packages/a2ui/web-core/src/**`（净化后）                                                                                                                                               | `packages/web-core/src/**`                      | 同上；`@preact/signals-core` 保留                                        |
| `packages/a2ui/sdk/src/**`（净化后）+ `resources/specification/v1_0/**`                                                                                                                 | `packages/sdk/src/**` + `specification/v1_0/**` | `pino`/`zod` 保留                                                        |
| `packages/a2ui/agent/src/**`                                                                                                                                                            | `packages/agent/src/**`                         | `@ai-sdk/deepseek`/`ai`/`ai-sdk-ollama` 保留                             |
| `packages/a2ui/conformance-test/src/**`                                                                                                                                                 | `conformance/src/**`                            | 引用 `@freezestudio/a2ui-sdk`                                            |
| `packages/a2ui/eval-test/src/**`                                                                                                                                                        | `eval/src/**`                                   | 引用 `@freezestudio/a2ui-agent`/`@freezestudio/a2ui-sdk`                 |
| `apps/web/src/app/a2ui/renderer/**`（非 geo）                                                                                                                                           | `renderers/angular/src/renderer/**`             | `@geo/a2ui-web-core` → `@freezestudio/a2ui-web-core`                     |
| `apps/web/src/app/a2ui/basic/**`                                                                                                                                                        | `renderers/angular/src/basic/**`                | 同上                                                                     |
| `apps/web/src/app/a2ui/catalog/**`、`component.ts`、`surface.ts`、`spacer.ts`、`fallback.ts`、`component-type-map.ts`、`catalog-registry.ts`、`export-mode.ts`、`dynamic-binding.ts` 等 | `renderers/angular/src/**`                      | 同上 + Angular 库打包（ng-packagr/`ng-package.json`）                    |
| 相关 spec 文件（`*.spec.ts` 非 geo）                                                                                                                                                    | 对应目标目录                                    | 随迁                                                                     |
| **geo 组件** `apps/web/src/app/a2ui/geo/**`                                                                                                                                             | **留在 geo-scout**（决策点 D1）                 | 引用 `@freezestudio/a2ui-web-core`/`@freezestudio/a2ui-angular` 外部依赖 |

### 4.3 geo-scout 侧改动

| 文件                                              | 改动                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `package.json`/`pnpm-workspace.yaml`              | 删除 a2ui 6 包；新增 `@freezestudio/a2ui-*` 外部依赖（registry 或 git）                |
| `apps/web/src/app/a2ui/geo/**` + `geo-catalog.ts` | 保留；import 改外部包；geo schema 就地管理（P0-1 产物）                                |
| `apps/server/**`                                  | 引擎/工具保留；`@geo/a2ui-sdk` → `@freezestudio/a2ui-sdk`                              |
| `@geo/shared`                                     | 移除对 a2ui-shared 的 re-export（P0-3）；如 geo-scout 仍需部分工具，内聚回 @geo/shared |
| `scripts/dev-tmux.sh`、AGENTS.md、README.md       | 更新依赖图与验证命令                                                                   |

### 4.4 Phase 1 验收标准

- [ ] a2ui 仓库独立 `build`/`test`/`lint` 全绿（含 conformance/eval）
- [ ] geo-scout 全量测试绿 + 联调无回归（dashboard/chat/WS/导出/遥测）
- [ ] 双仓并行开发互不阻塞（改动 a2ui 不影响 geo-scout 构建，反之亦然）

---

## 5. Phase 2：独立演进（治理模型，持续）

| 机制               | 内容                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **协议版本化**     | 对齐官方 authority rule：`specification/` 版本目录（v1_0 主版本）；v1.0 核查表（checklist-a2ui-v1.0.checked.md）迁为 conformance 基准                  |
| **一致性保障**     | `conformance/` 持续跑（v1.0 全量），实现变更不得破坏协议                                                                                               |
| **独立版本与发布** | 每包独立版本（CHANGELOG）+ 发布脚本（参考官方 `agent_sdks/python/release.sh`）                                                                         |
| **规范同步**       | 从官方仓库同步 `specification/v1_0` 的流程迁入 a2ui 项目（替代现 AGENTS.md 中 geo-scout 内同步）；提交规范：`chore(a2ui): 同步官方规范副本到上游 HEAD` |
| **SDD（可选）**    | 对齐官方 blueprints/，多语言实现时追踪合规                                                                                                             |
| **CI**             | 双仓独立流水线：a2ui（build/test/lint/conformance/eval）+ geo-scout（依赖 a2ui 发布产物）                                                              |

---

## 6. 风险与回滚

| 风险                                | 等级 | 缓解                                                                                                             |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| geo schema 外移引入类型断裂         | 中   | Phase 0 单步验证；先移 schema 后改引用，跑全量测试                                                               |
| @geo/shared 反转依赖遗漏调用方      | 中   | 先 grep 全部引用点，改后全量 test + vp check                                                                     |
| Angular 库化（ng-package）打包问题  | 中   | 参考官方 `renderers/angular/ng-package.json`；Phase 1 先建 explorer 验证                                         |
| 双仓联调期间功能回归                | 中   | Phase 1 每迁移一批即联调冒烟（dashboard/chat/WS）                                                                |
| 官方 v1.0 演进与 geo-scout 实现分叉 | 低   | conformance 作为契约基准；版本化目录隔离                                                                         |
| **回滚策略**                        | —    | Phase 0 为纯结构迁移（git 可逆）；Phase 1 拆仓后 geo-scout 保留旧提交可整体回退；双仓以 conformance 判定契约一致 |

---

## 7. 工作量与里程碑

| 阶段             | 工作量          | 里程碑                                   |
| ---------------- | --------------- | ---------------------------------------- |
| Phase 0 解耦重构 | ~1 周（单人）   | geo-scout 内边界净化完成                 |
| Phase 1 仓库拆分 | ~3-4 天         | a2ui 仓独立可用 + geo-scout 消费外部依赖 |
| Phase 2 治理落地 | ~2-3 天 + 持续  | 版本/发布/CI/规范同步机制就绪            |
| **合计**         | **约 2-2.5 周** | 首个独立版本发布                         |

---

## 8. 待决策事项（请审核拍板）

| #      | 决策                                | 选项                                                               | 建议                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| **D1** | geo 组件归属                        | A. 留在 geo-scout（推荐）B. 随拆作 `samples/community/geo-sensor`  | **A**：a2ui 项目保持通用；geo 组件作为行业扩展由 geo-scout 维护 |
| **D2** | 命名空间                            | A. `@freezestudio/a2ui-*`（对齐官方，推荐）B. 保留 `@geo/a2ui-*`   | **A**                                                           |
| **D3** | monorepo 工具                       | A. pnpm（延续）B. yarn（对齐官方）                                 | **A**：团队已熟，标准脚本语义一致                               |
| **D4** | 消费方式                            | A. npm registry（私有/公共）B. git 依赖 C. 本地 workspace 桥接过渡 | **C→A**：Phase 1 用 git 依赖快速打通，稳定后发 registry         |
| **D5** | v1.0 定位                           | A. 独立 TS 参考实现 B. 向官方上游贡献/对齐                         | **A 起步，B 可选**：先独立演进，再评估是否 upstream             |
| **D6** | explorer 演示壳                     | A. 建最小演示（推荐）B. 暂不建                                     | **A**：独立项目必须有可运行演示 + e2e（对齐官方 a2ui_explorer） |
| **D7** | 后端协议工具（a2ui-parser/extract） | A. 随拆进 a2ui 项目 B. 留 geo-scout                                | **A**：属协议侧，拆后 parser/extract 工具可被其他消费方复用     |
| **D8** | 拆分节奏                            | A. 一次性全拆 B. 先拆前端（renderer+core）后拆后端                 | **B**：前端核心已成熟先拆；server 工具晚一步                    |

---

## 9. 参考

- 官方仓库：`~/github/ai-tools/a2ui`（AGENTS.md 的版本权威/仓库结构/SDD 章节）
- `docs/references.md`：a2ui 本地仓库路径与协议资源根
- `AGENTS.md`：规范副本同步流程（Phase 2 迁入 a2ui 项目）
- `docs/checklist-a2ui-v1.0.checked.md`：v1.0 核查基准
- `docs/developing-custom-a2ui-components.md`：自定义 catalog 开发指南（随迁）
