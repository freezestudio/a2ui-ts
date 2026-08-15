import pino from 'pino';
import pretty from 'pino-pretty';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const PRETTY_OPTIONS = {
  translateTime: 'SYS:standard',
  ignore: 'pid,hostname',
};

/**
 * 解析日志输出目录。
 *
 * 优先使用 `LOG_DIR` 环境变量；未设置时向上查找 monorepo 根
 * （`pnpm-workspace.yaml` 标记），日志统一落到根目录 `logs/`；
 * 无标记（单包项目）则回退 `cwd/logs`。
 */
function getLogDir(): string {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, 'logs');
    }
    dir = dirname(dir);
  }
  return resolve(process.cwd(), 'logs');
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * 创建 pino 日志器。
 *
 * - 始终输出到控制台（pretty）
 * - `file`: 分类日志文件名（如 `'server.log'`），写入 `LOG_DIR/{file}`
 * - `llm: true`: 额外写入 `llm.log`（debug 级别）
 * - 自动将 error 级别以上日志写入 `error.log`
 * - `LOG_DIR` 环境变量控制输出目录；未设置时默认 monorepo 根 `logs/`
 */
function buildLogger(
  logDir: string,
  options: {
    name?: string;
    level?: LogLevel;
    pretty?: boolean;
    file?: string;
    llm?: boolean;
  },
): pino.Logger {
  const {
    name = 'a2ui',
    level = (process.env.LOG_LEVEL as LogLevel) || 'info',
    pretty: doPretty = process.env.NODE_ENV !== 'production',
    file,
    llm = false,
  } = options;

  const baseConfig: pino.LoggerOptions = {
    name,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  ensureDir(logDir);
  const streams: pino.StreamEntry[] = [];

  if (doPretty) {
    streams.push({ stream: pretty({ ...PRETTY_OPTIONS, colorize: true }), level });
  } else {
    streams.push({ stream: process.stdout, level });
  }

  if (file) {
    streams.push({
      stream: createWriteStream(resolve(logDir, file), { flags: 'a' }),
      level,
    });
  }

  if (llm) {
    streams.push({
      stream: createWriteStream(resolve(logDir, 'llm.log'), { flags: 'a' }),
      level: 'debug',
    });
  }

  // 所有 logger 的 error 级别自动归入 error.log
  streams.push({
    stream: createWriteStream(resolve(logDir, 'error.log'), { flags: 'a' }),
    level: 'error',
  });

  return pino(baseConfig, pino.multistream(streams));
}

export function createLogger(
  options: {
    name?: string;
    level?: LogLevel;
    pretty?: boolean;
    file?: string;
    llm?: boolean;
  } = {},
): pino.Logger {
  return buildLogger(getLogDir(), options);
}

// 默认实例延迟初始化，确保调用方有机会先设置 process.env.LOG_DIR
let _logger: pino.Logger | undefined;
const loggerHandler: ProxyHandler<pino.Logger> = {
  get(_target, prop: string | symbol) {
    if (!_logger) {
      _logger = buildLogger(getLogDir(), {});
    }
    return Reflect.get(_logger, prop, _logger);
  },
};
export const logger: pino.Logger = new Proxy({} as pino.Logger, loggerHandler);

export function createChildLogger(name: string): pino.Logger {
  return logger.child({ module: name });
}
