---
'@freezestudio/a2ui-sdk': minor
---

chore(a2ui): 同步官方 v1.0 规范到上游 HEAD fcec476bf（Catalog 迁移 + 协议新增）

- 规范副本：`specification/v1_0` 同步至上游（`Child`/`DataBinding`/`FunctionCall`
  纳入外部 `$ref` 白名单、`deprecated`/`x-deprecated-reason`、renderer capabilities
  作用域澄清），删除上游已移除的 `specification/v1_0/eval`
- Catalog 副本：v1.0 basic catalog 自上游 #2693 起迁至顶层 `catalogs/`，本包新增
  `resources/catalogs/`（`basic/v1/catalog.json`、`mcp/catalog.json`）；`getCatalogDir()`
  / `createBasicCatalogPath()` 返回路径随之变化，新增 `getCatalogsDir()`
  （catalog `$id` 与发布 URL 不变）
- `Catalog.fromJson()` 解析 `deprecated` / `x-deprecated-reason`（规范 catalog rule 8）
- 修正 basic catalog examples 中的非法图标名（`warning` / `favorite` / `payment` / `arrowForward`）
