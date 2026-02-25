// ─── 構造化ロガー（NFR-04a） ─────────────────────────

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: { name: string; message: string; stack?: string };
}

const LOG_LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

function getCurrentLevel(): number {
    const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
    return LOG_LEVELS[env] ?? LOG_LEVELS.info;
}

function formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
): LogEntry {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
    };
    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }
    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return entry;
}

function emit(level: LogLevel, entry: LogEntry): void {
    if (LOG_LEVELS[level] > getCurrentLevel()) return;

    const json = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
        console.error(json);
    } else {
        console.log(json);
    }
}

/**
 * 構造化ロガー。
 * JSON 形式でログを出力する。
 * `LOG_LEVEL` 環境変数でフィルタリング（デフォルト: info）。
 */
export const logger = {
    error(message: string, context?: Record<string, unknown>, error?: Error): void {
        emit('error', formatEntry('error', message, context, error));
    },
    warn(message: string, context?: Record<string, unknown>): void {
        emit('warn', formatEntry('warn', message, context));
    },
    info(message: string, context?: Record<string, unknown>): void {
        emit('info', formatEntry('info', message, context));
    },
    debug(message: string, context?: Record<string, unknown>): void {
        emit('debug', formatEntry('debug', message, context));
    },
};
