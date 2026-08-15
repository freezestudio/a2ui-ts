/**
 * LLM 调用记录器 - 保存每次 LLM 调用为 Markdown 文件
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** 确保目录存在（SDK 为 Node 侧包，本地实现避免依赖 @geo/shared） */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * LLM 调用记录
 */
export const llmCallRecordSchema = z.object({
  /** 时间戳 */
  timestamp: z.date(),
  /** 会话 ID */
  sessionId: z.string(),
  /** 模型名称 */
  model: z.string(),
  /** System Prompt */
  systemPrompt: z.string(),
  /** 用户消息 */
  userMessage: z.string(),
  /** 工具调用列表 */
  toolCalls: z
    .array(
      z.object({
        name: z.string(),
        parameters: z.record(z.string(), z.unknown()),
        result: z.unknown(),
      }),
    )
    .optional(),
  /** 助手响应 */
  assistantResponse: z.string(),
  /** 元数据 */
  metadata: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    duration: z.number().optional(),
    validation: z.enum(['passed', 'failed']).optional(),
    errors: z.array(z.string()).optional(),
  }),
});
export type LLMCallRecord = z.infer<typeof llmCallRecordSchema>;

const MAX_RESULT_SIZE = 10_000;

function truncateForLog(value: unknown, maxLen = MAX_RESULT_SIZE): string {
  const raw = JSON.stringify(value);
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen) + `\n... (truncated, ${raw.length - maxLen} more bytes)`;
}

/**
 * LLM 调用记录器配置
 */
export const llmSaveLoggerConfigSchema = z.object({
  /** 保存目录（默认 logs/llm-calls） */
  saveDir: z.string().optional(),
  /** 是否启用（默认 true） */
  enabled: z.boolean().optional(),
});
export type LLMSaveLoggerConfig = z.infer<typeof llmSaveLoggerConfigSchema>;

/**
 * LLM 调用记录器
 */
export class LLMSaveLogger {
  private config: LLMSaveLoggerConfig;

  constructor(config: LLMSaveLoggerConfig = {}) {
    this.config = {
      saveDir: 'logs/llm-calls',
      enabled: true,
      ...config,
    };
  }

  /**
   * 保存 LLM 调用记录
   */
  async save(record: LLMCallRecord): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    const saveDir = this.config.saveDir!;

    await ensureDir(saveDir);

    // 生成文件名
    const timestamp = record.timestamp.toISOString().replace(/[:.]/g, '-');
    const sessionId = record.sessionId.replace(/[^a-zA-Z0-9-]/g, '_');
    const filename = `${timestamp}-${sessionId}.md`;
    const filepath = join(saveDir, filename);

    // 生成 Markdown 内容
    const content = this.generateMarkdown(record);

    try {
      await writeFile(filepath, content, 'utf-8');
      return filepath;
    } catch (error) {
      console.error(`保存 LLM 调用记录失败: ${String(error as string | number | bigint | symbol)}`);
      return null;
    }
  }

  /**
   * 生成 Markdown 内容
   */
  private generateMarkdown(record: LLMCallRecord): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# LLM Call: ${record.model}`);
    lines.push('');

    // 元信息
    lines.push(`**Timestamp**: ${record.timestamp.toISOString()}`);
    lines.push(`**Session**: ${record.sessionId}`);
    lines.push(`**Model**: ${record.model}`);
    lines.push('');

    // System Prompt
    lines.push('## System Prompt');
    lines.push('```');
    lines.push(record.systemPrompt);
    lines.push('```');
    lines.push('');

    // 用户消息
    lines.push('## User Message');
    lines.push(record.userMessage);
    lines.push('');

    // 工具调用
    if (record.toolCalls && record.toolCalls.length > 0) {
      lines.push('## Tool Calls');
      lines.push('');

      for (const call of record.toolCalls) {
        lines.push(`### ${call.name}`);
        lines.push('');
        lines.push('**Parameters**:');
        lines.push('```json');
        lines.push(JSON.stringify(call.parameters, null, 2));
        lines.push('```');
        lines.push('');
        lines.push('**Result**:');
        lines.push('```json');
        lines.push(truncateForLog(call.result));
        lines.push('```');
        lines.push('');
      }
    } else {
      lines.push('## Tool Calls');
      lines.push('无工具调用');
      lines.push('');
    }

    // 助手响应
    lines.push('## Assistant Response');
    lines.push(record.assistantResponse);
    lines.push('');

    // 元数据
    lines.push('## Metadata');
    if (record.metadata.inputTokens !== undefined) {
      lines.push(`- Input Tokens: ${record.metadata.inputTokens}`);
    }
    if (record.metadata.outputTokens !== undefined) {
      lines.push(`- Output Tokens: ${record.metadata.outputTokens}`);
    }
    if (record.metadata.duration !== undefined) {
      lines.push(`- Duration: ${record.metadata.duration.toFixed(2)}s`);
    }
    if (record.metadata.validation) {
      lines.push(`- Validation: ${record.metadata.validation}`);
    }
    if (record.metadata.errors && record.metadata.errors.length > 0) {
      lines.push(`- Errors:`);
      for (const error of record.metadata.errors) {
        lines.push(`  - ${error}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * 创建 LLM 调用记录器
 */
export function createLLMSaveLogger(config?: LLMSaveLoggerConfig): LLMSaveLogger {
  return new LLMSaveLogger(config);
}
