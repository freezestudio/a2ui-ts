import type { DataBinding } from '../schema/schemas.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertSafeSegments(path: string): void {
  const segments = path.split('/').filter(Boolean);
  for (const seg of segments) {
    const decoded = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (FORBIDDEN_KEYS.has(decoded)) {
      throw new Error(`Forbidden path segment '${decoded}' in path '${path}'`);
    }
  }
}

export type { DataBinding, FunctionCall } from '../schema/schemas.js';

export function isDataBinding(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'path' in value &&
    typeof (value as Record<string, unknown>)['path'] === 'string' &&
    !('call' in value) &&
    !('component' in value)
  );
}

export function isFunctionCall(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'call' in value &&
    typeof (value as Record<string, unknown>)['call'] === 'string'
  );
}

export function resolvePath(
  binding: DataBinding,
  dataModel: Record<string, unknown>,
  context?: Record<string, unknown>,
): unknown {
  if (binding.path === '@index' && context?.['@index'] !== undefined) {
    return context['@index'];
  }
  if (binding.path.startsWith('@index(') && context?.['@index'] !== undefined) {
    const named = binding.path.match(/^@index\(\s*offset\s*:\s*(-?\d+)\s*\)$/);
    const positional = binding.path.match(/^@index\((-?\d+)\)$/);
    const match = named ?? positional;
    if (match) return (context['@index'] as number) + parseInt(match[1], 10);
  }
  if (binding.path === '@index' || binding.path.startsWith('@index(')) {
    throw new Error('@index 只能在 ChildList 模板中使用');
  }

  const path = binding.path;
  if (!path || path === '/') {
    return dataModel;
  }

  const segments = path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

  assertSafeSegments(path);

  let current: unknown = dataModel;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return current;
}

export function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  assertSafeSegments(path);
  if (path === '/' || !path) {
    for (const key of Object.keys(obj)) delete obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(obj, value);
    }
    return;
  }

  const segments = path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] !== 'object' || current[seg] === null) {
      const nextSeg = segments[i + 1];
      current[seg] = /^\d+$/.test(nextSeg) ? [] : {};
    }
    current = current[seg] as Record<string, unknown>;
  }

  const last_seg = segments[segments.length - 1];
  current[last_seg] = value;
}

export function deleteAtPath(obj: Record<string, unknown>, path: string): void {
  assertSafeSegments(path);
  const segments = path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));

  if (segments.length === 0) return;

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] !== 'object') return;
    current = current[seg] as Record<string, unknown>;
  }

  delete current[segments[segments.length - 1]];
}
