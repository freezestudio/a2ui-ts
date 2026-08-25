# A2UI samples 与开发工具

本目录收录 A2UI TypeScript 实现的示例与开发工具，布局对齐官方仓库
[`a2ui-project/a2ui` 的 `samples/`](https://github.com/a2ui-project/a2ui/tree/main/samples)
（`client/` 按框架分目录、`agent/` 为 agent 端示例、`community/` 社区示例）。

## 目录结构

| 路径                    | 说明                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `client/angular/`       | `@freezestudio/a2ui-angular-demo` — 消费 `@freezestudio/a2ui-angular` 的最小演示壳                     |
| `agent/generator-demo/` | `@freezestudio/a2ui-agent-generator-demo` — agent 侧 LLM 生成示例（prompt → generate → validate 循环） |
| `community/`            | 社区示例（可选跟进，暂无）                                                                             |

## 维护中的示例

| Sample                       | Agent             | Renderer       | e2e | 说明                                       |
| ---------------------------- | ----------------- | -------------- | --- | ------------------------------------------ |
| [angular demo][demo-readme]  | 外部注入          | `a2ui-angular` |     | 最小演示壳（`ng serve`），消息由宿主发送   |
| [generator demo][gen-readme] | DeepSeek / Ollama | —（生成侧）    |     | agent 侧 prompt → generate → validate 示例 |

> 表格对齐官方 samples/README.md 注册表格式（Sample / Agent / Renderer / e2e / Video）。
> 后续新增示例时在此登记；补 e2e（playwright）与录屏后更新对应列。

[demo-readme]: client/angular/README.md
[gen-readme]: agent/generator-demo/README.md

## 运行

```bash
pnpm --filter @freezestudio/a2ui-angular-demo build   # 构建演示壳
pnpm --filter @freezestudio/a2ui-angular-demo start   # ng serve 开发运行
```
