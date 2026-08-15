import { describe, it, expect } from 'vite-plus/test';
import { SchemaValidator } from '../../src/harness/schema-validator';
import { OFFICIAL_CONTACT_FORM_JSONL } from '../../src/harness/official-cases';
import { readFileSync } from 'node:fs';

describe('JSONL 端到端流式场景（官方 contact_form_example.jsonl）', () => {
  const validator = new SchemaValidator();
  validator.loadSchemas();

  it('contact_form_example.jsonl 每行独立通过 agent_to_renderer.json 验证', () => {
    const content = readFileSync(OFFICIAL_CONTACT_FORM_JSONL, 'utf-8');
    const lines = content.trim().split('\n');

    expect(lines.length).toBeGreaterThan(0);

    for (let i = 0; i < lines.length; i++) {
      const data = JSON.parse(lines[i]);
      const result = validator.validate('agent_to_renderer.json', data);
      expect(result.valid, `第 ${i + 1} 行应通过验证: ${JSON.stringify(data).slice(0, 100)}`).toBe(true);
    }
  });

  it('JSONL 场景覆盖完整生命周期（createSurface → updateComponents → updateDataModel → deleteSurface）', () => {
    const content = readFileSync(OFFICIAL_CONTACT_FORM_JSONL, 'utf-8');
    const lines = content.trim().split('\n');
    const messages = lines.map((l) => JSON.parse(l));

    const hasCreate = messages.some((m: Record<string, unknown>) => 'createSurface' in m);
    const hasUpdate = messages.some((m: Record<string, unknown>) => 'updateComponents' in m);
    const hasDataModel = messages.some((m: Record<string, unknown>) => 'updateDataModel' in m);
    const hasDelete = messages.some((m: Record<string, unknown>) => 'deleteSurface' in m);

    expect(hasCreate).toBe(true);
    expect(hasUpdate).toBe(true);
    expect(hasDataModel).toBe(true);
    expect(hasDelete).toBe(true);
  });
});
