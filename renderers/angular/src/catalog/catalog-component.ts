import { Directive, computed, inject, input } from '@angular/core';
import { A2UIRendererService, type A2UIDescriptor, type Surface } from '../renderer/index.js';
import { ComponentBinder } from '../renderer/component-binder.js';

/**
 * CatalogComponent — 所有 Catalog 组件（basic/geo）的抽象基类
 *
 * 统一 descriptor 直读型接口：
 * - `component`：A2UI 组件描述对象（属性即数据，含 DataBinding/FunctionCall 动态值）
 * - `surface`：所属 Surface（提供 dataModel 上下文）
 *
 * 提供与 A2UIComponent 内联实现完全一致的响应式属性解析：
 * - `boundProps` 通过 ComponentBinder 绑定，DataModel 变化时自动重算
 * - `prop<T>()/propNum()/propBool()` 快捷读取
 * - `handleAction()` 交互事件（v1.0 renderer→agent action）
 * - `writeDataModel()` 双向绑定回写
 *
 * 继承关系：@Directive 基类 + 子类 @Component，input 信号可正常继承。
 */
@Directive()
export abstract class CatalogComponent {
  component = input.required<A2UIDescriptor>();
  surface = input.required<Surface>();
  /** 快照模式：传入已深拷贝的历史 surface，所有数据绑定/解析均基于该副本，
   *  不再回查实时 renderer（导出报告逐轮快照隔离用） */
  snapshotSurface = input<Surface | null>(null);

  protected renderer = inject(A2UIRendererService);
  private binder = inject(ComponentBinder);

  /** 实际作用的 surface：快照优先，否则回退实时 surface */
  protected activeSurface = computed<Surface>(() => this.snapshotSurface() ?? this.surface());

  /** 组件属性 → 响应式 BoundProperty 表（与内联实现同构） */
  protected boundProps = computed(() => {
    const comp = this.component();
    const prefix = comp['_dataPathPrefix'] as string | undefined;
    // 快照模式：直接基于克隆 surface 绑定（不回查实时 manager）
    return this.binder.bind(comp, this.activeSurface(), prefix);
  });

  /** 解析组件属性为实际值（响应式，支持 DataBinding/FunctionCall） */
  protected prop<T = unknown>(key: string): T {
    return (this.boundProps()[key]?.value() as T) ?? ('' as T);
  }

  /** 解析属性并转为数字 */
  protected propNum(key: string): number {
    return Number(this.boundProps()[key]?.value() ?? 0);
  }

  /** 解析属性并转为布尔 */
  protected propBool(key: string): boolean {
    return Boolean(this.boundProps()[key]?.value());
  }

  /** 直接解析动态值（非响应式，geo 图表等一次性解析场景） */
  protected resolveValue(value: unknown): unknown {
    return this.renderer.resolveDynamicValue(value, this.activeSurface());
  }

  /** 直接解析动态字符串 */
  protected resolveString(value: unknown): string {
    return this.renderer.resolveDynamicString(value, this.activeSurface());
  }

  /** 从当前 surface 按 id 查找子组件 */
  protected findChild(childId: unknown): A2UIDescriptor | null {
    if (typeof childId !== 'string') return null;
    return this.renderer.getComponentMap(this.activeSurface()).get(childId) ?? null;
  }

  /** 解析组件 `child` 属性引用的子组件 */
  protected childComponent = computed<A2UIDescriptor | null>(() => {
    const childId = this.component()['child'];
    return this.findChild(childId);
  });

  /** 组件 weight（flex-grow 值，用于布局） */
  protected weight(): string {
    const w = this.component()['weight'];
    return w === undefined || w === null ? '' : String(w as string | number | bigint | symbol);
  }

  /**
   * 无障碍属性（v1.0 ComponentCommon.accessibility）：解析 label/description/live/hidden 为
   * ARIA 属性映射。组件模板应绑定 [attr.aria-label] / [attr.aria-description] /
   * [attr.aria-live] / [attr.aria-hidden]。
   */
  protected accessibilityAttrs = computed<{
    'aria-label'?: string;
    'aria-description'?: string;
    'aria-live'?: 'off' | 'polite' | 'assertive';
    'aria-hidden'?: 'true' | 'false';
  }>(() => {
    const a11y = this.component()['accessibility'];
    if (!a11y || typeof a11y !== 'object') return {};
    const attrs: {
      'aria-label'?: string;
      'aria-description'?: string;
      'aria-live'?: 'off' | 'polite' | 'assertive';
      'aria-hidden'?: 'true' | 'false';
    } = {};
    const a11yObj = a11y as Record<string, unknown>;
    const label = a11yObj['label'];
    const description = a11yObj['description'];
    const live = a11yObj['live'];
    const hidden = a11yObj['hidden'];
    if (label !== undefined && label !== null) {
      const resolved = this.resolveString(label);
      if (resolved) attrs['aria-label'] = resolved;
    }
    if (description !== undefined && description !== null) {
      const resolved = this.resolveString(description);
      if (resolved) attrs['aria-description'] = resolved;
    }
    if (live === 'off' || live === 'polite' || live === 'assertive') {
      attrs['aria-live'] = live;
    }
    if (hidden !== undefined && hidden !== null) {
      attrs['aria-hidden'] = this.resolveValue(hidden) ? 'true' : 'false';
    }
    return attrs;
  });

  /**
   * 处理组件交互（v1.0 action 事件）
   *
   * 委托 A2UIRendererService.handleComponentAction：
   * - action.event → 解析 context，发送 renderer→agent action（单向）
   * - action.functionCall → 本地已注册函数渲染端本地执行（用户交互触发的激活 Action）；
   *   本地未注册函数视为 agent 端函数，发送 callAgentFunction，响应写回 dataModel
   */
  protected async handleAction(comp?: A2UIDescriptor): Promise<void> {
    const target = comp ?? this.component();
    await this.renderer.handleComponentAction(target, this.activeSurface());
  }

  /** 将值写回 DataModel（双向绑定，v1.0 updateDataModel 语义） */
  protected writeDataModel(path: unknown, value: unknown): void {
    if (typeof path !== 'string') return;
    // 快照模式只读：不写回实时状态
    if (this.snapshotSurface()) return;
    this.renderer.processMessage({
      version: 'v1.0',
      updateDataModel: {
        surfaceId: this.surface().surfaceId,
        path,
        value,
      },
    });
  }

  /** 从组件的 `value` 属性解析绑定的 DataModel 路径 */
  protected valuePath(): string | null {
    const binding = this.component()['value'];
    if (binding && typeof binding === 'object' && 'path' in binding) {
      return (binding as Record<string, unknown>)['path'] as string;
    }
    return null;
  }
}
