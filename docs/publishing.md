# 发布（公网 npm）

a2ui-ts 使用 **Changesets** 管理版本、CHANGELOG、tag 与 npm 发布。所有 public 包发布到公网 npm，scope 固定为 `@freezestudio`。

## 基本流程

```bash
pnpm changeset        # 声明本次变更影响的包和 bump 类型（major/minor/patch）
pnpm release:check    # 检查当前变更是否已登记 changeset
```

- 变更合并到 `main` 后，`.github/workflows/release.yml` 自动创建 / 更新 “Version Packages” PR。
- 合并该 PR 后，Changesets 自动：
  - 更新各包 `package.json` 版本
  - 生成 / 更新各包 `CHANGELOG.md`
  - 创建包级 git tag（如 `@freezestudio/a2ui-sdk@2.0.0`）
  - 只发布实际变更的 public 包到 npm
- `publish.yml` 仅作为人工补发某个 workspace 包的 fallback（`workflow_dispatch`，选择目标包）。
- conformance / eval / demo 为 private，在 Changesets 配置中 ignore，不发布。

## 快捷命令

```bash
pnpm release:check    # 检查 PR 中变更的 public 包是否已有 changeset
pnpm release:version  # changeset version（更新版本号 + CHANGELOG）
pnpm release:publish  # changeset publish（发版到 npm）
```

## 注意事项

- 新发布版本后 npmjs abbreviated metadata 有数分钟传播延迟（pnpm 安装可能短暂 404，稍等重试）。
- geo-scout 消费本仓库包（`@freezestudio/a2ui-*`），协议变更需同步验证 geo-scout 侧（server 150 / web 144 测试）。
- `@a2ui/*` 官方 scope 被 a2ui-team 占用，**勿改回**；发布 scope 固定 `@freezestudio`。
