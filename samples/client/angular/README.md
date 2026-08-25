# @freezestudio/a2ui-angular-demo

A2UI v1.0 Angular 渲染器最小演示壳，消费 [`@freezestudio/a2ui-angular`](../../../renderers/angular)。

- **Agent**：外部注入（宿主应用通过 `A2UIRendererService` 的回调发送 renderer→agent 消息）
- **Renderer**：`@freezestudio/a2ui-angular`（basic catalog）

## 运行

```bash
pnpm install
pnpm --filter @freezestudio/a2ui-angular-demo start   # ng serve
pnpm --filter @freezestudio/a2ui-angular-demo build   # 生产构建
```
