/**
 * A2UI agent 侧示例 — prompt → generate → validate 循环
 *
 * 对应官方协议文档「Usage pattern: the prompt-generate-validate loop」：
 * 1. 用 @freezestudio/a2ui-agent 的生成器（schema 注入的 system prompt）调用 LLM
 * 2. 从输出中提取 A2UI 消息数组
 * 3. 用 @freezestudio/a2ui-sdk 的 Zod schema + basic Catalog 校验每条消息
 * 4. 输出校验结果（校验失败信息可直接回喂 LLM 自纠）
 *
 * 运行：
 *   pnpm --filter @freezestudio/a2ui-agent-generator-demo start
 *
 * 模型选择（二选一）：
 *   - 设置 DEEPSEEK_API_KEY 环境变量 → 使用 DeepSeek
 *   - 否则使用本地 Ollama（需先 `ollama serve` 并拉取模型）
 */

import {
  DeepSeekGenerator,
  OllamaGenerator,
  type GeneratedResult,
  type ModelConfig,
  type TestPrompt,
} from '@freezestudio/a2ui-agent';
import { A2uiMessageSchema } from '@freezestudio/a2ui-sdk';

// ---------------------------------------------------------------------------
// 1. 准备 prompt 与模型配置
// ---------------------------------------------------------------------------

const prompts: TestPrompt[] = [
  {
    name: 'coffee-order',
    description: '生成一张咖啡订单卡片',
    promptText:
      '请为一个咖啡点单应用生成 UI：显示"燕麦拿铁"卡片，包含商品名、价格 ¥32、"加入购物车"按钮' +
      '和数量选择（Slider，范围 1-5）。',
  },
];

const models: ModelConfig[] = [
  process.env.DEEPSEEK_API_KEY
    ? { name: 'deepseek', provider: 'deepseek', modelName: 'deepseek-chat', maxTokens: 8192, temperature: 0 }
    : { name: 'ollama-local', provider: 'ollama', modelName: 'qwen3:8b', maxTokens: 8192, temperature: 0 },
];

// ---------------------------------------------------------------------------
// 2. 运行生成器
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const generator = process.env.DEEPSEEK_API_KEY
    ? new DeepSeekGenerator({ models, prompts })
    : new OllamaGenerator({ models, prompts });

  console.log(`▶ 使用模型: ${models[0].name}（${models[0].modelName}）\n`);
  const results: GeneratedResult[] = await generator.run();

  // ---------------------------------------------------------------------------
  // 3. 校验生成结果（消息信封 schema；组件级可结合 Catalog.validateComponent 扩展）
  // ---------------------------------------------------------------------------

  let pass = 0;
  let fail = 0;

  for (const result of results) {
    console.log(`──────────────────────────────────────────`);
    console.log(`prompt: ${result.prompt.name} | run #${result.runNumber} | ${result.latency.toFixed(0)}ms`);

    if (result.error) {
      fail++;
      console.log(`  ✗ 生成失败: ${result.error}`);
      continue;
    }

    if (result.components.length === 0) {
      fail++;
      console.log('  ✗ 未提取到 A2UI 消息（检查 <a2ui-json> 标签输出格式）');
      continue;
    }

    for (const [i, msg] of result.components.entries()) {
      const parsed = A2uiMessageSchema.safeParse(msg);
      if (parsed.success) {
        pass++;
        const kind = Object.keys(msg as Record<string, unknown>).find((k) => k !== 'version');
        console.log(`  ✓ msg[${i}] ${kind}`);
      } else {
        fail++;
        const issues = parsed.error.issues.slice(0, 3).map((x) => `${x.path.join('/')}: ${x.message}`);
        console.log(`  ✗ msg[${i}] 校验失败:`);
        for (const issue of issues) console.log(`      - ${issue}`);
        // 自纠循环：将 issues 文本回喂 LLM（"以下错误请修正后重新输出"）即可实现
        // prompt-generate-validate 的完整闭环。
      }
    }
  }

  console.log(`──────────────────────────────────────────`);
  console.log(`✔ 通过 ${pass} 条 / ✗ 失败 ${fail} 条`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
