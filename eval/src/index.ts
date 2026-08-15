/**
 * A2UI Eval 包 — 公共 API 导出
 */

export type {
  TestPrompt,
  GeneratedResult,
  ValidatedResult,
  EvaluatedResult,
  EvaluationResult,
  EvalIssue,
  IssueSeverity,
  ModelConfig,
  EvalConfig,
  ValidationResultError,
} from './types.js';

export { Validator } from './validator.js';
export { Generator, MockGenerator } from './generator.js';
export { Evaluator, RuleBasedEvaluator } from './evaluator.js';
export { prompts } from './prompts.js';

// ============================================================================
// runEval — 便捷封装
// ============================================================================

import type { EvalConfig, EvaluatedResult } from './types.js';
import { MockGenerator } from './generator.js';
import { Validator } from './validator.js';
import { RuleBasedEvaluator } from './evaluator.js';

/** 一键运行完整评测流水线 */
export async function runEval(config: EvalConfig): Promise<EvaluatedResult[]> {
  const generator = new MockGenerator({
    models: config.models,
    prompts: config.prompts,
    runsPerPrompt: config.runsPerPrompt,
  });
  const generated = await generator.run();

  const validator = new Validator();
  const validated = await validator.run(generated);

  const evaluator = new RuleBasedEvaluator(config.evalModel);
  return evaluator.run(validated);
}
