/**
 * A2UI Eval 类型定义
 * 适配 A2UI 规范评测系统的核心类型
 *
 * 核心抽象类型（TestPrompt / GeneratedResult / ModelConfig / Generator）
 * 已下沉到 @a2ui-ts/agent，此处 re-export 保持公共 API 兼容。
 */

import type { TestPrompt, GeneratedResult, ModelConfig } from '@a2ui-ts/agent';

export type { TestPrompt, GeneratedResult, ModelConfig } from '@a2ui-ts/agent';

// ============================================================================
// 结果类型（流水线三阶段）
// ============================================================================

/** 校验阶段结果 */
export interface ValidatedResult extends GeneratedResult {
  /** 校验错误列表 */
  validationErrors: ValidationResultError[];
}

/** 校验错误 */
export interface ValidationResultError {
  /** 错误路径 */
  path: string;
  /** 错误消息 */
  message: string;
}

/** 评测结果 */
export interface EvaluationResult {
  /** 是否通过 */
  pass: boolean;
  /** 通过/失败原因 */
  reason: string;
  /** 发现的问题 */
  issues: EvalIssue[];
  /** 最严重的问题级别 */
  severity: IssueSeverity;
}

/** 评测问题 */
export interface EvalIssue {
  /** 问题描述 */
  description: string;
  /** 问题级别 */
  severity: IssueSeverity;
  /** 涉及的组件 ID */
  componentId?: string;
}

/** 问题严重级别 */
export type IssueSeverity = 'minor' | 'significant' | 'critical' | 'criticalSchema';

/** 评测阶段结果 */
export interface EvaluatedResult extends ValidatedResult {
  /** 评测结果 */
  evaluationResult: EvaluationResult;
}

// ============================================================================
// 配置类型
// ============================================================================

/** 评测配置 */
export interface EvalConfig {
  /** 待评测模型列表 */
  models: ModelConfig[];
  /** 使用的 prompt 列表 */
  prompts: TestPrompt[];
  /** 每个 prompt 运行次数 */
  runsPerPrompt: number;
  /** 评测使用的模型（用于 LLM-as-judge） */
  evalModel?: ModelConfig;
  /** 输出目录 */
  outputDir: string;
}
