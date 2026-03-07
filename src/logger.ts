type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	silent: 4,
};

const envLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();
const currentLevel = LEVELS[envLevel as LogLevel] ?? LEVELS.info;

function write(level: LogLevel, message: string, data?: Record<string, unknown>): void {
	if (LEVELS[level] < currentLevel) return;
	const entry = {
		ts: new Date().toISOString(),
		level,
		msg: message,
		...data,
	};
	process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export const log = {
	debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
	info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
	warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
	error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
