# a2ui-ts — Agent 指引

## 项目概况

A2UI v1.0 协议的 TypeScript 参考实现（自 geo-scout 拆分独立演进）。pnpm monorepo：协议核心包 + Angular 渲染器 + 一致性测试 + LLM 评估。

## 仓库结构

```
a2ui-ts/
├── packages/
│   ├── shared/      # @freezestudio/a2ui-shared  共享工具（表达式/路径/类型/国际化/JSON 修复）
│   ├── web-core/    # @freezestudio/a2ui-web-core 框架无关渲染核心（消息处理/Surface/数据绑定/函数调用）
│   ├── sdk/         # @freezestudio/a2ui-sdk     协议 SDK（schema/5 层校验/流式解析/catalog）
│   │   └── resources/specification/v1_0/  # 官方规范副本（只读！同步方式见下）
│   └── agent/       # @freezestudio/a2ui-agent   LLM 生成器（DeepSeek/Ollama）
├── renderers/
│   └── angular/     # @freezestudio/a2ui-angular Angular 渲染器（basic 组件/渲染适配/CatalogRegistry）
├── conformance/     # @freezestudio/a2ui-conformance v1.0 一致性测试（568 用例，PRIVATE 不发布）
├── eval/            # @freezestudio/a2ui-eval    LLM 评估框架（PRIVATE 不发布）
├── samples/client/angular/  # @freezestudio/a2ui-angular-demo 演示壳
└── .github/workflows/       # ci.yml（build/test/check/changeset 门禁）+ release.yml（Changesets 自动发版）+ publish.yml（单包人工补发）
```

## 工具链

| 范围              | 工具             | 说明                                             |
| ----------------- | ---------------- | ------------------------------------------------ |
| Monorepo 根       | vp (Vite+)       | `pnpm check` = vp check（format+lint+type）      |
| packages/\*       | vp (Vite+)       | build 用 `vp pack`，test 用 `vp test`            |
| renderers/angular | ng (Angular CLI) | `ng build`（ng-packagr 库）/ `ng test`（vitest） |
| 发布              | pnpm/npm         | 公网 npm，scope `@freezestudio/a2ui-*`           |

## 验证命令

```bash
pnpm install
pnpm -r build          # 全部构建（拓扑序，含 angular/demo）
pnpm -r test           # 全部测试（1266：shared 53 / web-core 11 / sdk 538 / angular 96 / conformance 568）
pnpm check             # 格式 + lint + 类型（根 vite.config.ts 配置）
```

按包：

```bash
pnpm --filter @freezestudio/a2ui-sdk build
pnpm --filter @freezestudio/a2ui-sdk test
pnpm --filter @freezestudio/a2ui-conformance test
pnpm --filter @freezestudio/a2ui-angular build
pnpm --filter @freezestudio/a2ui-angular test
pnpm --filter @freezestudio/a2ui-angular-demo build
```

## 发布流程（公网 npm）

使用 **Changesets** 管理版本、CHANGELOG、tag 与 npm 发布：

```bash
pnpm changeset                 # 本地声明变更包与 semver bump（major/minor/patch）
pnpm changeset status --since=origin/main   # 检查当前变更是否已有 changeset
```

- 带 changeset 的提交合并到 main 后，`.github/workflows/release.yml` 自动创建/更新 “Version Packages” PR。
- 合并该 PR 后，Changesets 自动：
  - 更新各包 `package.json` 版本
  - 生成/更新各包 `CHANGELOG.md`
  - 创建包级 git tag（如 `@freezestudio/a2ui-sdk@2.0.0`）
  - 只发布实际变更的 public 包到 npm
- `pnpm release:check` / `release:version` / `release:publish` 为对应快捷命令。
- 仅人工补发某个包时才使用 `publish.yml` 的 `workflow_dispatch`，并选择目标 workspace 包。
- conformance/eval/demo 为 private，在 Changesets 配置中 ignore，不发布

## 规范副本同步

`packages/sdk/resources/specification/v1_0/` 为官方规范副本（**只读**），上游 = 本地 `~/github/ai-tools/a2ui`：

```bash
# 1. 确认上游新提交
cd ~/github/ai-tools/a2ui && git fetch origin && git log --oneline -N specification/
# 2. 全量同步
rsync -a --delete ~/github/ai-tools/a2ui/specification/v1_0/ packages/sdk/resources/specification/v1_0/
# 3. 验证
diff -rq ~/github/ai-tools/a2ui/specification/v1_0/ packages/sdk/resources/specification/v1_0/
pnpm --filter @freezestudio/a2ui-sdk test
pnpm --filter @freezestudio/a2ui-conformance test
# 4. 提交（记录上游 commit）
git commit -m "chore(a2ui): 同步官方规范副本到上游 HEAD <commit>"
```

## 代码规范

- 单引号、有分号、2 空格缩进、120 字符行宽、尾逗号 all（oxfmt，`vp fmt`）
- 严格 TS，禁 any；ESM；文件名 kebab-case；测试 `.spec.ts`
- 修改后必须 `pnpm check`（或对应包 lint）验证；`pnpm -r test` 全绿后才可合入
- `packages/sdk/resources/specification/**` 参与格式/lint 排除（根 vite.config.ts 已配置）

## 注意事项

1. Angular 部分（renderers/angular、samples）走 `ng` 命令，不走 vp；**注意 Angular 22 的 `application` builder 属性为 `browser`（非 `main`）**
2. 新发布版本后 npmjs abbreviated metadata 有数分钟传播延迟（pnpm 安装可能短暂 404，稍等重试）
3. geo-scout 消费本仓库包（`@freezestudio/a2ui-*`），协议变更需同步验证 geo-scout 侧（server 150 / web 144 测试）
4. `@a2ui/*` 官方 scope 被 a2ui-team 占用，**勿改回**；发布 scope 固定 `@freezestudio`
