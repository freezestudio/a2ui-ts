/**
 * Catalog 泛型容器
 * 对应 Python: catalog/catalog.py
 * 对应 agent_sdk_guide.md 中的 A2uiCatalog
 */

import type { ComponentApi, FunctionApi, FunctionContext } from './types.js';
import {
  validateComponentProps,
  validateValue,
  normalizeCatalogSchema,
  extractFunctionArgsSchema,
  type ComponentValidationIssue,
} from './component-validator.js';
import { SURFACE_COMPONENT, type CompositionConstraints } from '../schema/composition-checker.js';

// ============================================================================
// Catalog 类
// ============================================================================

// export const basic_catalog_id = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/**
 * A2UI Catalog — 管理组件和函数定义的容器
 *
 * 设计遵循 agent_sdk_guide.md 中的架构：
 * - 持有组件 API 映射表和函数 API 映射表
 * - 支持按允许列表裁剪（节省 tokens）
 * - 支持生成 LLM 指令描述
 */
export class Catalog {
  /**
   * Catalog 标识符
   * default: basic_catalog_id
   */
  readonly catalogId: string;

  /** Catalog 版本 'v1_0'*/
  readonly version: string;

  /** 组件映射表（按名称索引） */
  private _components: Map<string, ComponentApi>;

  /** 函数映射表（按名称精确索引） */
  private _functions: Map<string, FunctionApi>;

  constructor(options: { catalogId: string; version: string; components: ComponentApi[]; functions: FunctionApi[] }) {
    this.catalogId = options.catalogId;
    this.version = options.version;
    this._components = new Map();
    this._functions = new Map();

    for (const comp of options.components) {
      this._components.set(comp.name, comp);
    }
    for (const fn of options.functions) {
      this._functions.set(fn.name, fn);
    }
  }

  // ==========================================================================
  // 组件访问
  // ==========================================================================

  /** 获取所有组件名称 */
  getComponentNames(): string[] {
    return [...this._components.keys()];
  }

  /** 获取组件 API */
  getComponent(name: string): ComponentApi | undefined {
    return this._components.get(name);
  }

  /** 获取所有组件 */
  getComponents(): Map<string, ComponentApi> {
    return this._components;
  }

  /** 组件数量 */
  get componentCount(): number {
    return this._components.size;
  }

  // ==========================================================================
  // 函数访问
  // ==========================================================================

  /** 获取函数 API（v1.0 函数名区分大小写） */
  getFunction(name: string): FunctionApi | undefined {
    return this._functions.get(name);
  }

  /** 获取所有函数 */
  getFunctions(): FunctionApi[] {
    return [...this._functions.values()];
  }

  /** 获取所有函数名称 */
  getFunctionNames(): string[] {
    return [...this._functions.values()].map((fn) => fn.name);
  }

  /** 函数数量 */
  get functionCount(): number {
    return this._functions.size;
  }

  /** 执行函数 */
  executeFunction(name: string, args: Record<string, unknown>, context: FunctionContext = {}): unknown {
    const fn = this.getFunction(name);
    if (!fn) {
      throw new Error(`函数未找到: ${name}`);
    }
    if (!fn.execute) {
      throw new Error(`函数 ${name} 没有执行实现`);
    }
    // requiresUserActivation 门禁（对齐上游 user_initiated_functions 提案）：
    // 非用户激活 Action 上下文（布局渲染/插值/被动事件/agent 直接调用）一律拒绝
    if (fn.requiresUserActivation) {
      const isActivated = context.isExecutingAction === true && context.actionIntent === 'activation';
      if (!isActivated) {
        throw new Error(
          `Execution blocked: Function '${name}' requires a user activation Action context ` +
            `(e.g. click, tap, submit). It cannot be executed during layout rendering, interpolation, ` +
            `passive events (blur/change), or agent invocation.`,
        );
      }
    }
    // 运行时参数校验（对齐上游 catalog_schema_validator.validate_function）
    if (fn.argsSchema) {
      const result = fn.argsSchema.safeParse(args);
      if (!result.success) {
        const details = result.error.issues
          .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
          .join('; ');
        throw new Error(`函数 ${name} 参数校验失败: ${details}`);
      }
    }
    return fn.execute(args, context);
  }

  // ==========================================================================
  // 组件属性校验
  // ==========================================================================

  /**
   * 校验组件属性是否符合 catalog 中对应组件的 Schema
   * v1.0 规范：renderer 必须按 catalog 定义校验组件属性
   *
   * @param comp - 组件对象（含 component 类型与特定属性）
   * @returns 校验问题列表，空数组表示通过
   */
  validateComponent(comp: Record<string, unknown>): ComponentValidationIssue[] {
    const name = comp['component'];
    if (typeof name !== 'string') {
      return [{ path: '/component', message: '组件缺少 component 类型字段' }];
    }
    const api = this._components.get(name);
    if (!api) {
      return [{ path: '/component', message: `组件 "${name}" 不在 catalog ${this.catalogId} 中` }];
    }
    return validateComponentProps(comp, api.schema);
  }

  /**
   * 校验函数是否可由 Agent 远程调用（callableFrom 执行边界）
   * v1.0 规范：未注册或 rendererOnly 的函数必须拒绝 agent 调用
   *
   * @param name - 函数名称
   * @returns 边界类型；函数未注册时返回 undefined
   */
  getFunctionCallableFrom(name: string): 'rendererOnly' | 'agentOnly' | 'rendererOrAgent' | undefined {
    const fn = this.getFunction(name);
    return fn?.callableFrom;
  }

  /**
   * 获取组件的组合约束（allowedParents / allowedChildren）
   * v1.0 规范（上游 d849f485）：组件 schema 顶层可声明可选约束，缺省允许所有父/子类型
   *
   * @param name - 组件类型名
   * @returns 组合约束；组件不存在或未声明约束时返回 undefined
   */
  getCompositionConstraints(name: string): CompositionConstraints | undefined {
    const api = this._components.get(name);
    if (!api) return undefined;
    const schema = api.schema as Record<string, unknown>;
    const allowedParents = schema['allowedParents'];
    const allowedChildren = schema['allowedChildren'];
    if (!Array.isArray(allowedParents) && !Array.isArray(allowedChildren)) return undefined;
    return {
      ...(Array.isArray(allowedParents) ? { allowedParents: allowedParents as string[] } : {}),
      ...(Array.isArray(allowedChildren) ? { allowedChildren: allowedChildren as string[] } : {}),
    };
  }

  // ==========================================================================
  // 裁剪
  // ==========================================================================

  /**
   * 按允许列表裁剪 Catalog
   * 返回一个新的 Catalog，仅包含指定的组件和函数
   * 对应 agent_sdk_guide.md 中的 "Prune Schemas" 功能
   */
  /**
   * 校验函数调用是否符合 catalog 中对应函数的 Schema。
   *
   * @param call - wire-level FunctionCall（{call, catalogId?, args?}）
   * @returns 校验问题列表，空数组表示通过
   */
  validateFunctionCall(call: Record<string, unknown>): ComponentValidationIssue[] {
    const issues: ComponentValidationIssue[] = [];
    const name = call['call'];
    if (typeof name !== 'string') {
      return [{ path: '/call', message: '函数调用缺少 call 字段' }];
    }
    const fn = this.getFunction(name);
    if (!fn) {
      return [{ path: '/call', message: `函数 "${name}" 不在 catalog ${this.catalogId} 中` }];
    }
    if (call['catalogId'] !== undefined) {
      validateValue({ type: 'string' }, call['catalogId'], '/catalogId', issues);
    }
    const args = call['args'];
    if (args === undefined) return issues;
    validateValue(normalizeCatalogSchema(fn.parameters as Record<string, unknown>), args, '/args', issues);
    return issues;
  }

  prune(options: { allowedComponents?: string[]; allowedFunctions?: string[] }): Catalog {
    const { allowedComponents, allowedFunctions } = options;

    let components: ComponentApi[];
    if (Array.isArray(allowedComponents) && allowedComponents.length > 0) {
      const allowedSet = new Set(allowedComponents);
      components = [...this._components.values()].filter((c) => allowedSet.has(c.name));
    } else {
      components = [...this._components.values()];
    }

    let functions: FunctionApi[];
    if (allowedFunctions) {
      const allowedSet = new Set(allowedFunctions);
      functions = [...this._functions.values()].filter((f) => allowedSet.has(f.name));
    } else {
      functions = [...this._functions.values()];
    }

    return new Catalog({
      catalogId: this.catalogId,
      version: this.version,
      components,
      functions,
    });
  }

  // ==========================================================================
  // LLM 指令渲染
  // ==========================================================================

  /**
   * 生成 LLM 指令描述
   * 将 Catalog 的组件和函数信息渲染为 Markdown 格式
   * 对应 agent_sdk_guide.md 中的 renderAsLlmInstructions
   */
  renderAsLlmInstructions(options?: { includeSchema?: boolean; indent?: string }): string {
    const { includeSchema = true, indent = '' } = options ?? {};
    const lines: string[] = [];

    // 组件部分
    lines.push(`${indent}## 可用组件`);
    lines.push('');

    for (const comp of this._components.values()) {
      lines.push(`${indent}### ${comp.name}`);
      if (comp.description) {
        lines.push(`${indent}${comp.description}`);
      }

      if (includeSchema && comp.schema) {
        const properties = (comp.schema as Record<string, unknown>).properties;
        if (properties && typeof properties === 'object') {
          lines.push(`${indent}属性：`);
          for (const [key, propSchema] of Object.entries(properties as Record<string, Record<string, unknown>>)) {
            if (key === 'id' || key === 'component') continue;
            const type = propSchema.type ?? 'any';
            const desc = propSchema.description ?? '';
            const typeStr = String(type as string | number | bigint | symbol);
            const descStr = String(desc as string | number | bigint | symbol);
            const required = ((comp.schema as Record<string, unknown>).required as string[])?.includes(key) ?? false;
            const reqMark = required ? '（必填）' : '';
            lines.push(`${indent}- \`${key}\` (${typeStr})${reqMark}: ${descStr}`);
          }
        }
      }
      lines.push('');
    }

    // 函数部分
    if (this._functions.size > 0) {
      lines.push(`${indent}## 可用函数`);
      lines.push('');

      for (const fn of this._functions.values()) {
        lines.push(`${indent}### ${fn.name}`);
        if (fn.description) {
          lines.push(`${indent}${fn.description}`);
        }

        if (includeSchema && fn.parameters) {
          const props = fn.parameters.properties as Record<string, Record<string, unknown>> | undefined;
          if (props) {
            lines.push(`${indent}参数：`);
            for (const [key, param] of Object.entries(props)) {
              const type = param.type ?? 'any';
              const desc = param.description ?? '';
              const typeStr = String(type as string | number | bigint | symbol);
              const descStr = String(desc as string | number | bigint | symbol);
              lines.push(`${indent}- \`${key}\` (${typeStr}): ${descStr}`);
            }
          }
          if (fn.requiresUserActivation) {
            lines.push(
              `${indent}⚠ 需用户激活：仅在用户交互（click/tap/submit）触发的 Action 中执行，布局渲染/插值/agent 调用会被拒绝`,
            );
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // 静态方法：从 JSON 构建
  // ==========================================================================

  /**
   * 从原始 JSON Catalog 数据构建 Catalog 实例
   * 解析 components 和 functions 定义
   */
  static fromJson(data: {
    catalogId?: string;
    $id?: string;
    protocolVersion?: string;
    version?: string;
    components?: Record<string, Record<string, unknown>>;
    functions?: Record<string, Record<string, unknown>>;
    $defs?: Record<string, unknown>;
  }): Catalog {
    const catalogId = data.catalogId ?? data.$id ?? 'unknown';
    const UAX31 = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

    if (data.$defs) {
      for (const key of Object.keys(data.$defs)) {
        if (key !== 'anyComponent' && key !== 'anyFunction') {
          throw new Error(`Catalog "${catalogId}" 的 $defs 只允许 anyComponent/anyFunction，发现 "${key}"`);
        }
      }
    }

    const components: ComponentApi[] = [];
    if (data.components) {
      for (const [name, schema] of Object.entries(data.components)) {
        if (!UAX31.test(name)) {
          throw new Error(`Catalog "${catalogId}" 的组件名 "${name}" 不符合 UAX #31`);
        }
        if (name === SURFACE_COMPONENT) {
          throw new Error(`Catalog "${catalogId}" 定义了协议保留组件名 "${SURFACE_COMPONENT}"（禁止）`);
        }
        const description = schema.description as string | undefined;
        components.push({ name, schema: normalizeCatalogSchema(schema), description });
      }
    }

    const functions: FunctionApi[] = [];
    if (data.functions) {
      for (const [funcKey, schema] of Object.entries(data.functions)) {
        if (!UAX31.test(funcKey)) {
          throw new Error(`Catalog "${catalogId}" 的函数名 "${funcKey}" 不符合 UAX #31`);
        }
        const description = schema.description as string | undefined;
        const parameters = extractFunctionArgsSchema(schema);
        const rawReturnType = schema['returnType'];
        const rawCallableFrom = schema['callableFrom'];
        const rawRequiresActivation = schema['requiresUserActivation'];

        functions.push({
          name: funcKey,
          parameters,
          description,
          returnType:
            rawReturnType === 'string' ||
            rawReturnType === 'number' ||
            rawReturnType === 'boolean' ||
            rawReturnType === 'array' ||
            rawReturnType === 'object' ||
            rawReturnType === 'validationResult' ||
            rawReturnType === 'any' ||
            rawReturnType === 'void'
              ? rawReturnType
              : undefined,
          callableFrom:
            rawCallableFrom === 'rendererOnly' ||
            rawCallableFrom === 'agentOnly' ||
            rawCallableFrom === 'rendererOrAgent'
              ? rawCallableFrom
              : rawCallableFrom === undefined
                ? 'rendererOnly'
                : undefined,
          requiresUserActivation: rawRequiresActivation === true,
        });
      }
    }

    return new Catalog({
      catalogId,
      version: data.protocolVersion ?? data.version ?? 'v1.0',
      components,
      functions,
    });
  }
}
