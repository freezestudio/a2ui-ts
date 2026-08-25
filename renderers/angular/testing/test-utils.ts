/**
 * A2UI Angular 渲染器测试工具集
 *
 * 为宿主应用与 catalog 组件的单元测试提供共享工具：
 * - `createBoundProperty`：构造 mock 绑定属性（与 ComponentBinder 输出同构）
 * - `setA2uiInputs`：设置 CatalogComponent 的 component/surface/snapshotSurface inputs
 *
 * 用法（二级入口）：`import { createBoundProperty } from '@freezestudio/a2ui-angular/testing';`
 *
 * 注意：本文件为 ng-packagr 二级入口，须保持零内部依赖（不 import 主入口源码，
 * 否则触发 rootDir 冲突）；结构类型与主入口 `A2UIDescriptor` / `Surface` 协变兼容。
 */

import { ComponentFixture } from '@angular/core/testing';
import { signal, Signal } from '@angular/core';

/** 与 A2UIDescriptor 结构兼容的最小组件描述 */
export type TestComponentDescriptor = {
  id: string;
  component: string;
  [key: string]: unknown;
};

/** 与 Surface 结构兼容的最小 surface 描述 */
export type TestSurfaceLike = {
  surfaceId: string;
  dataModel: Record<string, unknown>;
  [key: string]: unknown;
};

/** 与 ComponentBinder.bind() 输出同构的绑定属性结构 */
export interface TestBoundProperty<T = unknown> {
  value: Signal<T>;
  raw: unknown;
  onUpdate?: (value: unknown) => void;
}

/**
 * 构造 mock BoundProperty（与 ComponentBinder.bind() 返回结构同构）
 *
 * @param val - 绑定值
 * @param onUpdate - 双向绑定回写 spy（可选）
 */
export function createBoundProperty<T>(val: T, onUpdate?: (value: unknown) => void): TestBoundProperty<T> {
  return {
    value: signal(val),
    raw: val,
    ...(onUpdate ? { onUpdate } : {}),
  };
}

/**
 * 设置 CatalogComponent 派生组件的 inputs（component 必填，surface 必填，snapshotSurface 可选）
 *
 * @param fixture - TestBed.createComponent 创建的 fixture
 * @param component - A2UI 组件描述对象
 * @param surface - 所属 Surface
 * @param snapshotSurface - 快照模式 surface 副本（可选）
 */
export function setA2uiInputs(
  fixture: ComponentFixture<unknown>,
  component: TestComponentDescriptor,
  surface: TestSurfaceLike,
  snapshotSurface?: TestSurfaceLike | null,
): void {
  fixture.componentRef.setInput('component', component);
  fixture.componentRef.setInput('surface', surface);
  if (snapshotSurface !== undefined) {
    fixture.componentRef.setInput('snapshotSurface', snapshotSurface);
  }
}
