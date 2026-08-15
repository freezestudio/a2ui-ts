/**
 * @a2ui/agent — A2UI LLM 客户端
 *
 * 提供 LLM 生成器抽象（Generator）与 DeepSeek/Ollama 具体实现，
 * 供 a2ui-eval-test 评测框架调用。
 *
 * 原核心抽象（Generator/TestPrompt/ModelConfig/GeneratedResult）下沉自
 * a2ui-eval-test，打破 agent ↔ eval-test 的循环依赖。
 */
export { Generator } from './generator.js';
export type { TestPrompt, ModelConfig, GeneratedResult } from './types.js';
export { DeepSeekGenerator } from './deepseek-generator.js';
export { OllamaGenerator } from './ollama-generator.js';
export { sharedSchemaManager } from './schema-manager.js';
