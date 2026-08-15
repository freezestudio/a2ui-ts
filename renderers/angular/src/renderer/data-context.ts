import { computed, Signal, signal } from '@angular/core';
import { isDataBinding, isFunctionCall, resolvePath } from './data-binding.js';
import { callFunction } from './function-call.js';
import type { DataBinding, FunctionCall } from './data-binding.js';
import type { SurfaceManager, Surface } from './surface-manager.js';

export class DataContext {
  /** 实时模式：基于 SurfaceManager（按 surfaceId 回查）；快照模式：直接持有 Surface 副本 */
  private getDataModel: () => Record<string, unknown>;
  private setDataModel: (path: string, value: unknown) => void;
  /** 当前解析基准路径 */
  path: string = '/';

  constructor(managerOrSurface: SurfaceManager, surfaceId: string, path?: string);
  /** 快照模式：直接传入 Surface（如导出报告历史轮次深拷贝），不回查 manager */
  constructor(surface: Surface, path?: string);
  constructor(managerOrSurface: SurfaceManager | Surface, surfaceIdOrPath?: string, path?: string) {
    if ('surfaces' in managerOrSurface) {
      // SurfaceManager 模式
      const manager = managerOrSurface as SurfaceManager;
      const surfaceId = surfaceIdOrPath as string;
      // 必须读 Angular signal（manager.surfaces()）：Angular computed 不追踪
      // preact signal（manager.core.surfaces.value），否则绑定不响应更新
      this.getDataModel = () => manager.surfaces().get(surfaceId)?.dataModel ?? {};
      this.setDataModel = (p, v) => manager.handleUpdateDataModel(surfaceId, p, v);
      this.path = path ?? '/';
    } else {
      // Surface 模式（快照）
      const surface = managerOrSurface as Surface;
      const basePath = (surfaceIdOrPath as string) ?? '/';
      this.getDataModel = () => surface.dataModel;
      this.setDataModel = () => {
        /* 快照只读：写入不影响实时状态 */
      };
      this.path = basePath;
    }
  }

  resolve<T = unknown>(value: unknown, index?: number): Signal<T> {
    if (value === null || value === undefined) return signal(undefined as T);
    if (typeof value !== 'object' || Array.isArray(value)) return signal(value as T);

    if (isDataBinding(value)) {
      const binding = value as DataBinding;
      const absolutePath = this.resolvePath(binding.path);
      return computed(() => {
        const dataModel = this.getDataModel();
        const ctx = index !== undefined ? { '@index': index } : undefined;
        return resolvePath({ path: absolutePath }, dataModel, ctx) as T;
      }) as Signal<T>;
    }

    if (isFunctionCall(value)) {
      return computed(() => {
        const dataModel = this.getDataModel();
        const ctx = index !== undefined ? { '@index': index } : undefined;
        return callFunction(value as FunctionCall, dataModel, 0, ctx) as T;
      }) as Signal<T>;
    }

    return signal(value as T);
  }

  resolveString(value: unknown, index?: number): Signal<string> {
    return computed(() => {
      const resolved = this.resolve(value, index)();
      if (resolved === null || resolved === undefined) return '';
      if (typeof resolved === 'object') return JSON.stringify(resolved);
      return String(resolved as string | number | bigint | symbol);
    });
  }

  nested(relativePath: string): DataContext {
    return new DataContext(this.getDataModelForNested(), this.resolvePath(relativePath));
  }

  private getDataModelForNested(): Surface {
    // nested 仅用于路径解析，dataModel 取当前快照即可
    return {} as Surface;
  }

  set(path: string, value: unknown): void {
    const absolutePath = this.resolvePath(path);
    this.setDataModel(absolutePath, value);
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) return path;
    let base = this.path;
    if (base.endsWith('/') && base.length > 1) base = base.slice(0, -1);
    if (base === '/') base = '';
    return `${base}/${path}`;
  }
}
