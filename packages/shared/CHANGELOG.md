# @freezestudio/a2ui-shared

## 1.3.0

### Minor Changes

- 97dc87a: 对齐上游 a2ui v1.0 保留协议键 `@` 前缀迁移（上游 #2692 / #2891，commit `ae0a5253`）：

  - **破坏性**：A2UI v1.0 数据绑定改为 `{ "@path": "..." }`，函数调用改为 `{ "@call": "...", "args": {...} }`（含 `@index`）。
    普通 `path` / `call` 键在 v1.0 动态对象中不再被拦截，视为字面量。
  - 动态对象中任何未转义的单 `@` 键（`^@([^@]|$)`）一律拒绝；字面量 `@` 键需 `@@` 前缀加倍转义（求值时去转义）。
  - `ChildList` 模板指针 `{ componentId, path }` 与 `updateDataModel.path` 保持不加前缀。
  - `component-validator` 新增 `propertyNames` 支持，运行时拒绝未识别的保留键。
  - 安全：移植上游 ReDoS 加固（#2366），`regex` 校验使用 `redos-detector` 拒绝灾难性回溯模式并限制输入长度。
  - 健壮性：表达式解析器支持非 ASCII 数据模型键（#2527）。
  - 流式解析：v1.0 未闭合组件一律缓冲至其对象闭合后再下发，避免 `catalogId` 晚到时按 surface catalog 误校验（#3026）。
  - 多 catalog：补充 `catalogId` 覆盖场景下函数参数按实际运行的 catalog 校验的覆盖（#2715）。

  同步官方规范副本至上游 HEAD `db430653`。

## 1.2.0

### Minor Changes

- 2c8b978: fix(a2ui): 移植上游 web_core 资源限额加固（CWE-400 / CWE-674）

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
