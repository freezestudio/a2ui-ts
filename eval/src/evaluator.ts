/**
 * A2UI Eval 评测器
 * 对校验后的结果进行质量评测
 *
 * 架构：
 * - Evaluator 抽象基类 — 定义评测流程
 * - RuleBasedEvaluator — 基于规则的评测（无需 LLM）
 * - LLM 评测器需继承 Evaluator 实现 evaluateWithLLM 方法
 */

import type {
  EvalIssue,
  EvaluatedResult,
  EvaluationResult,
  IssueSeverity,
  ModelConfig,
  ValidatedResult,
} from './types.js';

// ============================================================================
// Evaluator 抽象基类
// ============================================================================

export abstract class Evaluator {
  protected evalModel?: ModelConfig;

  constructor(evalModel?: ModelConfig) {
    this.evalModel = evalModel;
  }

  /** 使用 LLM 评测（子类实现） */
  protected abstract evaluateWithLLM(
    originalPrompt: string,
    generatedOutput: string,
    evalModel: ModelConfig,
  ): Promise<EvaluationResult>;

  /** 执行评测 */
  async run(results: ValidatedResult[]): Promise<EvaluatedResult[]> {
    const evaluated: EvaluatedResult[] = [];

    for (const result of results) {
      const evalResult = await this.evaluateSingle(result);
      evaluated.push({ ...result, evaluationResult: evalResult });
    }

    return evaluated;
  }

  /** 评测单条结果 */
  protected abstract evaluateSingle(result: ValidatedResult): Promise<EvaluationResult>;
}

// ============================================================================
// RuleBasedEvaluator — 基于规则的评测
// ============================================================================

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  minor: 0,
  significant: 1,
  critical: 2,
  criticalSchema: 3,
};

function maxSeverity(issues: EvalIssue[]): IssueSeverity {
  if (issues.length === 0) return 'minor';
  let max: IssueSeverity = 'minor';
  for (const issue of issues) {
    if (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[max]) {
      max = issue.severity;
    }
  }
  return max;
}

export class RuleBasedEvaluator extends Evaluator {
  /** LLM 评测方法 — RuleBasedEvaluator 不使用 LLM */
  protected async evaluateWithLLM(
    _originalPrompt: string,
    _generatedOutput: string,
    _evalModel: ModelConfig,
  ): Promise<EvaluationResult> {
    return { pass: true, reason: 'N/A', issues: [], severity: 'minor' };
  }

  protected async evaluateSingle(result: ValidatedResult): Promise<EvaluationResult> {
    const issues: EvalIssue[] = [];

    // 规则 1：是否有生成错误
    if (result.error) {
      issues.push({
        description: `生成阶段出错: ${result.error}`,
        severity: 'critical',
      });
    }

    // 规则 2：组件是否为空
    if (result.components.length === 0) {
      issues.push({
        description: '未生成任何 A2UI 消息',
        severity: 'critical',
      });
    }

    // 规则 3：是否包含 createSurface 消息
    const hasCreateSurface = this.hasMessageOfType(result.components, 'createSurface');
    if (!hasCreateSurface) {
      issues.push({
        description: '缺少 createSurface 消息',
        severity: 'critical',
      });
    }

    // 规则 4：是否包含 updateComponents 消息
    const hasUpdateComponents = this.hasMessageOfType(result.components, 'updateComponents');
    if (!hasUpdateComponents) {
      issues.push({
        description: '缺少 updateComponents 消息',
        severity: 'critical',
      });
    }

    // 规则 5：检查 root 组件是否存在
    const hasRoot = this.hasRootComponent(result.components);
    if (!hasRoot && hasUpdateComponents) {
      issues.push({
        description: '缺少 root 组件 (id="root")',
        severity: 'critical',
      });
    }

    // 规则 6：校验错误 → 评测问题
    for (const verr of result.validationErrors) {
      const severity = this.validationErrorToSeverity(verr.message);
      issues.push({
        description: `校验错误: ${verr.message}`,
        severity,
        componentId: verr.path ? this.extractComponentId(verr.path) : undefined,
      });
    }

    // 规则 7：检查 prompt 覆盖度
    const coverageIssues = this.checkPromptCoverage(result);
    issues.push(...coverageIssues);

    const pass = issues.every((i) => i.severity === 'minor');
    const severity = maxSeverity(issues);
    const reason = pass ? '所有基础规则通过' : `发现 ${issues.length} 个问题（最高级别: ${severity}）`;

    return { pass, reason, issues, severity };
  }

  /** 检查消息列表中是否存在指定类型 */
  private hasMessageOfType(messages: unknown[], type: string): boolean {
    return messages.some((msg) => {
      if (typeof msg !== 'object' || msg === null) return false;
      return type in (msg as Record<string, unknown>);
    });
  }

  /** 检查是否有 root 组件 */
  private hasRootComponent(messages: unknown[]): boolean {
    for (const msg of messages) {
      if (typeof msg !== 'object' || msg === null) continue;
      const payload = (msg as Record<string, unknown>).updateComponents;
      if (!payload || typeof payload !== 'object') continue;
      const components = (payload as Record<string, unknown>).components;
      if (!Array.isArray(components)) continue;

      for (const comp of components) {
        if (typeof comp === 'object' && comp !== null) {
          const id = (comp as Record<string, unknown>).id;
          if (id === 'root') return true;
        }
      }
    }
    return false;
  }

  /** 将校验错误消息映射为严重级别 */
  private validationErrorToSeverity(message: string): IssueSeverity {
    if (message.includes('重复创建') || message.includes('尚未创建')) {
      return 'critical';
    }
    if (message.includes('重复') || message.includes('悬空引用')) {
      return 'significant';
    }
    if (message.includes('Schema') || message.includes('schema')) {
      return 'criticalSchema';
    }
    if (message.includes('未知函数')) {
      return 'significant';
    }
    if (message.includes('数据绑定路径') || message.includes('JSON Pointer')) {
      return 'significant';
    }
    if (message.includes('Action') && (message.includes('必须包含') || message.includes('必须为'))) {
      return 'significant';
    }
    if (message.includes('callRendererFunction') || message.includes('agentFunctionResponse')) {
      return 'significant';
    }
    return 'minor';
  }

  /** 从路径中提取组件 ID */
  private extractComponentId(path: string): string | undefined {
    const match = path.match(/components\.([^.\]]+)/);
    return match?.[1];
  }

  /** 检查 prompt 覆盖度 */
  private checkPromptCoverage(result: ValidatedResult): EvalIssue[] {
    const issues: EvalIssue[] = [];
    const promptText = result.prompt.promptText;
    const rawText = result.rawText;

    // 检查 prompt 中提到的关键元素是否在输出中有所体现
    const keyElements = this.extractKeyElements(promptText);
    const missingElements: string[] = [];

    for (const element of keyElements) {
      if (!rawText.includes(element) && !rawText.toLowerCase().includes(element.toLowerCase())) {
        missingElements.push(element);
      }
    }

    if (missingElements.length > 0) {
      issues.push({
        description: `Prompt 中的部分关键元素未在输出中找到: ${missingElements.join(', ')}`,
        severity: 'minor',
      });
    }

    return issues;
  }

  /** 从 prompt 文本中提取关键检查元素 */
  private extractKeyElements(promptText: string): string[] {
    const elements: string[] = [];

    // 提取中文引号中的内容
    const quotedMatches = promptText.matchAll(/"([^"]+)"/g);
    for (const match of quotedMatches) {
      if (match[1].length > 1 && match[1].length < 30) {
        elements.push(match[1]);
      }
    }

    // 提取组件类型名称
    const componentNames = [
      'Column',
      'Row',
      'Card',
      'Text',
      'Button',
      'TextField',
      'CheckBox',
      'ChoicePicker',
      'Slider',
      'List',
      'Tabs',
      'Modal',
      'Divider',
      'Image',
      'Icon',
      'StatsSummary',
      'RiskPanel',
      'MultiSensorChart',
      'PredictionTimeline',
      'Chart',
      'TiltNetworkMonitor',
    ];
    for (const name of componentNames) {
      if (promptText.includes(name)) {
        elements.push(name);
      }
    }

    return elements.slice(0, 10);
  }
}
