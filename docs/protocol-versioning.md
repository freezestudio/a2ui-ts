# A2UI 协议版本化策略

> 对齐官方 authority rule（见官方仓库 `~/github/ai-tools/a2ui/AGENTS.md`）：
> 官方当前主协议版本 v0.9.1，v1.0 为候选；**本实现以 v1.0 为主版本**（TS 参考实现）。

## 版本模型

```
官方规范（specification/<version>/）  ← 权威真源，只读副本同步
   │
   ▼
本仓库 packages/sdk/resources/specification/v1_0/  ← 官方 v1_0 副本（只读，rsync 同步）
   │
   ├── schema（zod，web-core/sdk）    ← 协议校验实现
   ├── conformance/                   ← 一致性测试（随版本目录）
   └── 包版本（@freezestudio/a2ui-*）  ← 独立于协议版本的发布节奏
```

**关键原则**：协议版本（v1.0/v1.x）与 npm 包版本（1.1.x）**解耦**——包可以频繁发 patch/minor，
只有协议语义变更才推进协议版本。

## 演进规则

| 变更类型                                | 处理                                                                |
| --------------------------------------- | ------------------------------------------------------------------- |
| 向后兼容（新增可选字段/组件、文档修正） | 当前协议版本内增量；schema 宽松化；包版本 minor/patch               |
| 破坏性变更（字段语义改变、移除能力）    | **新协议版本目录**（如 v2_0），旧版本目录保留；SDK 按版本分目录实现 |
| 官方规范更新                            | rsync 同步副本 → 更新 zod schema → conformance 全绿 → 发布          |

## 变更流程（协议语义变更）

1. 同步官方规范副本（见 AGENTS.md「规范副本同步」）
2. 在 web-core/sdk 更新对应 zod schema 与校验器
3. `pnpm --filter @freezestudio/a2ui-conformance test` 全绿（561 基线）
4. `pnpm -r test`（1234 基线）+ `pnpm check` 全绿
5. 版本推进：按规则决定协议版本/包版本
6. 发布（见 AGENTS.md「发布流程」）
7. **验证 geo-scout 消费侧**：server 150 / web 144 测试 + 联调冒烟

## 版本目录约定

- `packages/sdk/resources/specification/<version>/`：官方规范副本（只读）
- `conformance/`：测试用例按协议版本组织（当前 v1_0）
- 渲染器/组件 schema 与协议版本对齐（`ComponentBase` 等基础类型不随行业扩展变动）

## 权威参考

- 官方 AGENTS.md 版本权威章节：`~/github/ai-tools/a2ui/AGENTS.md`
- 官方协议站点：<https://a2ui.org/>
- 本仓库 spec 副本：`packages/sdk/resources/specification/v1_0/`
