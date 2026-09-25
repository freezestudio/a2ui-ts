/**
 * 渲染器资源限额常量
 */

/**
 * 动态 ChildList 模板（`{ componentId, path }`）单次物化的最大子项数。
 * 防止绑定到超大数组时无界克隆组件实例、耗尽内存（CWE-400）。
 * 对齐上游 web_core `MAX_DYNAMIC_CHILD_LIST_SIZE`。
 */
export const MAX_DYNAMIC_CHILD_LIST_SIZE = 1_000;
