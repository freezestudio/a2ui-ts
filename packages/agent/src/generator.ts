/**
 * A2UI 生成器抽象基类
 *
 * 定义调用 LLM 生成 A2UI 消息的通用流程：
 * - Generator 抽象基类 — 定义生成流程（子类实现 callLLM）
 * - 具体 LLM 生成器（DeepSeekGenerator / OllamaGenerator）继承并实现 callLLM
 *
 * 原属 a2ui-eval-test，下沉到 agent 包以打破 agent ↔ eval-test 循环依赖。
 */

import type { GeneratedResult, ModelConfig, TestPrompt } from './types.js';

/** 生成器抽象基类 */
export abstract class Generator {
  protected models: ModelConfig[];
  protected prompts: TestPrompt[];
  protected runsPerPrompt: number;

  constructor(options: { models: ModelConfig[]; prompts: TestPrompt[]; runsPerPrompt?: number }) {
    this.models = options.models;
    this.prompts = options.prompts;
    this.runsPerPrompt = options.runsPerPrompt ?? 1;
  }

  /** 调用 LLM（子类实现） */
  protected abstract callLLM(prompt: string, modelConfig: ModelConfig): Promise<string>;

  /** 执行生成流程 */
  async run(): Promise<GeneratedResult[]> {
    const results: GeneratedResult[] = [];

    for (const model of this.models) {
      for (const prompt of this.prompts) {
        for (let run = 1; run <= this.runsPerPrompt; run++) {
          const result = await this.generateSingle(prompt, model, run);
          results.push(result);
        }
      }
    }

    return results;
  }

  /** 生成单条结果 */
  private async generateSingle(prompt: TestPrompt, model: ModelConfig, runNumber: number): Promise<GeneratedResult> {
    const startTime = performance.now();

    try {
      const rawText = await this.callLLM(prompt.promptText, model);
      const latency = performance.now() - startTime;

      const components = this.extractComponents(rawText);

      return {
        modelName: model.name,
        prompt,
        runNumber,
        rawText,
        components,
        latency,
      };
    } catch (error) {
      const latency = performance.now() - startTime;
      return {
        modelName: model.name,
        prompt,
        runNumber,
        rawText: '',
        components: [],
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** 从原始文本中提取组件消息 */
  private extractComponents(rawText: string): unknown[] {
    const tagStart = rawText.indexOf('<a2ui-json>');
    const tagEnd = rawText.indexOf('</a2ui-json>');

    let jsonStr: string | null = null;
    if (tagStart !== -1 && tagEnd !== -1) {
      jsonStr = rawText.slice(tagStart + '<a2ui-json>'.length, tagEnd).trim();
    } else {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) jsonStr = match[0];
    }

    if (!jsonStr) return [];

    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.debug('[Generator] JSON 解析失败:', err);
      return [];
    }
  }
}
