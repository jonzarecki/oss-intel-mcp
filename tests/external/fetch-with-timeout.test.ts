import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../../src/external/fetch-with-timeout.js";

describe("fetchWithTimeout", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns response on success", async () => {
		const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
		vi.mocked(fetch).mockResolvedValue(mockResponse);

		const result = await fetchWithTimeout("https://example.com/api");
		expect(result).toBeTruthy();
	});

	it("returns null on non-OK response", async () => {
		const mockResponse = new Response("Not Found", { status: 404 });
		vi.mocked(fetch).mockResolvedValue(mockResponse);

		const result = await fetchWithTimeout("https://example.com/api");
		expect(result).toBeNull();
	});

	it("returns null on network error", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		const result = await fetchWithTimeout("https://example.com/api");
		expect(result).toBeNull();
	});

	it("returns null on timeout", async () => {
		vi.mocked(fetch).mockImplementation(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					const signal = (init as RequestInit | undefined)?.signal;
					if (signal) {
						signal.addEventListener("abort", () => reject(new DOMException("Aborted")));
					}
				}),
		);

		const result = await fetchWithTimeout("https://example.com/api", 50);
		expect(result).toBeNull();
	});
});
