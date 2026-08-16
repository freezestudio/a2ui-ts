/**
 * A2UI Schema Manager — 核心 prompt 装配器
 * 加载 JSON Schema 并生成 system prompt
 * 对应 Python: A2uiSchemaManager
 * 对应 agent_sdk_guide.md 中的 A2uiSchemaManager / InferenceStrategy
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { BasicCatalog, createBasicCatalog } from '../basic-catalog/index.js';
import { V10CapabilitiesSchema } from './renderer-capabilities.js';
import { getSchemaDir, getCatalogDir } from '../catalog/resource-path.js';

/**
 * Schema Manager 配置
 */
export const schemaManagerConfigSchema = z.object({
  /** A2UI 版本 */
  version: z.literal('v1_0'),
  /** 自定义 Catalog 路径（可选） */
  catalogPath: z.string().optional(),
});
export type SchemaManagerConfig = z.infer<typeof schemaManagerConfigSchema>;

/**
 * System Prompt 生成配置
 * 对应 agent_sdk_guide.md 中 InferenceStrategy.generateSystemPrompt 的参数
 */
export const generatePromptConfigSchema = z.object({
  /** Agent 角色描述 */
  roleDescription: z.string(),
  /** 工作流描述 */
  workflowDescription: z.string().optional(),
  /** UI 描述 */
  uiDescription: z.string().optional(),
  /** Renderer UI 能力（可选） */
  clientUiCapabilities: V10CapabilitiesSchema.optional(),
  /** 是否包含 JSON Schema（默认 true） */
  includeSchema: z.boolean().optional(),
  /**
   * 是否包含示例（默认 true）
   * TODO: 修改为 path to examples
   */
  includeExamples: z.boolean().optional(),
  /** 允许的组件类型列表（用于裁剪 Catalog） */
  allowedComponents: z.array(z.string()).optional(),
  /** 允许的函数名称列表 */
  allowedFunctions: z.array(z.string()).optional(),
});
export type GeneratePromptConfig = z.infer<typeof generatePromptConfigSchema>;

/**
 * Schema Manager
 */
export class A2uiSchemaManager {
  private serverToClientSchema: string | null = null;
  private commonTypesSchema: string | null = null;
  private catalogSchema: string | null = null;

  constructor() {}

  /**
   * 加载 JSON Schema
   */
  private async loadSchemas(): Promise<void> {
    if (this.serverToClientSchema && this.commonTypesSchema && this.catalogSchema) {
      return;
    }

    const schemaDir = getSchemaDir();

    /**
     * 加载模式文件 [agent-to-renderer, common-types, basic catalog]
     */
    try {
      const [agentToRenderer, commonTypes, catalog] = await Promise.all([
        readFile(`${schemaDir}/agent_to_renderer.json`, 'utf-8'),
        readFile(`${schemaDir}/common_types.json`, 'utf-8'),
        readFile(`${getCatalogDir()}/basic/catalog.json`, 'utf-8'),
      ]);

      this.serverToClientSchema = agentToRenderer;
      this.commonTypesSchema = commonTypes;
      this.catalogSchema = catalog;
    } catch (error) {
      throw new Error(`加载 JSON Schema 失败: ${String(error as string | number | bigint | symbol)}`);
    }
  }

  /**
   * 生成 System Prompt
   */
  async generateSystemPrompt(promptConfig: GeneratePromptConfig): Promise<string> {
    await this.loadSchemas();

    const {
      roleDescription,
      workflowDescription = '',
      uiDescription = '',
      clientUiCapabilities,
      includeSchema = true,
      includeExamples = true,
      allowedComponents,
      allowedFunctions,
    } = promptConfig;

    const sections: string[] = [];

    // 1. 角色描述
    sections.push('# 角色');
    sections.push(roleDescription);
    sections.push('');

    // 2. 工作流描述
    if (workflowDescription) {
      sections.push('# 工作流');
      sections.push(workflowDescription);
      sections.push('');
    }

    // 3. UI 生成规则
    sections.push('# UI 生成规则');
    sections.push(
      [
        '## 组件引用规则',
        '- 只有布局容器类组件使用 `children`/`child`：**Column, Row, List, Card, Tabs, Modal**',
        '- 所有其他组件（**Text, Icon, Image, Button, Divider, CheckBox, TextField, Slider, ChoicePicker, DateTimeInput, AudioPlayer, Video**）**绝对禁止**使用 `children` 或 `child` 字段',
        '  - ❌ 错误: `{ "id": "div1", "component": "Divider", "children": ["horizontal"] }` （Divider 没有 children）',
        '  - ❌ 错误: `{ "id": "icon1", "component": "Icon", "children": ["locationOn"] }` （Icon 用 name 属性）',
        '  - ❌ 错误: `{ "id": "picker", "component": "ChoicePicker", "children": ["zh"] }` （ChoicePicker 用 options 数组）',
        '  - ✅ 正确: `{ "id": "div1", "component": "Divider", "axis": "horizontal" }`',
        '  - ✅ 正确: `{ "id": "icon1", "component": "Icon", "name": "locationOn" }`',
        '  - ✅ 正确: `{ "id": "picker", "component": "ChoicePicker", "options": [{"label":"中文","value":"zh"}] }`',
        '',
        '- `children` 数组中只能放其他组件的 ID（字符串），**绝对禁止** 放文字内容、样式名、枚举值等',
        '',
        '## 数据绑定规则',
        '- 根作用域使用绝对 JSON Pointer（以 `/` 开头），如 `/user/name`',
        '- ChildList 模板实例内部可使用相对路径（如 `name` 解析为当前列表项 `/items/N/name`）',
        '',
        '## 消息类型规则',
        '- `createSurface` 用于初始化表面，可以包含内联组件和 dataModel',
        '- `updateComponents` 用于更新组件内容，与 `createSurface` 分开',
        '- `callRendererFunction` 让 Renderer 执行已注册的函数，必须提供 `functionCallId` 与 `callFunction`（含 `call` + `catalogId`）',
        '- `agentFunctionResponse` 响应 Renderer 发起的 `callAgentFunction` 请求，必须提供 `functionCallId`，以及 `value` 或 `error`',
        '',
        '## 多消息规则',
        '- 一个 `<a2ui-json>` 块中可以包含多条消息（数组元素），它们会按顺序处理',
        '- 典型顺序：先 createSurface，再 updateComponents（如果需要），再其他消息',
      ].join('\n'),
    );
    sections.push('');
    if (uiDescription) {
      sections.push(uiDescription);
      sections.push('');
    }

    // 4. Catalog Schema 描述（支持裁剪）
    let catalog = createBasicCatalog();
    if (allowedComponents || allowedFunctions) {
      catalog = catalog.prune({
        allowedComponents,
        allowedFunctions,
      });
    }
    // ## 可用组件描述
    const catalogDescription = catalog.renderAsLlmInstructions();
    sections.push(catalogDescription);
    sections.push('');

    // 5. Renderer 能力（如果提供）
    if (clientUiCapabilities) {
      sections.push('# Renderer UI 能力');
      if (clientUiCapabilities.supportedCatalogIds) {
        sections.push(`支持的 Catalog: ${clientUiCapabilities.supportedCatalogIds.join(', ')}`);
      }
      sections.push('');
    }

    // 6. JSON Schema（如果需要）
    if (includeSchema) {
      sections.push('# JSON Schema');
      sections.push('你必须严格遵循以下 JSON Schema 输出 A2UI 消息：');
      sections.push('');
      sections.push('## Agent to Renderer 消息格式');
      sections.push('```json');
      sections.push(this.serverToClientSchema!);
      sections.push('```');
      sections.push('');
      sections.push('## 通用类型');
      sections.push('```json');
      sections.push(this.commonTypesSchema!);
      sections.push('```');
      sections.push('');
      sections.push('## Basic Catalog');
      sections.push('```json');
      sections.push(this.catalogSchema!);
      sections.push('```');
      sections.push('');
    }

    // 7. 示例（如果需要）
    if (includeExamples) {
      sections.push('# 示例');
      sections.push(this.generateExamples());
      sections.push('');
    }

    // 8. 输出格式说明
    // 注意：不使用 ``` 包裹，避免与 LLMSaveLogger 的外层 ``` 形成嵌套冲突
    sections.push('# 输出格式');
    sections.push(
      '你必须在响应中包含 A2UI JSON，使用 `<a2ui-json>` 和 `</a2ui-json>` 标签包裹你的 A2UI 消息数组（每条消息必须包含 version: "v1.0" 字段）。',
    );
    sections.push('');
    sections.push('示例响应结构：');
    sections.push('');

    return sections.join('\n');
  }

  /**
   * 生成示例
   */
  private generateExamples(): string {
    return `## 示例 1：创建表面 + 初始化数据

\`\`\`json
[
  {
    "version": "v1.0",
    "createSurface": {
      "surfaceId": "dashboard-001",
      "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
      "components": [
        { "id": "root", "component": "Column", "children": ["header", "content"] },
        { "id": "header", "component": "Text", "text": "监测面板" },
        { "id": "content", "component": "Text", "text": "加载中..." }
      ],
      "dataModel": { "sensors": [], "threshold": 50 }
    }
  }
]
\`\`\`

## 示例 2：更新组件（正确做法：使用 ID 引用）

\`\`\`json
[
  {
    "version": "v1.0",
    "updateComponents": {
      "surfaceId": "dashboard-001",
      "components": [
        {
          "id": "root",
          "component": "Column",
          "children": ["title-id", "desc-id"]
        },
        {
          "id": "title-id",
          "component": "Text",
          "variant": "body",
          "text": "数据分析报告"
        },
        {
          "id": "desc-id",
          "component": "Text",
          "variant": "body",
          "text": "共采集 120 组数据，整体趋势平稳。"
        }
      ]
    }
  }
]
\`\`\`
注意：children 数组中只能引用其他组件的 ID，不能直接放文字。

## 示例 3：更新数据模型（使用绝对路径）

\`\`\`json
[
  {
    "version": "v1.0",
    "updateDataModel": {
      "surfaceId": "dashboard-001",
      "path": "/sensors",
      "value": [
        { "name": "位移计-A1", "value": 2.3 }
      ]
    }
  }
]
\`\`\`
注意：path 必须以 / 开头，是绝对 JSON Pointer 路径。

## 示例 4：callRendererFunction — 调用 rendererOrAgent 自定义函数

\`\`\`json
[
  {
    "version": "v1.0",
    "callRendererFunction": {
      "functionCallId": "call-screen-001",
      "callFunction": {
        "call": "getScreenResolution",
        "catalogId": "https://example.com/a2ui/v1.0/device-catalog.json",
        "args": {
          "screenIndex": 0
        }
      }
    }
  }
]
\`\`\`
注意：basic catalog 的 14 个函数均为 rendererOnly，不能通过 callRendererFunction 调用；
只有目标 catalog 中声明 callableFrom 为 agentOnly 或 rendererOrAgent 的函数才可被 Agent 调用。

## 示例 5：agentFunctionResponse — 响应 Renderer 发起的函数调用

\`\`\`json
[
  {
    "version": "v1.0",
    "agentFunctionResponse": {
      "functionCallId": "call-agent-fn-001",
      "value": {
        "status": "success",
        "message": "表单已提交"
      }
    }
  }
]
\`\`\`
functionCallId 必须与 Renderer 发送的 callAgentFunction.functionCallId 匹配，value 和 error 二选一。

## 示例 6：deleteSurface

\`\`\`json
[
  {
    "version": "v1.0",
    "deleteSurface": {
      "surfaceId": "temp-surface"
    }
  }
]
\`\`\``;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.serverToClientSchema = null;
    this.commonTypesSchema = null;
    this.catalogSchema = null;
    BasicCatalog.clearCache();
  }
}

/**
 * 创建默认 Schema Manager
 */
export function createSchemaManager(): A2uiSchemaManager {
  return new A2uiSchemaManager();
}
