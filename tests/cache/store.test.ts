import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CacheStore } from "../../src/cache/store.js";

describe("CacheStore", () => {
	let store: CacheStore;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "oss-intel-test-"));
		store = new CacheStore(join(tempDir, "test-cache.db"));
	});

	afterEach(() => {
		store.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("returns null for missing keys", () => {
		expect(store.get("nonexistent")).toBeNull();
	});

	it("stores and retrieves string values", () => {
		store.set("key1", "hello", 60_000);
		expect(store.get<string>("key1")).toBe("hello");
	});

	it("stores and retrieves object values", () => {
		const data = { name: "test", count: 42, nested: { a: true } };
		store.set("obj", data, 60_000);
		expect(store.get("obj")).toEqual(data);
	});

	it("stores and retrieves array values", () => {
		const data = [1, 2, 3, "four"];
		store.set("arr", data, 60_000);
		expect(store.get("arr")).toEqual(data);
	});

	it("returns null for expired entries", () => {
		store.set("expired", "value", 1); // 1ms TTL
		// Wait for expiration
		const start = Date.now();
		while (Date.now() - start < 5) {
			/* spin */
		}
		expect(store.get("expired")).toBeNull();
	});

	it("overwrites existing keys", () => {
		store.set("key", "first", 60_000);
		store.set("key", "second", 60_000);
		expect(store.get<string>("key")).toBe("second");
	});

	it("has() returns true for existing keys", () => {
		store.set("exists", true, 60_000);
		expect(store.has("exists")).toBe(true);
	});

	it("has() returns false for missing keys", () => {
		expect(store.has("missing")).toBe(false);
	});

	it("has() returns false for expired keys", () => {
		store.set("expired", true, 1);
		const start = Date.now();
		while (Date.now() - start < 5) {
			/* spin */
		}
		expect(store.has("expired")).toBe(false);
	});

	it("delete() removes a key", () => {
		store.set("to-delete", "value", 60_000);
		store.delete("to-delete");
		expect(store.get("to-delete")).toBeNull();
	});

	it("clear() removes all entries", () => {
		store.set("a", 1, 60_000);
		store.set("b", 2, 60_000);
		store.clear();
		expect(store.get("a")).toBeNull();
		expect(store.get("b")).toBeNull();
	});

	it("purgeExpired() removes only expired entries", () => {
		store.set("fresh", "keep", 60_000);
		store.set("stale", "remove", 1);
		const start = Date.now();
		while (Date.now() - start < 5) {
			/* spin */
		}
		const purged = store.purgeExpired();
		expect(purged).toBe(1);
		expect(store.get<string>("fresh")).toBe("keep");
		expect(store.get("stale")).toBeNull();
	});
});
