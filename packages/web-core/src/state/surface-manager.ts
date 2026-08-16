/**
 * SurfaceManager — 生产渲染器状态管理
 *
 * 定位说明（与 sdk/src/state/ 的边界）：
 * - 本模块是**实际渲染链路**使用的状态源：preact signal 驱动的浅实现，
 *   面向 Angular/React 等框架的响应式消费（apps/web 已消费）。
 * - sdk/src/state/（NodeGraph/DataModel/GenericBinder）是官方 Python
 *   core/state/ + core/rendering/ 的 TypeScript 移植，定位"headless 参考实现"，
 *   不公开导出、未被生产渲染消费。
 * - 两套状态**有意分离**：本模块保持轻量（纯数据 + signal），深度响应式
 *   绑定逻辑（插值订阅、模板列表 spawn）在 sdk state 演进完备后再评估迁移。
 *
 * 能力：
 * - 组件按 id 合并更新（浅比较跳过未变化项）
 * - DataModel 增量更新（JSON Pointer 路径）
 * - 快照/恢复（会话持久化）
 * - sendDataModel 载荷导出
 * - callFunction 边界检查（callableFrom）
 */

import { signal } from '@preact/signals-core';
import { z } from 'zod';
import { setAtPath, deleteAtPath } from '../processing/data-binding.js';
import { callFunction, getFunctionCallableFrom } from '../processing/function-call.js';
import { createRendererLogger } from '../common/logger.js';
const logger = createRendererLogger('surface-manager');

export const a2uIDescriptorSchema = z.object({ id: z.string(), component: z.string() }).catchall(z.unknown());
export type A2UIDescriptor = z.infer<typeof a2uIDescriptorSchema>;

export const surfaceSchema = z.object({
  surfaceId: z.string(),
  catalogId: z.string().optional(),
  components: z.array(a2uIDescriptorSchema),
  dataModel: z.record(z.string(), z.unknown()),
  sendDataModel: z.boolean().optional(),
});
export type Surface = z.infer<typeof surfaceSchema>;

export function findRootComponent(components: A2UIDescriptor[]): A2UIDescriptor | null {
  return components.find((c) => c.id === 'root') ?? null;
}

export class SurfaceManager {
  surfaces = signal<Map<string, Surface>>(new Map());

  handleCreateSurface(surfaceId: string, catalogId?: string, sendDataModel?: boolean): boolean {
    logger.debug('handleCreateSurface', { surfaceId, catalogId });

    const current = this.surfaces.value;
    if (current.has(surfaceId)) {
      logger.debug('⚠ 重复 surfaceId', { surfaceId });
      return false;
    }
    const surface: Surface = {
      surfaceId,
      catalogId,
      components: [],
      dataModel: {},
      sendDataModel,
    };
    const newMap = new Map(current);
    newMap.set(surfaceId, surface);
    this.surfaces.value = newMap;
    logger.debug('Surface 已创建', { surfaceId, totalSurfaces: newMap.size });
    return true;
  }

  handleUpdateComponents(surfaceId: string, components: A2UIDescriptor[]): void {
    logger.debug('handleUpdateComponents', { surfaceId, componentCount: components?.length || 0 });
    if (!components || components.length === 0) return;

    const current = this.surfaces.value;
    const surface = current.get(surfaceId);
    if (!surface) {
      logger.debug('Surface 不存在', { surfaceId });
      return;
    }

    const existingMap = new Map(surface.components.map((c) => [c.id, c]));
    const newIds: string[] = [];
    const updatedIds: string[] = [];
    const skippedIds: string[] = [];

    for (const comp of components) {
      if (existingMap.has(comp.id)) {
        const existing = existingMap.get(comp.id)!;
        if (!this._hasChanged(existing, comp)) {
          skippedIds.push(comp.id);
          continue;
        }
        updatedIds.push(comp.id);
      } else {
        newIds.push(comp.id);
      }
      existingMap.set(comp.id, comp);
    }
    const merged = [...existingMap.values()];

    logger.debug('组件已合并', {
      surfaceId,
      totalCount: merged.length,
      newCount: newIds.length,
      updatedCount: updatedIds.length,
      skippedCount: skippedIds.length,
    });

    const newMap = new Map(current);
    newMap.set(surfaceId, { ...surface, components: merged });
    this.surfaces.value = newMap;
  }

  handleUpdateDataModel(surfaceId: string, path?: string, value?: unknown): void {
    logger.debug('handleUpdateDataModel', { surfaceId, path: path || '/', hasValue: value !== undefined });
    const current = this.surfaces.value;
    const surface = current.get(surfaceId);
    if (!surface) {
      logger.debug('Surface 不存在', { surfaceId });
      return;
    }

    // 不可变更新：深拷贝 dataModel 后再写入，避免原地 mutate 破坏快照语义与
    // 响应式变更检测（Surface 对象本身也新建，保证 signal 触发）
    const nextDataModel = structuredClone(surface.dataModel);
    if (value === null || value === undefined) {
      if (path) {
        deleteAtPath(nextDataModel, path);
      } else {
        for (const key of Object.keys(nextDataModel)) delete nextDataModel[key];
      }
    } else if (value !== undefined) {
      setAtPath(nextDataModel, path || '/', value);
    }

    const newMap = new Map(current);
    newMap.set(surfaceId, { ...surface, dataModel: nextDataModel });
    this.surfaces.value = newMap;
  }

  handleDeleteSurface(surfaceId: string): boolean {
    const current = this.surfaces.value;
    if (!current.has(surfaceId)) return false;
    const newMap = new Map(current);
    newMap.delete(surfaceId);
    this.surfaces.value = newMap;
    logger.debug('Surface 已删除', { surfaceId, remainingCount: newMap.size });
    return true;
  }

  clear(): void {
    const count = this.surfaces.value.size;
    this.surfaces.value = new Map();
    logger.debug('清除所有 Surface', { clearedCount: count });
  }

  snapshot(): Surface[] {
    return [...this.surfaces.value.values()].map((s) => structuredClone(s));
  }

  restore(surfaces: Surface[]): void {
    const map = new Map<string, Surface>();
    for (const s of surfaces) {
      map.set(s.surfaceId, structuredClone(s));
    }
    this.surfaces.value = map;
    logger.debug('从快照恢复', { surfaceCount: map.size });
  }

  getSendDataModelPayload(): Record<string, unknown> | undefined {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [id, surface] of this.surfaces.value) {
      if (surface.sendDataModel) {
        result[id] = surface.dataModel;
      }
    }
    return Object.keys(result).length > 0 ? { version: 'v1.0', surfaces: result } : undefined;
  }

  getComponentMap(surface: Surface): Map<string, A2UIDescriptor> {
    const map = new Map<string, A2UIDescriptor>();
    for (const comp of surface.components) {
      map.set(comp.id, comp);
    }
    return map;
  }

  handleCallRendererFunction(
    call: {
      functionCallId: string;
      call: string;
      catalogId: string;
      args?: Record<string, unknown>;
    },
    onResponse?: (response: {
      functionCallId: string;
      value?: unknown;
      error?: { code: string; message: string };
    }) => void,
  ): void {
    if (!onResponse) return;

    const callableFrom = getFunctionCallableFrom(call.call, call.catalogId);
    if (!callableFrom) {
      onResponse({
        functionCallId: call.functionCallId,
        error: {
          code: 'INVALID_FUNCTION_CALL',
          message: `Function '${call.call}' is not registered in catalog '${call.catalogId}'.`,
        },
      });
      return;
    }
    if (callableFrom === 'rendererOnly') {
      onResponse({
        functionCallId: call.functionCallId,
        error: { code: 'INVALID_FUNCTION_CALL', message: `Function '${call.call}' is rendererOnly.` },
      });
      return;
    }

    try {
      const result = callFunction({ call: call.call, catalogId: call.catalogId, args: call.args }, {}, 0, {
        caller: 'agent',
      });
      onResponse({ functionCallId: call.functionCallId, value: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onResponse({
        functionCallId: call.functionCallId,
        error: { code: 'FUNCTION_EXECUTION_ERROR', message },
      });
    }
  }

  private _hasChanged(a: A2UIDescriptor, b: A2UIDescriptor): boolean {
    const aKeys = Object.keys(a)
      .filter((k) => k !== 'id')
      .sort();
    const bKeys = Object.keys(b)
      .filter((k) => k !== 'id')
      .sort();
    if (aKeys.length !== bKeys.length) return true;
    for (const key of aKeys) {
      if (!bKeys.includes(key)) return true;
      if (a[key] !== b[key]) return true;
    }
    return false;
  }
}
