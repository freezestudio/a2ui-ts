/**
 * A2UI LLM 客户端核心类型
 *
 * 本模块定义 LLM 生成器的核心抽象类型（原属 a2ui-eval-test）。
 * 下沉到 agent 包是为了打破 agent ↔ eval-test 的循环依赖：
 * agent（底层 LLM 客户端）定义生成器抽象，eval-test（应用层框架）依赖 agent。
 */

// ============================================================================
// Prompt 类型
// ============================================================================

/** 评测/生成 Prompt */
export interface TestPrompt {
  /** Prompt 名称（唯一标识） */
  name: string;
  /** 描述 */
  description: string;
  /** 发送给 LLM 的 prompt 文本 */
  promptText: string;
}

// ============================================================================
// 生成结果类型
// ============================================================================

/** 生成阶段结果 */
export interface GeneratedResult {
  /** 模型名称 */
  modelName: string;
  /** 使用的 prompt */
  prompt: TestPrompt;
  /** 第几次运行（从 1 开始） */
  runNumber: number;
  /** LLM 原始输出文本 */
  rawText: string;
  /** 解析出的 A2UI 消息数组 */
  components: unknown[];
  /** 延迟（毫秒） */
  latency: number;
  /** 生成过程中的错误信息 */
  error?: string;
}

// ============================================================================
// 模型配置
// ============================================================================

/** 模型配置 */
export interface ModelConfig {
  /** 显示名称 */
  name: string;
  /** 提供商 */
  provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'ollama';
  /** 模型 ID（API 调用时使用） */
  modelName: string;
  /** 最大输出 token */
  maxTokens: number;
  /** 采样温度 */
  temperature: number;
}
