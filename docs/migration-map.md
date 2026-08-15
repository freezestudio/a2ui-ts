# A2UI 拆分 Phase 1 迁移映射表（P0-4 产物）

> 本表由 P0-4（命名与引用点梳理）产出，供 Phase 1 仓库拆分时批量替换使用。
> 现状：全部 a2ui 包以 `@geo/a2ui-*` scope 存在于 geo-scout；拆分后改名 `@freezestudio/a2ui-*` 并迁入独立仓库。

## 一、包名映射

| 现名（geo-scout）            | 新名（a2ui 项目）        | 目标目录                | 说明                                             |
| ---------------------------- | ------------------------ | ----------------------- | ------------------------------------------------ |
| `@geo/a2ui-shared`           | `@freezestudio/a2ui-shared`        | `packages/shared/`      | 零依赖；工具已下沉，P0-3 已反转 @geo/shared 依赖 |
| `@geo/a2ui-web-core`         | `@freezestudio/a2ui-web-core`      | `renderers/web_core/`   | P0-1 已移出 geo schema                           |
| `@geo/a2ui-sdk`              | `@freezestudio/a2ui-sdk`           | `packages/sdk/`         | P0-2 已移出 geo-catalog                          |
| `@geo/a2ui-agent`            | `@freezestudio/a2ui-agent`         | `packages/agent/`       | LLM 生成器（DeepSeek/Ollama）                    |
| `@geo/a2ui-conformance-test` | `@freezestudio/a2ui-conformance`   | `conformance/`          | v1.0 一致性测试套件                              |
| `@geo/a2ui-eval-test`        | `@freezestudio/a2ui-eval`          | `eval/`                 | LLM 评估框架                                     |
| `@geo/geo-catalog`           | **不变**（留 geo-scout） | `packages/geo-catalog/` | 行业应用层，P0-2 新包                            |

## 二、package.json 依赖改动

| 包                     | 现依赖                                   | 改后依赖                                               |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `apps/server`          | `@geo/a2ui-sdk`、`@geo/a2ui-shared`      | `@freezestudio/a2ui-sdk`、`@freezestudio/a2ui-shared`（外部 registry/git） |
| `apps/web`             | `@geo/a2ui-shared`、`@geo/a2ui-web-core` | `@freezestudio/a2ui-shared`、`@freezestudio/a2ui-web-core`                 |
| `packages/geo-catalog` | （无 a2ui 依赖）                         | 不变                                                   |
| a2ui 包内部            | `@geo/a2ui-*` workspace 互依             | `@freezestudio/a2ui-*` workspace 互依                            |

## 三、apps/ 内引用文件清单（33 个，Phase 1 需批量替换 import）

### apps/server（22 个）

```
src/action-handler.ts            src/agents/a2ui-agent.ts
src/agents/factory.ts            src/agents/main-agent.ts
src/chat-stream-runner.ts        src/config.ts
src/engines/programmatic-engine.ts  src/export-service.ts
src/schemas.ts                   src/server.ts
src/session-manager.ts           src/tools/a2ui-extract.ts
src/tools/a2ui-parser.ts         src/ws-server.ts
tests/a2ui-parser.test.ts        tests/auth.test.ts
tests/config-matrix.integration.test.ts  tests/config-matrix.test.ts
tests/export-api.test.ts         tests/export-service.test.ts
tests/ws-server.test.ts
```

> 引用量：`@geo/a2ui-sdk`×40、`@geo/a2ui-shared`×23、`@geo/a2ui-agent`×12（全仓计数）

### apps/web（11 个）

```
src/app/a2ui/component-type-map.ts     src/app/a2ui/geo-catalog.ts
src/app/a2ui/geo/geo-schemas.ts        src/app/a2ui/renderer/data-binding.ts
src/app/a2ui/renderer/function-call.spec.ts  src/app/a2ui/renderer/function-call.ts
src/app/a2ui/renderer/index.ts         src/app/a2ui/renderer/logger.ts
src/app/a2ui/renderer/message-handler.spec.ts src/app/a2ui/renderer/message-handler.ts
src/app/a2ui/renderer/schemas.ts       src/app/a2ui/renderer/surface-manager.ts
```

> 引用量：`@geo/a2ui-web-core`×24（全仓计数）

## 四、批量替换规则

1. **字符串替换**（全仓，含 package.json 与 import）：
   - `@geo/a2ui-shared` → `@freezestudio/a2ui-shared`
   - `@geo/a2ui-web-core` → `@freezestudio/a2ui-web-core`
   - `@geo/a2ui-sdk` → `@freezestudio/a2ui-sdk`
   - `@geo/a2ui-agent` → `@freezestudio/a2ui-agent`
   - `@geo/a2ui-conformance-test` → `@freezestudio/a2ui-conformance`
   - `@geo/a2ui-eval-test` → `@freezestudio/a2ui-eval`
2. **依赖协议**：geo-scout 内改为外部依赖（`^x.y.z` registry 或 `github:freezestudio/a2ui-ts#...` git 依赖）；a2ui 项目内保持 `workspace:*`
3. **顺序**：a2ui 项目先发布/可用 → geo-scout 改依赖 → 全量验证（server/web/conformance/eval）

## 五、Phase 1 注意事项

- `@geo/geo-catalog`（P0-2 新包）与 `@geo/data-source`、`@geo/shared` 留在 geo-scout，不参与改名
- `specification/v1_0` 副本随 sdk 迁入 a2ui 项目 `specification/`，geo-scout 不再持有
- 工具函数（normalizeSmartQuotes 等）geo-scout 通过 `@freezestudio/a2ui-shared` 消费（P0-3 已就绪）
- 验证基线：server 150 测试 / web 240 测试 / sdk / conformance / vp check 全绿
