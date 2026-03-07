const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Wrapper around fetch that adds a timeout and returns null on any failure.
 * Used by all external API clients for graceful degradation.
 */
export async function fetchWithTimeout(
	url: string,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response | null> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(url, { signal: controller.signal });
		clearTimeout(timer);

		if (!response.ok) return null;
		return response;
	} catch {
		return null;
	}
}
