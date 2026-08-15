import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { A2uiStreamParser, parseResponse, createStreamParser } from '../parser/streaming.js';
import type { ResponsePart } from '../parser/streaming.js';

// 合法的 A2UI v1.0 CreateSurface 消息
const VALID_CREATE_SURFACE = JSON.stringify({
  version: 'v1.0',
  createSurface: {
    surfaceId: 'test-surface',
    catalogId: 'test-catalog',
  },
});

// 构造完整的 a2ui-json 标签
function wrapTag(json: string): string {
  return `<a2ui-json>${json}</a2ui-json>`;
}

// 收集 processChunk + finish 的全部 parts
function collectAll(parser: A2uiStreamParser): ResponsePart[] {
  return [...parser.finish()];
}

describe('A2uiStreamParser', () => {
  // ==========================================================================
  // 1. 纯文本输出
  // ==========================================================================
  describe('纯文本输出', () => {
    it('输入 "hello world" 应输出一个 text part', () => {
      const parser = new A2uiStreamParser();
      const chunks = parser.processChunk('hello world');
      assert.equal(chunks.length, 0);

      const parts = collectAll(parser);
      assert.equal(parts.length, 1);
      assert.equal(parts[0].type, 'text');
      assert.equal((parts[0] as { text: string }).text, 'hello world');
    });

    it('输入空字符串应输出空数组', () => {
      const parser = new A2uiStreamParser();
      const chunks = parser.processChunk('');
      assert.equal(chunks.length, 0);

      const parts = collectAll(parser);
      assert.equal(parts.length, 0);
    });
  });

  // ==========================================================================
  // 2. a2ui-json 标签解析
  // ==========================================================================
  describe('a2ui-json 标签解析', () => {
    it('完整标签应输出 a2ui_json part 且 valid=true', () => {
      const parts = parseResponse(wrapTag(VALID_CREATE_SURFACE));
      assert.equal(parts.length, 1);
      assert.equal(parts[0].type, 'a2ui_json');

      const part = parts[0] as { type: 'a2ui_json'; data: unknown; valid: boolean };
      assert.equal(part.valid, true);
      assert.notEqual(part.data, null);
    });

    it('标签内 JSON 缺少闭合括号（autoFix）应能修复并解析', () => {
      const broken = VALID_CREATE_SURFACE.slice(0, -1);
      const parts = parseResponse(wrapTag(broken));
      assert.equal(parts.length, 1);

      const part = parts[0] as { type: 'a2ui_json'; valid: boolean };
      assert.equal(part.valid, true);
    });
  });

  // ==========================================================================
  // 3. 混合文本和 JSON
  // ==========================================================================
  describe('混合文本和 JSON', () => {
    it('应输出 text + a2ui_json + text', () => {
      const input = `这是回复 ${wrapTag(VALID_CREATE_SURFACE)} 更多文本`;
      const parts = parseResponse(input);

      assert.ok(parts.length >= 3, `期望至少 3 个 parts，实际 ${parts.length}`);

      const textParts = parts.filter((p) => p.type === 'text');
      const jsonParts = parts.filter((p) => p.type === 'a2ui_json');

      assert.equal(jsonParts.length, 1);
      assert.ok(textParts.length >= 2);

      const firstText = textParts[0] as { type: 'text'; text: string };
      assert.ok(firstText.text.includes('这是回复'));

      const lastText = textParts[textParts.length - 1] as { type: 'text'; text: string };
      assert.ok(lastText.text.includes('更多文本'));
    });
  });

  // ==========================================================================
  // 4. 流式逐字符处理
  // ==========================================================================
  describe('流式逐字符处理', () => {
    it('逐字符调用 processChunk 最终应产出正确的 parts', () => {
      const fullMessage = `回复 ${wrapTag(VALID_CREATE_SURFACE)} 结束`;
      const parser = new A2uiStreamParser();

      let allParts: ResponsePart[] = [];
      for (const char of fullMessage) {
        const parts = parser.processChunk(char);
        allParts.push(...parts);
      }
      allParts.push(...parser.finish());

      const jsonParts = allParts.filter((p) => p.type === 'a2ui_json');
      assert.equal(jsonParts.length, 1);

      const part = jsonParts[0] as { type: 'a2ui_json'; valid: boolean };
      assert.equal(part.valid, true);

      const textParts = allParts.filter((p) => p.type === 'text');
      const allText = textParts.map((p) => (p as { text: string }).text).join('');
      assert.ok(allText.includes('回复'));
      assert.ok(allText.includes('结束'));
    });

    it('分块输入应与一次性输入结果一致', () => {
      const fullMessage = wrapTag(VALID_CREATE_SURFACE);

      const parser1 = new A2uiStreamParser();
      const parts1 = [...parser1.processChunk(fullMessage), ...parser1.finish()];

      const parser2 = new A2uiStreamParser();
      const mid = Math.floor(fullMessage.length / 2);
      const parts2 = [
        ...parser2.processChunk(fullMessage.slice(0, mid)),
        ...parser2.processChunk(fullMessage.slice(mid)),
        ...parser2.finish(),
      ];

      assert.equal(parts1.length, parts2.length);
      assert.equal(parts1[0].type, parts2[0].type);
    });
  });

  // ==========================================================================
  // 5. JSON 修复 (autoFix)
  // ==========================================================================
  describe('JSON 修复 (autoFix)', () => {
    it('未闭合的花括号应自动补全', () => {
      const broken = VALID_CREATE_SURFACE.slice(0, -1);
      const parser = new A2uiStreamParser({ autoFix: true });
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as { type: 'a2ui_json'; valid: boolean };
      assert.equal(part.valid, true);
    });

    it('未闭合的引号应自动补全（白名单键）', () => {
      const broken = '{"text":"value';
      const parser = new A2uiStreamParser({ autoFix: true });
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as { type: 'a2ui_json'; data: Record<string, unknown> | null; valid: boolean };
      assert.equal(part.valid, false);
      assert.deepEqual(part.data, { text: 'value' });
    });

    it('非白名单键的未闭合引号拒绝修复（返回原始片段）', () => {
      const broken = '{"key":"value';
      const parser = new A2uiStreamParser({ autoFix: true });
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as { type: 'a2ui_json'; data: Record<string, unknown> | null; valid: boolean };
      assert.equal(part.valid, false);
      assert.equal(part.data, null);
    });

    it('未闭合的方括号应自动补全', () => {
      const broken = `[${VALID_CREATE_SURFACE}`;
      const parser = new A2uiStreamParser({ autoFix: true });
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as { type: 'a2ui_json'; data: unknown; valid: boolean };
      assert.ok(Array.isArray(part.data));
    });
  });

  // ==========================================================================
  // 6. 错误处理
  // ==========================================================================
  describe('错误处理', () => {
    it('无效 JSON 应 valid=false 且包含错误信息', () => {
      const parts = parseResponse(wrapTag('not valid json'));
      assert.equal(parts.length, 1);

      const part = parts[0] as {
        type: 'a2ui_json';
        data: null;
        valid: boolean;
        errors?: string[];
      };
      assert.equal(part.valid, false);
      assert.equal(part.data, null);
      assert.ok(part.errors);
      assert.ok(part.errors.length > 0);
      assert.ok(part.errors[0].includes('JSON'));
    });

    it('空 a2ui-json 标签应不产出 part', () => {
      const parts = parseResponse('<a2ui-json></a2ui-json>');
      assert.equal(parts.length, 0);
    });

    it('不符合协议的 JSON 应 valid=false 且包含校验错误', () => {
      const parts = parseResponse(wrapTag('{"foo":"bar"}'));
      assert.equal(parts.length, 1);

      const part = parts[0] as {
        type: 'a2ui_json';
        data: unknown;
        valid: boolean;
        errors?: string[];
      };
      assert.equal(part.valid, false);
      assert.ok(part.errors);
      assert.ok(part.errors.length > 0);
    });
  });

  // ==========================================================================
  // 7. 状态管理
  // ==========================================================================
  describe('状态管理', () => {
    it('初始状态应为 idle', () => {
      const parser = new A2uiStreamParser();
      assert.equal(parser.getState(), 'idle');
    });

    it('reset() 后状态应回到 idle', () => {
      const parser = new A2uiStreamParser();
      parser.processChunk('some text');
      parser.reset();
      assert.equal(parser.getState(), 'idle');
    });

    it('finish() 后状态应回到 idle', () => {
      const parser = new A2uiStreamParser();
      parser.processChunk('hello');
      parser.finish();
      assert.equal(parser.getState(), 'idle');
    });

    it('getState() 应返回当前状态', () => {
      const parser = new A2uiStreamParser();
      assert.equal(parser.getState(), 'idle');

      parser.processChunk('<a2ui-json>');
      assert.equal(parser.getState(), 'in_json');

      parser.reset();
      assert.equal(parser.getState(), 'idle');
    });

    it('reset() 后应可重新使用解析器', () => {
      const parser = new A2uiStreamParser();
      parser.processChunk('first');
      parser.finish();

      parser.processChunk('second');
      const parts = parser.finish();
      assert.equal(parts.length, 1);
      assert.equal(parts[0].type, 'text');
      assert.equal((parts[0] as { text: string }).text, 'second');
    });
  });

  // ==========================================================================
  // 8. 辅助函数
  // ==========================================================================
  describe('辅助函数', () => {
    it('parseResponse 应同步解析完整响应', () => {
      const parts = parseResponse('hello world');
      assert.equal(parts.length, 1);
      assert.equal(parts[0].type, 'text');
      assert.equal((parts[0] as { text: string }).text, 'hello world');
    });

    it('parseResponse 应解析包含 a2ui-json 的响应', () => {
      const parts = parseResponse(wrapTag(VALID_CREATE_SURFACE));
      assert.equal(parts.length, 1);
      assert.equal(parts[0].type, 'a2ui_json');
    });

    it('createStreamParser 应返回 A2uiStreamParser 实例', () => {
      const parser = createStreamParser();
      assert.ok(parser instanceof A2uiStreamParser);
      assert.equal(parser.getState(), 'idle');
    });

    it('createStreamParser 应接受配置参数', () => {
      const parser = createStreamParser({ autoFix: false });
      assert.ok(parser instanceof A2uiStreamParser);
    });
  });

  // ==========================================================================
  // 9. 流式解析器配置
  // ==========================================================================
  describe('流式解析器配置', () => {
    it('autoFix: false 时不应修复 JSON', () => {
      const broken = VALID_CREATE_SURFACE.slice(0, -1);
      const parser = new A2uiStreamParser({ autoFix: false });
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as {
        type: 'a2ui_json';
        valid: boolean;
        errors?: string[];
      };
      assert.equal(part.valid, false);
      assert.ok(part.errors);
      assert.ok(part.errors.length > 0);
    });

    it('默认配置应启用 autoFix', () => {
      const broken = VALID_CREATE_SURFACE.slice(0, -1);
      const parser = new A2uiStreamParser();
      const parts = [...parser.processChunk(wrapTag(broken)), ...parser.finish()];

      assert.equal(parts.length, 1);
      const part = parts[0] as { type: 'a2ui_json'; valid: boolean };
      assert.equal(part.valid, true);
    });
  });
});
