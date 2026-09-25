---
'@freezestudio/a2ui-shared': minor
'@freezestudio/a2ui-sdk': minor
'@freezestudio/a2ui-web-core': patch
'@freezestudio/a2ui-angular': patch
---

fix(a2ui): 移植上游 web_core 资源限额加固（CWE-400 / CWE-674）

对齐上游 web_core 的一批安全/健壮性修复（非破坏性，与协议 wire 格式无关）：

- shared (minor)：`ExpressionParser` 新增 `MAX_EXPRESSION_TEMPLATE_LENGTH`(10000) 与
  `MAX_EXPRESSION_PARTS`(1000) 限额，拒绝超大模板（对齐上游 #2433）
- sdk (minor)：
  - `DataContext` 新增 `MAX_DYNAMIC_VALUE_DEPTH`(1000) 递归限深，超限派发 `EXPRESSION_ERROR`
    并回退（对齐 #2432）；`_extractPaths` 同步限深
  - 函数调用参数数量上限 `MAX_FUNCTION_CALL_ARGS`(1000)（对齐 #2417）
  - `DataModel` 新增 `MAX_ARRAY_INDEX`(10000)，超大数组下标 auto-vivify 抛错（对齐 #2430）
  - `formatString` 模板长度限幅
- web-core (patch)：`FunctionCallSchema` 限制 args 数量
- angular (patch)：动态 ChildList 模板物化上限 `MAX_DYNAMIC_CHILD_LIST_SIZE`(1000)
  （对齐 #2431）；Button/Card 背景样式 `background` → `background-color`（对齐 #2367）
