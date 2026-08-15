# @freezestudio/a2ui-shared

A2UI v1.0 协议实现的共享工具包：表达式解析、JSON Pointer 路径工具、类型转换、国际化规则、JSON 修复（normalizeSmartQuotes/removeTrailingCommas）。

## 安装

```bash
npm install @freezestudio/a2ui-shared
```

## 模块

- `expression-parser` — A2UI 表达式解析（与 `@freezestudio/a2ui-web-core` 的 DataBinding/FunctionCall 语义配套）
- `path-utils` — JSON Pointer 解析/序列化/路径操作
- `type-utils` — `toStr`/`toFloat` 等类型转换
- `json-healer` — LLM 输出 JSON 修复（智能引号/尾逗号/残缺片段）
- `locale-config` — 国际化格式规则
- `object-utils` — 深合并/深拷贝/危险键防护

## 许可证

Apache-2.0
