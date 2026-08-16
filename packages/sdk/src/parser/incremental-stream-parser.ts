/**
 * 增量流式解析器 — 逐字符解析 A2UI JSON，组件级增量 yield
 *
 * 在 LLM 流式输出过程中，一旦组件子树从 root 可达就立即 yield partial message，
 * 无需等待完整 JSON。缺失的子组件自动插入 placeholder。
 */

import { A2uiValidator as A2uiValidatorInternal } from '../schema/validator.js';
import type { A2uiValidator, ValidationResult, ValidationError } from '../schema/validator.js';
import { extractRefFields, analyzeTopology } from '../schema/topology-analyzer.js';
import { BraceStateMachine } from './brace-state-machine.js';
import { isComponentLike, normalizeSmartQuotes, removeTrailingCommas } from './json-healer.js';
import {
  IncrementalParserConfigSchema,
  type IncrementalResponsePart,
  type CachedComponent,
  type TopologyState,
  type PartialComponent,
  type IncrementalParserConfigInput,
  type IncrementalParserConfig,
  type DataModelDelta,
} from './types.js';

const A2UI_OPEN_TAG = '<a2ui-json>';
const A2UI_CLOSE_TAG = '</a2ui-json>';
const OPEN_TAG_LEN = A2UI_OPEN_TAG.length;
const CLOSE_TAG_LEN = A2UI_CLOSE_TAG.length;
const MAX_TEXT_BUFFER = 200;

export class IncrementalStreamParser {
  private config: IncrementalParserConfig;
  private validator: A2uiValidator;
  private stateMachine: BraceStateMachine;

  private inA2uiBlock = false;
  private hasPendingJson = false;
  private tagAccumulator = '';

  private seenComponents = new Map<string, CachedComponent>();
  private topologyDirty = true;
  private topologyState: TopologyState;

  /** 已下发组件的内容哈希（id → 哈希），内容变化时重新下发（组件粒度去重） */
  private yieldedContent = new Map<string, string>();

  private surfaceId: string | null = null;
  private catalogId: string | null = null;
  private activeMessageType: 'createSurface' | 'updateComponents' | null = null;

  private dataModelDeltas: DataModelDelta[] = [];
  private dataModelDirty = false;

  constructor(config: IncrementalParserConfigInput = {}) {
    this.config = IncrementalParserConfigSchema.parse(config);
    this.validator = new A2uiValidatorInternal();
    this.stateMachine = new BraceStateMachine();
    this.topologyState = { dirty: true, reachable: new Set(), refFields: {} };
  }

  processChunk(chunk: string): IncrementalResponsePart[] {
    const parts: IncrementalResponsePart[] = [];

    for (const char of chunk) {
      if (!this.inA2uiBlock) {
        const result = this.handleOutsideBlock(char);
        if (result) parts.push(...result);
      } else {
        this.handleInsideBlock(char);
        if (this.stateMachine.buffer.endsWith(A2UI_CLOSE_TAG)) {
          // 块闭合前最后一次增量 yield：组件变化可能与本 chunk 的闭合标签同时到达，
          // 错过则只能等 finish() 全量下发
          if (this.config.enableIncrementalYield) {
            const partial = this.tryIncrementalYield();
            if (partial) parts.push(partial);
          }
          this.inA2uiBlock = false;
          this.hasPendingJson = true;
        }
      }
    }

    if (this.inA2uiBlock && this.config.enableIncrementalYield) {
      const partial = this.tryIncrementalYield();
      if (partial) parts.push(partial);
    }

    return parts;
  }

  finish(): IncrementalResponsePart[] {
    const parts: IncrementalResponsePart[] = [];

    if (this.tagAccumulator.trim()) {
      parts.push({ type: 'text', text: this.tagAccumulator });
    }
    this.tagAccumulator = '';

    if (this.inA2uiBlock || this.hasPendingJson) {
      const raw = this.stateMachine.buffer;
      const json = raw.endsWith(A2UI_CLOSE_TAG) ? raw.slice(0, -CLOSE_TAG_LEN).trim() : raw.trim();
      if (json) {
        const result = this.parseCompleteJson(json);
        if (result) parts.push(result);
      }
    }

    this.reset();
    return parts;
  }

  reset(): void {
    this.stateMachine.reset();
    this.inA2uiBlock = false;
    this.hasPendingJson = false;
    this.tagAccumulator = '';
    this.seenComponents.clear();
    this.topologyDirty = true;
    this.topologyState = { dirty: true, reachable: new Set(), refFields: {} };
    this.yieldedContent.clear();
    this.surfaceId = null;
    this.catalogId = null;
    this.activeMessageType = null;
    this.dataModelDeltas = [];
    this.dataModelDirty = false;
  }

  getState(): string {
    return this.inA2uiBlock ? 'in_json' : 'idle';
  }

  // ==========================================================================
  // 外层 — 标签检测
  // ==========================================================================

  private handleOutsideBlock(char: string): IncrementalResponsePart[] | null {
    this.tagAccumulator += char;

    if (this.tagAccumulator.endsWith(A2UI_OPEN_TAG)) {
      const prefix = this.tagAccumulator.slice(0, -OPEN_TAG_LEN);
      this.inA2uiBlock = true;
      this.stateMachine.reset();
      this.tagAccumulator = '';
      if (prefix.trim()) {
        return [{ type: 'text', text: prefix }];
      }
      return null;
    }

    if (this.tagAccumulator.length > MAX_TEXT_BUFFER) {
      const safe = this.tagAccumulator.slice(0, -OPEN_TAG_LEN);
      this.tagAccumulator = this.tagAccumulator.slice(-OPEN_TAG_LEN);
      if (safe.trim()) {
        return [{ type: 'text', text: safe }];
      }
    }

    return null;
  }

  // ==========================================================================
  // 内层 — JSON 解析
  // ==========================================================================

  private handleInsideBlock(char: string): void {
    if (char === '}') {
      const stack = this.stateMachine.braceStack;
      const top = stack.length > 0 ? stack[stack.length - 1] : null;
      this.stateMachine.processChar(char);
      if (top && top.type === '{') {
        const fragment = this.stateMachine.extractFragment(top.startPos);
        this.onBracketClose(fragment);
      }
      return;
    }

    this.stateMachine.processChar(char);
  }

  private onBracketClose(objectText: string): void {
    const obj = this.safeParse(objectText);
    if (!obj) return;

    const rec = obj as Record<string, unknown>;
    if (isComponentLike(rec)) {
      this.cacheComponent(rec as Record<string, unknown> & { id: string; component: string });
    } else if (typeof rec['version'] === 'string' && (rec['version'] as string).startsWith('v')) {
      this.detectMessageType(rec);
    }
  }

  private cacheComponent(comp: Record<string, unknown> & { id: string; component: string }): void {
    const existing = this.seenComponents.get(comp.id);
    this.seenComponents.set(comp.id, {
      id: comp.id,
      type: comp.component,
      props: comp,
      complete: true,
    });
    // 新组件 或 内容哈希变化（跨块覆盖/属性更新）→ 触发增量检测
    const contentChanged =
      !existing || !existing.complete || this.hashComponent(comp) !== this.hashComponent(existing.props);
    if (contentChanged) {
      this.topologyDirty = true;
    }
  }

  private detectMessageType(obj: Record<string, unknown>): void {
    if (obj['createSurface']) {
      this.activeMessageType = 'createSurface';
      const cs = obj['createSurface'] as Record<string, unknown>;
      this.surfaceId = (cs['surfaceId'] as string) ?? this.surfaceId;
      this.catalogId = (cs['catalogId'] as string) ?? this.catalogId;
    } else if (obj['updateComponents']) {
      this.activeMessageType = 'updateComponents';
      const uc = obj['updateComponents'] as Record<string, unknown>;
      this.surfaceId = (uc['surfaceId'] as string) ?? this.surfaceId;
    } else if (obj['updateDataModel']) {
      const ud = obj['updateDataModel'] as Record<string, unknown>;
      this.surfaceId = (ud['surfaceId'] as string) ?? this.surfaceId;
      const path = typeof ud['path'] === 'string' ? ud['path'] : '';
      this.dataModelDeltas.push({ path, value: ud['value'] });
      this.dataModelDirty = true;
    }
  }

  // ==========================================================================
  // 增量 yield
  // ==========================================================================

  private tryIncrementalYield(): IncrementalResponsePart | null {
    if (!this.topologyDirty && !this.dataModelDirty) return null;
    // surfaceId 尚未解析到（createSurface/updateComponents 外层对象未闭合）时不 yield，
    // 避免以兜底 'default' 创建无 catalog 的 surface，导致组件全部降级为未知组件
    if (!this.surfaceId) return null;

    this.sniffPartialComponents();
    this.recomputeReachability();

    // 组件粒度内容变化检测：仅下发新增/内容变化的组件与未达占位
    const components = this.buildPartialComponentList();
    const { dataModelDelta, dataModelDeltas } = this.dataModelDirty ? this.extractDataModelDelta() : {};
    this.dataModelDirty = false;

    if (components.length === 0 && dataModelDelta === undefined) return null;

    return {
      type: 'a2ui_partial',
      incremental: true,
      surfaceId: this.surfaceId,
      catalogId: this.catalogId ?? undefined,
      messageType: this.activeMessageType ?? 'updateComponents',
      components,
      dataModelDelta,
      dataModelDeltas,
    };
  }

  private recomputeReachability(): void {
    if (!this.topologyDirty) return;

    const completeComponents = Array.from(this.seenComponents.values())
      .filter((c) => c.complete)
      .map((c) => ({ id: c.id, ...c.props }) as { id?: string; [key: string]: unknown });

    if (completeComponents.length === 0) {
      this.topologyState = { dirty: false, reachable: new Set(), refFields: {} };
      return;
    }

    const refFields = extractRefFields(completeComponents);
    const { reachable } = analyzeTopology(completeComponents, refFields, {
      allowOrphanComponents: true,
      allowMissingRoot: true,
    });

    this.topologyState = { dirty: false, reachable, refFields };
  }

  private sniffPartialComponents(): void {
    const stack = this.stateMachine.braceStack;
    const openBrackets = this.stateMachine.getCurrentOpenBrackets();

    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (entry.type !== '{') continue;

      const raw = this.stateMachine.extractFragment(entry.startPos);
      if (raw.length < 10) continue;

      const normalizedRaw = normalizeSmartQuotes(raw);
      const withoutTrailing = removeTrailingCommas(normalizedRaw);

      const obj = this.safeParsePartial(withoutTrailing, openBrackets.slice(i));
      if (obj && isComponentLike(obj)) {
        const comp = obj as Record<string, unknown> & { id: string; component: string };
        if (!this.seenComponents.has(comp.id)) {
          this.seenComponents.set(comp.id, {
            id: comp.id,
            type: comp.component,
            props: comp,
            complete: false,
          });
          this.topologyDirty = true;
        }
      }
    }
  }

  /**
   * 构建增量下发组件列表（组件粒度内容变化检测）
   *
   * 与官方 DirectJsonStreamParser 的 `_yielded_contents` 一致：
   * - 完整组件：内容哈希变化时重新下发（props 更新）
   * - 引用未达组件：以 placeholder 下发一次（记录后不重复）
   */
  private buildPartialComponentList(): PartialComponent[] {
    const result: PartialComponent[] = [];
    const included = new Set<string>();

    for (const id of this.topologyState.reachable) {
      const cached = this.seenComponents.get(id);
      if (cached?.complete) {
        const contentHash = this.hashComponent(cached.props);
        if (this.yieldedContent.get(id) !== contentHash) {
          result.push({ id, type: cached.type, props: cached.props, isPlaceholder: false });
          this.yieldedContent.set(id, contentHash);
          included.add(id);
        }
      }
    }

    for (const parentId of this.topologyState.reachable) {
      const fields = this.topologyState.refFields[parentId];
      if (!fields) continue;

      for (const refs of Object.values(fields)) {
        for (const refId of refs) {
          if (included.has(refId)) continue;
          const cached = this.seenComponents.get(refId);
          if (!cached?.complete && this.yieldedContent.get(refId) !== 'p') {
            result.push({ id: refId, isPlaceholder: true });
            this.yieldedContent.set(refId, 'p');
            included.add(refId);
          }
        }
      }
    }

    return result;
  }

  /** 组件内容哈希（djb2） */
  private hashComponent(props: Record<string, unknown>): string {
    const raw = JSON.stringify(props);
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash + raw.charCodeAt(i)) >>> 0;
    }
    return `c:${hash.toString(36)}`;
  }

  private extractDataModelDelta(): { dataModelDelta: DataModelDelta; dataModelDeltas: DataModelDelta[] } {
    const dataModelDeltas = [...this.dataModelDeltas];
    this.dataModelDeltas = [];
    return {
      dataModelDelta: dataModelDeltas[0] ?? { path: '', value: undefined },
      dataModelDeltas,
    };
  }

  // ==========================================================================
  // JSON 解析
  // ==========================================================================

  private safeParse(json: string): unknown {
    try {
      return JSON.parse(json);
    } catch {
      if (this.config.autoFix) {
        const fixed = removeTrailingCommas(normalizeSmartQuotes(json));
        try {
          return JSON.parse(fixed);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private safeParsePartial(raw: string, openBrackets: Array<'{' | '['>): unknown {
    let healed = raw;
    for (let i = openBrackets.length - 1; i >= 0; i--) {
      healed += openBrackets[i] === '{' ? '}' : ']';
    }
    healed = removeTrailingCommas(healed);
    try {
      return JSON.parse(healed);
    } catch {
      return null;
    }
  }

  private parseCompleteJson(json: string): IncrementalResponsePart | null {
    const result = this.safeParse(json);
    if (!result) {
      return { type: 'a2ui_json', data: null, valid: false, errors: ['JSON parse failed'] };
    }

    const validationResult = this.validator.validateServerToClientMessage(result) as ValidationResult;
    if (validationResult.valid) {
      return { type: 'a2ui_json', data: result as never, valid: true };
    }
    return {
      type: 'a2ui_json',
      data: result as never,
      valid: false,
      errors: validationResult.errors.map((e: ValidationError) => `${e.path}: ${e.message}`),
    };
  }
}

export {
  IncrementalResponsePartSchema,
  PartialComponentSchema,
  IncrementalParserConfigSchema,
  DataModelDeltaSchema,
  type IncrementalResponsePart,
  type PartialComponent,
  type IncrementalParserConfigInput,
  type IncrementalParserConfig,
  type DataModelDelta,
} from './types.js';
