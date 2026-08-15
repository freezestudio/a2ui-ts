import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { Generator } from './generator.js';
import type { ModelConfig, TestPrompt } from './types.js';
import { sharedSchemaManager } from './schema-manager.js';

export class DeepSeekGenerator extends Generator {
  private schemaManager = sharedSchemaManager;

  constructor(options: { models: ModelConfig[]; prompts: TestPrompt[]; runsPerPrompt?: number }) {
    super(options);
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY 环境变量未设置');
    }
  }

  protected override async callLLM(prompt: string, modelConfig: ModelConfig): Promise<string> {
    const ds = deepseek(modelConfig.modelName ?? 'deepseek-v4-flash');
    const systemPrompt = await this.schemaManager.generateSystemPrompt({
      roleDescription: `你是一个 A2UI v1.0 协议专家。
根据用户需求生成符合规范的 A2UI JSON。
关键约束：
1. 组件通过 children/child 中的 ID 引用，禁止将文字直接放在 children 数组中
2. 数据绑定路径使用绝对 JSON Pointer（以 / 开头，如 /user/name）
3. 根据场景需求选择合适的消息类型：createSurface、updateComponents、updateDataModel、deleteSurface、callFunction、actionResponse
输出必须使用 <a2ui-json> 和 </a2ui-json> 标签包裹。`,
      includeSchema: true,
      includeExamples: true,
    });
    const result = await generateText({
      model: ds,
      system: systemPrompt,
      prompt,
    });
    return result.text;
  }
}
