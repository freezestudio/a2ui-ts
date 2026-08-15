/**
 * A2UI 流式解析器 — 增量解析 LLM 输出中的 A2UI JSON
 *
 * 使用状态机驱动，逐字符处理输入：
 * idle → in_tag → in_json → done
 *
 * 支持：
 * - 自动 JSON 修复（补括号/引号）
 * - 协议信封校验（通过 A2uiValidator）
 * - 文本和 A2UI JSON 的混合输出
 */

import { A2uiMessageSchema, type A2uiMessage } from '../schema/agent-to-renderer.js';
import type { A2uiValidator, ValidationError } from '../schema/validator.js';
import { A2uiValidator as ValidatorImpl } from '../schema/validator.js';
import { fixPartialJsonFragment } from '@freezestudio/a2ui-shared';
import { z } from 'zod';

// ============================================================================
// 类型定义
// ============================================================================

/** 解析器状态 */
type ParserState = 'idle' | 'in_tag' | 'in_json' | 'done';

/** 流式解析器配置 */
export const streamParserConfigSchema = z.object({
  /** 是否自动修复 JSON（默认 true） */
  autoFix: z.boolean().optional(),
  /** 最大重试次数（默认 3） */
  maxRetries: z.number().optional(),
});
export type StreamParserConfig = z.infer<typeof streamParserConfigSchema>;

/**
 * 响应部分类型 — 解析器产出的基本单元
 */
export const responsePartSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('a2ui_json'),
    data: A2uiMessageSchema.nullable(),
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
  }),
]);
export type ResponsePart = z.infer<typeof responsePartSchema>;

/**
 * 解析结果
 */
export const parseResultSchema = z.object({
  parts: z.array(responsePartSchema),
  hasErrors: z.boolean(),
  errors: z.array(z.string()).optional(),
});
export type ParseResult = z.infer<typeof parseResultSchema>;

// ============================================================================
// A2uiStreamParser
// ============================================================================

/**
 * A2UI 流式解析器
 */
export class A2uiStreamParser {
  private config: Required<StreamParserConfig>;
  private validator: A2uiValidator;

  private state: ParserState = 'idle';
  private buffer = '';
  private jsonBuffer = '';

  constructor(config: StreamParserConfig = {}) {
    this.config = {
      autoFix: true,
      maxRetries: 3,
      ...config,
    };
    this.validator = new ValidatorImpl();
  }

  /**
   * 处理一个 chunk
   */
  processChunk(chunk: string): ResponsePart[] {
    const parts: ResponsePart[] = [];

    for (const char of chunk) {
      const result = this.processChar(char);
      if (result) {
        parts.push(result);
      }
    }

    return parts;
  }

  /**
   * 处理单个字符
   */
  private processChar(char: string): ResponsePart | null {
    switch (this.state) {
      case 'idle':
        return this.handleIdle(char);
      case 'in_tag':
        return this.handleInTag(char);
      case 'in_json':
        return this.handleInJson(char);
      case 'done':
        return this.handleIdle(char);
    }
  }

  /**
   * 处理空闲状态
   */
  private handleIdle(char: string): ResponsePart | null {
    this.buffer += char;

    // 检查是否开始 <a2ui-json> 标签
    if (this.buffer.endsWith('<a2ui-json>')) {
      const prefix = this.buffer.slice(0, -11);
      this.state = 'in_json';
      this.buffer = '';
      this.jsonBuffer = '';
      if (prefix.trim()) {
        return { type: 'text', text: prefix };
      }
      return null;
    }

    // 如果缓冲区太长且没有匹配到标签，释放前面的文本
    if (this.buffer.length > 20) {
      const text = this.buffer.slice(0, -11);
      this.buffer = this.buffer.slice(-11);

      if (text.trim()) {
        return { type: 'text', text };
      }
    }

    return null;
  }

  /**
   * 处理标签内状态
   */
  private handleInTag(char: string): ResponsePart | null {
    this.buffer += char;

    // 确认进入 JSON 内容
    if (this.buffer === '<a2ui-json>') {
      this.state = 'in_json';
      this.buffer = '';
      return null;
    }

    // 如果不是预期的标签，回退到空闲状态
    if (!'<a2ui-json>'.startsWith(this.buffer)) {
      const text = this.buffer;
      this.buffer = '';
      this.state = 'idle';

      if (text.trim()) {
        return { type: 'text', text };
      }
    }

    return null;
  }

  /**
   * 处理 JSON 内容状态
   */
  private handleInJson(char: string): ResponsePart | null {
    this.buffer += char;

    // 完整结束标签匹配
    if (this.buffer.endsWith('</a2ui-json>')) {
      this.state = 'idle';
      const json = this.jsonBuffer.trim();
      this.jsonBuffer = '';
      this.buffer = '';
      if (json) {
        return this.parseJson(json);
      }
      return null;
    }

    // 结束标签前缀匹配 — 继续累积
    if ('</a2ui-json>'.startsWith(this.buffer)) {
      return null;
    }

    // 不是结束标签前缀 — 将 buffer 内容刷入 jsonBuffer
    this.jsonBuffer += this.buffer;
    this.buffer = '';
    return null;
  }

  /**
   * 解析 JSON
   */
  private parseJson(json: string): ResponsePart {
    try {
      let fixedJson = json;

      if (this.config.autoFix) {
        fixedJson = this.fixJson(json);
      }

      const data = JSON.parse(fixedJson) as unknown;

      // 校验协议信封
      const validationResult = this.validator.validateServerToClientMessage(data);

      if (validationResult.valid) {
        return {
          type: 'a2ui_json',
          data: data as A2uiMessage,
          valid: true,
        };
      } else {
        return {
          type: 'a2ui_json',
          data: data as A2uiMessage | null,
          valid: false,
          errors: validationResult.errors.map((e: ValidationError) => `${e.path}: ${e.message}`),
        };
      }
    } catch (error) {
      return {
        type: 'a2ui_json',
        data: null,
        valid: false,
        errors: [`JSON 解析失败: ${String(error as string | number | bigint | symbol)}`],
      };
    }
  }

  /**
   * 修复 JSON（补括号/引号）
   *
   * 使用共享安全修复逻辑（cuttable-keys 白名单 + URL 值保护），
   * 截断的 URL/路径绑定不会被误补；无法安全修复时返回原片段。
   */
  private fixJson(json: string): string {
    // 智能引号规范化
    let fixed = json
      .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");

    // 去除尾逗号
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // 安全补全（白名单 + URL 保护）
    const healed = fixPartialJsonFragment(fixed);
    return healed === '' ? fixed : healed;
  }

  /**
   * 结束流处理 — 处理残留内容
   */
  finish(): ResponsePart[] {
    const parts: ResponsePart[] = [];

    // 未处理的文本
    if (this.buffer && this.state !== 'in_json') {
      parts.push({ type: 'text', text: this.buffer });
    }

    // 在 JSON 中但无结束标签
    if (this.state === 'in_json' && this.jsonBuffer) {
      const part = this.parseJson(this.jsonBuffer);
      parts.push(part);
    }

    this.reset();
    return parts;
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.state = 'idle';
    this.buffer = '';
    this.jsonBuffer = '';
  }

  /** 获取当前状态（调试用） */
  getState(): ParserState {
    return this.state;
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 同步解析完整响应
 */
export function parseResponse(response: string): ResponsePart[] {
  const parser = new A2uiStreamParser();
  const parts = parser.processChunk(response);
  parts.push(...parser.finish());
  return parts;
}

/**
 * 创建流式解析器
 */
export function createStreamParser(config?: StreamParserConfig): A2uiStreamParser {
  return new A2uiStreamParser(config);
}
