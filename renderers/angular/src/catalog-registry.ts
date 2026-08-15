import { Injectable, Type } from '@angular/core';

/**
 * 组件属性 Schema 的结构类型（跨包使用，避免 zod 类型实例身份冲突）
 */
export interface ComponentSchemaLike {
  safeParse(input: unknown): { success: boolean; error?: unknown };
}

/**
 * 组件注册信息
 *
 * schema 字段对齐上游 5be36dbf `createComponentImplementation(api, component)`
 * 的语义：组件实现与属性 Schema 配对，供属性级校验与渲染绑定使用。
 */
export interface ComponentRegistration {
  type: string;
  componentClass: Type<unknown>;
  schema?: ComponentSchemaLike;
}

/**
 * CatalogRegistry — 组件动态发现与注册服务
 *
 * 管理组件类型名到 Angular Component Class 的映射，
 * 替代 a2ui-component.ts 中的 @switch 硬编码分发。
 */
@Injectable({ providedIn: 'root' })
export class CatalogRegistry {
  private catalogMap = new Map<string, ComponentRegistration[]>();

  /**
   * 注册 Catalog 下的组件列表
   */
  register(catalogId: string, components: ComponentRegistration[]): void {
    const existing = this.catalogMap.get(catalogId) ?? [];
    // 幂等：按 type 去重，避免路由来回切换时同一 Catalog 被重复追加（数组无限增长）
    const seen = new Set(existing.map((r) => r.type));
    const merged = [...existing];
    for (const comp of components) {
      if (!seen.has(comp.type)) {
        seen.add(comp.type);
        merged.push(comp);
      }
    }
    this.catalogMap.set(catalogId, merged);
  }

  /**
   * 解析指定 Catalog 中的组件类型
   * @returns 组件类，未注册时返回 null
   */
  resolve(catalogId: string, componentType: string): Type<unknown> | null {
    const catalog = this.catalogMap.get(catalogId);
    if (!catalog) return null;
    const registration = catalog.find((r) => r.type === componentType);
    return registration?.componentClass ?? null;
  }

  /**
   * 获取指定 Catalog 中组件的属性 Schema
   * @returns 组件 Schema，未注册时返回 undefined
   */
  resolveSchema(catalogId: string, componentType: string): ComponentSchemaLike | undefined {
    const catalog = this.catalogMap.get(catalogId);
    if (!catalog) return undefined;
    const registration = catalog.find((r) => r.type === componentType);
    return registration?.schema;
  }

  /**
   * 获取指定 Catalog 中所有已注册组件
   */
  getComponents(catalogId: string): ComponentRegistration[] {
    return this.catalogMap.get(catalogId) ?? [];
  }

  /**
   * 获取所有已注册的 Catalog ID
   */
  getCatalogIds(): string[] {
    return [...this.catalogMap.keys()];
  }
}
