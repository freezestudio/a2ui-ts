/**
 * A2UI Eval CLI 入口
 * 用法: tsx src/cli.ts [选项]
 *
 * 选项:
 *   --model=<name>      过滤模型名称
 *   --prompt=<name>     过滤 prompt 名称
 *   --runs=<n>          每个 prompt 运行次数（默认 1）
 *   --output=<dir>      输出目录（默认 ./eval-output）
 *   --provider=<type>   LLM 提供商：mock（默认）| deepseek | ollama
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { prompts } from './prompts.js';
import { MockGenerator } from './generator.js';
import { Validator } from './validator.js';
import { RuleBasedEvaluator } from './evaluator.js';
import type { EvaluatedResult, ModelConfig, TestPrompt } from './types.js';

// ============================================================================
// 参数解析
// ============================================================================

interface CliArgs {
  modelFilter?: string;
  promptFilter?: string;
  runs: number;
  outputDir: string;
  provider: 'mock' | 'deepseek' | 'ollama';
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { runs: 1, outputDir: './eval-output', provider: 'mock' };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--model=')) {
      args.modelFilter = arg.slice('--model='.length);
    } else if (arg.startsWith('--prompt=')) {
      args.promptFilter = arg.slice('--prompt='.length);
    } else if (arg.startsWith('--runs=')) {
      args.runs = parseInt(arg.slice('--runs='.length), 10) || 1;
    } else if (arg.startsWith('--output=')) {
      args.outputDir = arg.slice('--output='.length);
    } else if (arg.startsWith('--provider=')) {
      args.provider = arg.slice('--provider='.length) as 'mock' | 'deepseek' | 'ollama';
    }
  }

  return args;
}

// ============================================================================
// 主流程
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // 过滤 prompts
  let filteredPrompts: TestPrompt[] = prompts;
  if (args.promptFilter) {
    filteredPrompts = prompts.filter((p) => p.name.includes(args.promptFilter!));
    if (filteredPrompts.length === 0) {
      console.error(`未找到匹配的 prompt: "${args.promptFilter}"`);
      console.error(`可用 prompt: ${prompts.map((p) => p.name).join(', ')}`);
      process.exit(1);
    }
  }

  // 默认模型配置
  const models: ModelConfig[] =
    args.provider === 'deepseek'
      ? [
          {
            name: 'deepseek-v4-flash',
            provider: 'deepseek',
            modelName: 'deepseek-v4-flash',
            maxTokens: 8192,
            temperature: 0.7,
          },
        ]
      : args.provider === 'ollama'
        ? [
            {
              name: 'gemma4:e4b',
              provider: 'ollama',
              modelName: 'gemma4:e4b',
              maxTokens: 8192,
              temperature: 0.7,
            },
          ]
        : [{ name: 'mock-model', provider: 'openai', modelName: 'mock', maxTokens: 4096, temperature: 0.7 }];

  let filteredModels = models;
  if (args.modelFilter) {
    filteredModels = models.filter((m) => m.name.includes(args.modelFilter!));
    if (filteredModels.length === 0) {
      console.error(`未找到匹配的模型: "${args.modelFilter}"`);
      process.exit(1);
    }
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║   A2UI v1.0 LLM Eval Framework      ║');
  console.log('╚══════════════════════════════════════╝');
  console.log();
  console.log(`模型: ${filteredModels.map((m) => m.name).join(', ')}`);
  console.log(`Prompt 数量: ${filteredPrompts.length}`);
  console.log(`每个 Prompt 运行次数: ${args.runs}`);
  console.log();

  // 阶段 1：生成
  console.log('[1/3] 生成阶段...');
  let generator;
  if (args.provider === 'deepseek') {
    const { DeepSeekGenerator } = await import('@a2ui/agent');
    generator = new DeepSeekGenerator({
      models: filteredModels,
      prompts: filteredPrompts,
      runsPerPrompt: args.runs,
    });
  } else if (args.provider === 'ollama') {
    const { OllamaGenerator } = await import('@a2ui/agent');
    generator = new OllamaGenerator({
      models: filteredModels,
      prompts: filteredPrompts,
      runsPerPrompt: args.runs,
    });
  } else {
    generator = new MockGenerator({
      models: filteredModels,
      prompts: filteredPrompts,
      runsPerPrompt: args.runs,
    });
  }
  const generated = await generator.run();
  console.log(`  生成 ${generated.length} 条结果`);

  // 阶段 2：校验
  console.log('[2/3] 校验阶段...');
  const validator = new Validator();
  const validated = await validator.run(generated);
  const totalErrors = validated.reduce((sum, r) => sum + r.validationErrors.length, 0);
  console.log(`  校验完成，共 ${totalErrors} 个错误`);

  // 阶段 3：评测
  console.log('[3/3] 评测阶段...');
  const evaluator = new RuleBasedEvaluator();
  const evaluated = await evaluator.run(validated);
  const passed = evaluated.filter((r) => r.evaluationResult.pass).length;
  console.log(`  评测完成，${passed}/${evaluated.length} 通过`);
  console.log();

  // 输出汇总
  printSummary(evaluated);

  // 保存结果
  await saveResults(evaluated, args.outputDir);
}

function printSummary(results: EvaluatedResult[]): void {
  console.log('═══════════════════════════════════════');
  console.log(' 评测结果汇总');
  console.log('═══════════════════════════════════════');
  console.log();

  for (const result of results) {
    const status = result.evaluationResult.pass ? 'PASS' : 'FAIL';
    const icon = result.evaluationResult.pass ? '+' : 'x';
    console.log(`  [${icon}] ${result.prompt.name} (${result.modelName} #${result.runNumber})`);
    console.log(`      状态: ${status} | 延迟: ${result.latency.toFixed(0)}ms`);
    console.log(
      `      校验错误: ${result.validationErrors.length} | 评测问题: ${result.evaluationResult.issues.length}`,
    );

    if (!result.evaluationResult.pass) {
      console.log(`      原因: ${result.evaluationResult.reason}`);
      for (const issue of result.evaluationResult.issues) {
        if (issue.severity !== 'minor') {
          console.log(`      - [${issue.severity}] ${issue.description}`);
        }
      }
    }
    console.log();
  }

  const total = results.length;
  const passed = results.filter((r) => r.evaluationResult.pass).length;
  const avgLatency = results.reduce((s, r) => s + r.latency, 0) / total;
  console.log(`总计: ${passed}/${total} 通过 | 平均延迟: ${avgLatency.toFixed(0)}ms`);
}

async function saveResults(results: EvaluatedResult[], outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = join(outputDir, `eval-${timestamp}.json`);

  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.evaluationResult.pass).length,
      failed: results.filter((r) => !r.evaluationResult.pass).length,
      avgLatency: results.reduce((s, r) => s + r.latency, 0) / results.length,
    },
    results: results.map((r) => ({
      modelName: r.modelName,
      promptName: r.prompt.name,
      runNumber: r.runNumber,
      latency: r.latency,
      validationErrorCount: r.validationErrors.length,
      validationErrors: r.validationErrors,
      evaluation: r.evaluationResult,
      rawText: r.rawText,
    })),
  };

  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`结果已保存至: ${outputPath}`);
}

main().catch((err) => {
  console.error('Eval 执行失败:', err);
  process.exit(1);
});
