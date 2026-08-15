import { Injectable, Signal, computed, signal } from '@angular/core';
import { DataContext } from './data-context.js';
import type { SurfaceManager, A2UIDescriptor, Surface } from './surface-manager.js';
import type { DataBinding } from './data-binding.js';

export interface BoundProperty {
  value: Signal<unknown>;
  raw: unknown;
  onUpdate?: (value: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class ComponentBinder {
  bind(
    component: A2UIDescriptor,
    surfaceId: string,
    surfaceManager: SurfaceManager,
    dataPathPrefix?: string,
  ): Record<string, BoundProperty>;
  /**
   * 快照模式重载：直接传入 Surface 对象（如导出报告的历史轮次深拷贝），
   * 绑定解析完全基于该 surface 的 dataModel，不再回查实时 surfaceManager。
   */
  bind(component: A2UIDescriptor, surface: Surface, dataPathPrefix?: string): Record<string, BoundProperty>;
  bind(
    component: A2UIDescriptor,
    surfaceIdOrSurface: string | Surface,
    surfaceManagerOrPrefix?: SurfaceManager | string,
    dataPathPrefix?: string,
  ): Record<string, BoundProperty> {
    let ctx: DataContext;
    let prefix: string | undefined = dataPathPrefix;
    if (typeof surfaceIdOrSurface === 'object') {
      // 快照模式：直接持有 Surface 副本，绑定解析不响应 manager 更新
      const surface = surfaceIdOrSurface;
      prefix = (surfaceManagerOrPrefix as string | undefined) ?? prefix;
      ctx = new DataContext(surface, prefix);
    } else {
      // 实时模式：DataContext 按 surfaceId 回查 manager（computed 内建立 signal 依赖），
      // updateDataModel 不可变更新后绑定值自动刷新
      const manager = surfaceManagerOrPrefix as SurfaceManager;
      const surfaceId = surfaceIdOrSurface;
      ctx = new DataContext(manager, surfaceId, prefix ? this.toAbsolutePath(prefix) : '/');
    }
    const index = component['@index'] as number | undefined;
    const bound: Record<string, BoundProperty> = {};

    for (const key of Object.keys(component)) {
      if (key === 'id' || key === 'component' || key === '@index' || key === '_dataPathPrefix') continue;

      const value = component[key];

      if (
        key === 'children' &&
        typeof value === 'object' &&
        value !== null &&
        'componentId' in value &&
        'path' in value
      ) {
        const tpl = value as { componentId: string; path: string };
        const listSig = ctx.resolve<unknown[]>({ path: tpl.path });
        bound[key] = {
          value: computed(() => (Array.isArray(listSig()) ? listSig() : [])),
          raw: value,
        };
        continue;
      }

      if (key === 'checks' && Array.isArray(value)) {
        // 响应式 CheckRule 校验（协议 L936-1010；v1.0 #2220 condition 求值为 ValidationResult）
        // 订阅每条 condition，注入 isValid（全部通过）与 validationErrors（失败消息列表）
        const checks = value as Array<{ condition?: unknown; message?: string }>;
        const conditionSignals = checks.map((c) => ctx.resolve(c.condition, index));
        const isPassed = (r: unknown): boolean =>
          r !== null && typeof r === 'object' && 'valid' in r ? Boolean(r['valid']) : Boolean(r);
        bound[key] = {
          value: signal(value),
          raw: value,
        };
        bound['isValid'] = {
          value: computed(() => (checks.length === 0 ? true : conditionSignals.every((s) => isPassed(s())))),
          raw: undefined,
        };
        bound['validationErrors'] = {
          // #2220：message 可选（fallback），ValidationResult.message 优先
          value: computed(() =>
            checks
              .map((c, i) => {
                const r = conditionSignals[i]();
                if (isPassed(r)) return null;
                const vr = r !== null && typeof r === 'object' && 'valid' in r ? (r as Record<string, unknown>) : null;
                return (vr?.['message'] as string) ?? c.message ?? '校验未通过';
              })
              .filter((m): m is string => m !== null),
          ),
          raw: undefined,
        };
        continue;
      }

      const sig = ctx.resolve(value, index);
      const isBinding = typeof value === 'object' && value !== null && 'path' in value && !('call' in value);

      bound[key] = {
        value: sig,
        raw: value,
        ...(isBinding ? { onUpdate: (v: unknown) => ctx.set((value as DataBinding).path, v) } : {}),
      };
    }

    return bound;
  }

  private toAbsolutePath(prefix: string): string {
    return prefix.startsWith('/') ? prefix : `/${prefix}`;
  }
}
