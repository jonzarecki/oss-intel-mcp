import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

const DEFAULT_DB_PATH = join(homedir(), ".oss-intel", "cache.db");
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class CacheStore {
	private db: Database.Database;
	private purgeTimer: ReturnType<typeof setInterval> | undefined;

	private getStmt: Database.Statement;
	private setStmt: Database.Statement;
	private deleteStmt: Database.Statement;
	private purgeStmt: Database.Statement;
	private clearStmt: Database.Statement;

	constructor(dbPath: string = DEFAULT_DB_PATH) {
		mkdirSync(dirname(dbPath), { recursive: true });
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS cache (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				expires_at INTEGER NOT NULL
			)
		`);

		this.getStmt = this.db.prepare("SELECT value, expires_at FROM cache WHERE key = ?");
		this.setStmt = this.db.prepare(
			"INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
		);
		this.deleteStmt = this.db.prepare("DELETE FROM cache WHERE key = ?");
		this.purgeStmt = this.db.prepare("DELETE FROM cache WHERE expires_at <= ?");
		this.clearStmt = this.db.prepare("DELETE FROM cache");

		this.purgeTimer = setInterval(() => this.purgeExpired(), PURGE_INTERVAL_MS);
		if (this.purgeTimer.unref) {
			this.purgeTimer.unref();
		}
	}

	get<T>(key: string): T | null {
		const row = this.getStmt.get(key) as { value: string; expires_at: number } | undefined;
		if (!row) return null;

		if (row.expires_at <= Date.now()) {
			this.deleteStmt.run(key);
			return null;
		}

		return JSON.parse(row.value) as T;
	}

	set(key: string, value: unknown, ttlMs: number): void {
		const expiresAt = Date.now() + ttlMs;
		this.setStmt.run(key, JSON.stringify(value), expiresAt);
	}

	has(key: string): boolean {
		return this.get(key) !== null;
	}

	delete(key: string): void {
		this.deleteStmt.run(key);
	}

	clear(): void {
		this.clearStmt.run();
	}

	purgeExpired(): number {
		const result = this.purgeStmt.run(Date.now());
		return result.changes;
	}

	close(): void {
		if (this.purgeTimer) {
			clearInterval(this.purgeTimer);
			this.purgeTimer = undefined;
		}
		this.db.close();
	}
}
