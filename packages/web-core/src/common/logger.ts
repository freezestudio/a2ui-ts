import { z } from 'zod';

export const rendererLogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export type RendererLogLevel = z.infer<typeof rendererLogLevelSchema>;

const LEVEL_ORDER: Record<RendererLogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveLevel(): RendererLogLevel {
  if (typeof window !== 'undefined') {
    const v = (window as unknown as { __A2UI_LOG_LEVEL__?: RendererLogLevel }).__A2UI_LOG_LEVEL__;
    if (v && v in LEVEL_ORDER) return v;
  }
  const env = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string> }).env : undefined;
  const fromEnv = env?.['A2UI_LOG_LEVEL'];
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv as RendererLogLevel;
  return 'info';
}

let currentLevel: RendererLogLevel = resolveLevel();

export function setRendererLogLevel(level: RendererLogLevel): void {
  currentLevel = level;
}

function enabled(level: RendererLogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

export function createRendererLogger(scope: string) {
  const prefix = `[A2UI:${scope}]`;
  return {
    debug(marker: string, data?: Record<string, unknown>): void {
      if (!enabled('debug')) return;
      console.debug(prefix, marker, data ? formatData(data) : '');
    },
    info(marker: string, data?: Record<string, unknown>): void {
      if (!enabled('info')) return;
      console.info(prefix, marker, data ? formatData(data) : '');
    },
    warn(marker: string, data?: Record<string, unknown>): void {
      if (!enabled('warn')) return;
      console.warn(prefix, marker, data ? formatData(data) : '');
    },
    error(marker: string, data?: Record<string, unknown>): void {
      if (!enabled('error')) return;
      console.error(prefix, marker, data ? formatData(data) : '');
    },
  };
}

function formatData(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data as unknown as string | number | bigint | symbol);
  }
}

export type RendererLogger = ReturnType<typeof createRendererLogger>;
