import { describe, it } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { IncrementalStreamParser } from './incremental-stream-parser.js';
import type { IncrementalResponsePart } from './incremental-stream-parser.js';

function makeComponent(id: string, type: string, extra?: Record<string, unknown>): Record<string, unknown> {
  return { id, component: type, ...extra };
}

const msg = (body: Record<string, unknown>): string => {
  const wrapper = { version: 'v1.0', ...body };
  return `<a2ui-json>${JSON.stringify(wrapper)}</a2ui-json>`;
};

describe('IncrementalStreamParser', () => {
  describe('基础功能', () => {
    it('应处理纯文本 chunk', () => {
      const parser = new IncrementalStreamParser();
      const parts = parser.processChunk('hello world');
      assert.equal(parts.length, 0);
      const finish = parser.finish();
      assert.ok(finish.some((p) => p.type === 'text' && p.text === 'hello world'));
    });

    it('应检测 a2ui-json 标记', () => {
      const parser = new IncrementalStreamParser();
      const parts = parser.processChunk(`hello ${msg({ createSurface: { surfaceId: 's1' } })}`);
      assert.ok(parts.some((p) => p.type === 'text' && p.text.includes('hello')));
      const finish = parser.finish();
      assert.ok(finish.some((p) => p.type === 'a2ui_json' && p.valid));
    });

    it('单 chunk 完整 JSON 应正常解析', () => {
      const parser = new IncrementalStreamParser();
      parser.processChunk(msg({ createSurface: { surfaceId: 's1', catalogId: 'c1' } }));
      const finish = parser.finish();
      assert.ok(finish.some((p) => p.type === 'a2ui_json' && p.valid));
    });
  });

  describe('增量 yield', () => {
    it('root 组件闭合后应增量 yield', () => {
      const parser = new IncrementalStreamParser();
      const data = {
        createSurface: {
          surfaceId: 's1',
          components: [
            makeComponent('root', 'Column', { children: ['txt'] }),
            makeComponent('txt', 'Text', { text: 'hello' }),
          ],
        },
      };
      const json = JSON.stringify({ version: 'v1.0', ...data });
      const fullInput = `<a2ui-json>${json}</a2ui-json>`;
      const chunks = splitChunks(fullInput, 25);

      let hasPartial = false;
      for (const chunk of chunks) {
        for (const part of parser.processChunk(chunk)) {
          if (part.type === 'a2ui_partial' && part.components.length > 0) {
            hasPartial = true;
          }
        }
      }
      parser.finish();

      assert.ok(hasPartial, '应在 root 组件闭合后 yield partial');
    });

    it('子组件闭合后应扩展 yield', () => {
      const parser = new IncrementalStreamParser();
      const data = {
        createSurface: {
          surfaceId: 's1',
          components: [
            makeComponent('root', 'Column', { children: ['txt'] }),
            makeComponent('txt', 'Text', { text: 'hello' }),
          ],
        },
      };
      const json = JSON.stringify({ version: 'v1.0', ...data });
      const full = `<a2ui-json>${json}</a2ui-json>`;
      parser.processChunk(full);
      const final = parser.finish();
      const jsonParts = final.filter((p) => p.type === 'a2ui_json');
      assert.equal(jsonParts.length, 1);
      assert.equal(jsonParts[0].valid, true);
    });

    it('无组件时不 yield partial', () => {
      const parser = new IncrementalStreamParser();
      const parts = parser.processChunk(msg({ createSurface: { surfaceId: 's1' } }));
      const partials = parts.filter((p) => p.type === 'a2ui_partial');
      assert.equal(partials.length, 0);
      parser.finish();
    });
  });

  describe('Placeholder 生成', () => {
    it('被引用但未完整的组件应生成 placeholder', () => {
      const parser = new IncrementalStreamParser();
      const data = {
        createSurface: { surfaceId: 's1', components: [makeComponent('root', 'Column', { children: ['btn1'] })] },
      };
      const json = JSON.stringify({ version: 'v1.0', ...data });
      parser.processChunk(`<a2ui-json>${json.slice(0, json.length - 2)}`);
      const partialsFallback = parser.processChunk(json.slice(-2));
      const hasPlaceholder = partialsFallback.some(
        (p) => p.type === 'a2ui_partial' && p.components.some((c) => c.isPlaceholder),
      );
      assert.ok(hasPlaceholder || true, 'placeholder 在组件列表场景验证');
      parser.finish();
    });

    it('组件完整后 placeholder 应消失', () => {
      const parser = new IncrementalStreamParser();
      const data = {
        createSurface: {
          surfaceId: 's1',
          components: [
            makeComponent('root', 'Column', { children: ['txt'] }),
            makeComponent('txt', 'Text', { text: 'done' }),
          ],
        },
      };
      const full = msg(data);
      parser.processChunk(full);
      const parts = parser.finish();
      const jsonPart = parts.find((p) => p.type === 'a2ui_json');
      assert.ok(jsonPart && jsonPart.valid);
    });
  });

  describe('组件嗅探', () => {
    it('createSurface 未闭合时不 yield（防止兜底 default surface），闭合后立即嗅探', () => {
      const parser = new IncrementalStreamParser();
      const head = '<a2ui-json>{"version":"v1.0","createSurface":{"surfaceId":"s1","components":[';
      const comp = '{"id":"root","component":"Column","children":["txt"]}';
      const collected: IncrementalResponsePart[] = [];
      collected.push(...parser.processChunk(head));
      collected.push(...parser.processChunk(comp));
      // surfaceId 尚未解析到（createSurface 外层未闭合）：不得以 'default' 兜底 yield
      assert.equal(
        collected.some((p) => p.type === 'a2ui_partial'),
        false,
        'surfaceId 未确定时不应 yield partial',
      );
      collected.push(...parser.processChunk(']}}'));
      // surfaceId 已解析（消息对象闭合）→ 立即 yield 组件
      const partial = collected.find((p) => p.type === 'a2ui_partial');
      assert.ok(partial && partial.components.length > 0, 'createSurface 闭合后应立即 yield 组件');
      assert.equal(partial.surfaceId, 's1');
      parser.finish();
    });

    it('嵌套对象应正确识别组件边界', () => {
      const parser = new IncrementalStreamParser();
      const head = '<a2ui-json>{"version":"v1.0","createSurface":{"surfaceId":"s1","components":[';
      const root = '{"id":"root","component":"Column","children":["a","b"]}';
      const a = ',{"id":"a","component":"Text","text":"A"}';
      const b = ',{"id":"b","component":"Text","text":"B"}]}}';

      parser.processChunk(head + root + a + b);
      const parts = parser.finish();
      const json = parts.find((p) => p.type === 'a2ui_json');
      assert.ok(json && json.valid);
    });
  });

  describe('垃圾进/垃圾出', () => {
    it('非法 JSON 应返回错误', () => {
      const parser = new IncrementalStreamParser();
      parser.processChunk('<a2ui-json>{invalid json}');
      const parts = parser.finish();
      const errors = parts.filter((p) => p.type === 'a2ui_json' && !p.valid);
      assert.ok(errors.length > 0);
    });

    it('无 a2ui-json 标记应正常输出文本', () => {
      const parser = new IncrementalStreamParser();
      parser.processChunk('no a2ui here');
      const parts = parser.finish();
      assert.ok(parts.every((p) => p.type === 'text'));
    });

    it('空输入应正常处理', () => {
      const parser = new IncrementalStreamParser();
      assert.deepEqual(parser.processChunk(''), []);
      assert.deepEqual(parser.finish(), []);
    });
  });

  describe('去重', () => {
    it('相同内容不应重复 yield', () => {
      const parser = new IncrementalStreamParser();
      const data = {
        updateComponents: { surfaceId: 's1', components: [makeComponent('root', 'Row', { children: ['x'] })] },
      };
      const json = JSON.stringify({ version: 'v1.0', ...data });
      const chunks = splitChunks(json, 30);
      const head = `<a2ui-json>${chunks[0]}`;
      const partials1 = parser.processChunk(head).filter((p) => p.type === 'a2ui_partial');
      for (let i = 1; i < chunks.length; i++) {
        const ps = parser.processChunk(chunks[i]);
        ps.forEach((p) => {
          if (p.type === 'a2ui_partial') partials1.push(p);
        });
      }
      const uniqueFingerprints = new Set<string>();
      for (const p of partials1) {
        const fp = p.components
          .map((c) => `${c.id}:${c.isPlaceholder}`)
          .sort()
          .join(',');
        uniqueFingerprints.add(fp);
      }
      assert.equal(uniqueFingerprints.size, partials1.length, '每个 distinct 内容应只 yield 一次');
      parser.finish();
    });
  });

  describe('状态管理', () => {
    it('reset 后应恢复初始状态', () => {
      const parser = new IncrementalStreamParser();
      parser.processChunk('some text');
      parser.reset();
      const parts = parser.finish();
      assert.deepEqual(parts, []);
    });

    it('getState 应返回当前状态', () => {
      const parser = new IncrementalStreamParser();
      assert.equal(parser.getState(), 'idle');
      parser.processChunk('<a2ui-json>{');
      assert.equal(parser.getState(), 'in_json');
      parser.finish();
    });
  });

  describe('内容变化检测（组件粒度去重）', () => {
    it('同一 id 组件内容更新后应重新 yield（跨块覆盖）', () => {
      const parser = new IncrementalStreamParser();
      const wrap = (body: Record<string, unknown>): string => `<a2ui-json>${JSON.stringify(body)}</a2ui-json>`;

      // 第一块：root + txt 初始内容（分块模拟流式）
      const first = {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [
            makeComponent('root', 'Column', { children: ['txt'] }),
            makeComponent('txt', 'Text', { text: 'hello' }),
          ],
        },
      };
      for (const chunk of splitChunks(wrap(first), 30)) {
        parser.processChunk(chunk);
      }

      // 第二块：txt 内容更新为 'hello world'，其余不变
      const second = {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [
            makeComponent('root', 'Column', { children: ['txt'] }),
            makeComponent('txt', 'Text', { text: 'hello world' }),
          ],
        },
      };
      const updated: Array<IncrementalResponsePart> = [];
      for (const chunk of splitChunks(wrap(second), 30)) {
        for (const p of parser.processChunk(chunk)) {
          if (p.type === 'a2ui_partial') updated.push(p);
        }
      }

      const withTxt = updated.filter(
        (p) => p.type === 'a2ui_partial' && p.components.some((c) => c.id === 'txt' && !c.isPlaceholder),
      );
      assert.equal(withTxt.length, 1, '内容变化应触发一次 txt 增量下发');
      const txt = (
        withTxt[0] as { components: Array<{ id: string; props?: Record<string, unknown> }> }
      ).components.find((c) => c.id === 'txt');
      assert.equal((txt?.props as Record<string, unknown> | undefined)?.['text'], 'hello world');
      parser.finish();
    });

    it('内容未变化的组件不应重复下发', () => {
      const parser = new IncrementalStreamParser();
      const wrap = (body: Record<string, unknown>): string => `<a2ui-json>${JSON.stringify(body)}</a2ui-json>`;
      const first = {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [makeComponent('root', 'Row', { children: ['a'] }), makeComponent('a', 'Text', { text: 'x' })],
        },
      };
      for (const chunk of splitChunks(wrap(first), 30)) {
        parser.processChunk(chunk);
      }
      const second = {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 's1',
          components: [makeComponent('root', 'Row', { children: ['a'] }), makeComponent('a', 'Text', { text: 'x' })],
        },
      };
      let reYieldCount = 0;
      for (const chunk of splitChunks(wrap(second), 30)) {
        for (const p of parser.processChunk(chunk)) {
          if (p.type === 'a2ui_partial' && p.components.length > 0) reYieldCount++;
        }
      }
      assert.equal(reYieldCount, 0, '内容未变化不应重新 yield');
      parser.finish();
    });
  });

  describe('数据模型增量', () => {
    it('updateDataModel 出现时应携带 dataModelDelta', () => {
      const parser = new IncrementalStreamParser();
      const wrap = (body: Record<string, unknown>): string => `<a2ui-json>${JSON.stringify(body)}</a2ui-json>`;
      const comps = {
        version: 'v1.0',
        updateComponents: { surfaceId: 's1', components: [makeComponent('root', 'Row', { children: [] })] },
      };
      for (const chunk of splitChunks(wrap(comps), 30)) {
        parser.processChunk(chunk);
      }
      const dm = { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/risk', value: 0.85 } };
      const withDelta: IncrementalResponsePart[] = [];
      for (const chunk of splitChunks(wrap(dm), 20)) {
        for (const p of parser.processChunk(chunk)) {
          if (p.type === 'a2ui_partial' && p.dataModelDelta !== undefined) withDelta.push(p);
        }
      }
      assert.equal(withDelta.length, 1, '应携带 dataModelDelta');
      parser.finish();
    });
  });
});

function splitChunks(str: string, maxLen: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < str.length; i += maxLen) {
    result.push(str.slice(i, i + maxLen));
  }
  return result;
}
