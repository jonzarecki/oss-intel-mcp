/**
 * Lightweight MCP App for UI panels.
 * Implements the ext-apps JSON-RPC protocol without pulling in the full SDK (~400KB).
 */

interface ToolResult {
	content?: Array<{ type: string; text?: string }>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
}

interface HostContext {
	theme?: "light" | "dark";
	displayMode?: string;
	styles?: {
		variables?: Record<string, string>;
		css?: { fonts?: string };
	};
	safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
}

export interface LiteApp {
	ontoolresult: ((result: ToolResult) => void) | null;
	ontoolinputpartial: ((params: { arguments?: Record<string, unknown> }) => void) | null;
	onhostcontextchanged: ((ctx: HostContext) => void) | null;
	getHostContext: () => HostContext | null;
}

export function createApp(name: string): LiteApp {
	let _rid = 0;
	let _hostCtx: HostContext | null = null;

	const app: LiteApp = {
		ontoolresult: null,
		ontoolinputpartial: null,
		onhostcontextchanged: null,
		getHostContext: () => _hostCtx,
	};

	function post(msg: unknown): void {
		try {
			window.parent.postMessage(msg, "*");
		} catch {
			/* sandboxed */
		}
	}

	function initResult(id: number | string, protocolVersion?: string): void {
		post({
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: protocolVersion || "2026-01-26",
				appInfo: { name, version: "0.2.0" },
				appCapabilities: {},
			},
		});
		post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
	}

	function handleHostContext(ctx: HostContext): void {
		_hostCtx = { ..._hostCtx, ...ctx };
		if (ctx.theme) document.documentElement.dataset.theme = ctx.theme;
		if (ctx.styles?.variables) {
			const root = document.documentElement;
			for (const [key, value] of Object.entries(ctx.styles.variables)) {
				if (value) root.style.setProperty(`--${key}`, value);
			}
		}
		if (ctx.styles?.css?.fonts) {
			let styleEl = document.getElementById("host-fonts") as HTMLStyleElement | null;
			if (!styleEl) {
				styleEl = document.createElement("style");
				styleEl.id = "host-fonts";
				document.head.appendChild(styleEl);
			}
			styleEl.textContent = ctx.styles.css.fonts;
		}
		app.onhostcontextchanged?.(ctx);
	}

	window.addEventListener("message", (event: MessageEvent) => {
		const m = event.data;
		if (!m || typeof m !== "object") return;

		if (m.jsonrpc === "2.0") {
			if (m.id != null && m.method) {
				switch (m.method) {
					case "ui/resource-teardown":
					case "ping":
						post({ jsonrpc: "2.0", id: m.id, result: {} });
						break;
					case "ui/initialize":
						initResult(m.id, m.params?.protocolVersion);
						if (m.params?.hostContext) handleHostContext(m.params.hostContext);
						break;
				}
				return;
			}

			switch (m.method) {
				case "ui/notifications/tool-result": {
					const data = extractData(m.params);
					if (data) app.ontoolresult?.({ structuredContent: data, content: m.params?.content });
					break;
				}
				case "ui/notifications/tool-input-partial":
					app.ontoolinputpartial?.(m.params ?? {});
					break;
				case "ui/notifications/host-context-changed":
					if (m.params) handleHostContext(m.params as HostContext);
					break;
			}

			return;
		}

		// Legacy fallbacks for older hosts
		if (m.type === "tool-result" || m.type === "toolResult") {
			const d = m.structuredContent || m.data || m.result;
			if (d) app.ontoolresult?.({ structuredContent: d });
		} else if (m.method === "tools/call_result" && m.params) {
			const d = extractData(m.params);
			if (d) app.ontoolresult?.({ structuredContent: d });
		}
	});

	// Initiate handshake
	post({
		jsonrpc: "2.0",
		id: ++_rid,
		method: "ui/initialize",
		params: {
			protocolVersion: "2026-01-26",
			appInfo: { name, version: "0.2.0" },
			appCapabilities: {},
		},
	});
	setTimeout(() => {
		post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
	}, 50);

	return app;
}

function extractData(params: Record<string, unknown> | undefined): Record<string, unknown> | null {
	if (!params) return null;
	if (params.structuredContent) return params.structuredContent as Record<string, unknown>;
	const content = params.content as Array<{ type: string; text?: string }> | undefined;
	if (content) {
		for (const block of content) {
			if (block.type === "text" && block.text) {
				try {
					return JSON.parse(block.text) as Record<string, unknown>;
				} catch {
					/* skip */
				}
			}
		}
	}
	return null;
}

// --- Shared helpers ---

export function esc(s: string | null | undefined): string {
	if (!s) return "";
	const el = document.createElement("span");
	el.textContent = s;
	return el.innerHTML;
}

export function fmt(n: number | null | undefined): string {
	if (n == null) return "\u2014";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

export function fmtTime(hours: number | null | undefined): string {
	if (hours == null) return "\u2014";
	if (hours < 1) return `${Math.round(hours * 60)}m`;
	if (hours < 24) return `${Math.round(hours)}h`;
	return `${Math.floor(hours / 24)}d`;
}

export function pct(n: number | null | undefined): string {
	return n == null ? "\u2014" : `${Math.round(n)}%`;
}

export function scoreColor(s: number): string {
	if (s >= 70) return "var(--color-text-success, #9ece6a)";
	if (s >= 40) return "var(--color-text-warning, #e0af68)";
	return "var(--color-text-danger, #f7768e)";
}

export function timeColor(h: number | null | undefined): string {
	if (h == null) return "var(--color-text-tertiary, #565f89)";
	if (h <= 24) return "var(--color-text-success, #9ece6a)";
	if (h <= 72) return "var(--color-text-warning, #e0af68)";
	return "var(--color-text-danger, #f7768e)";
}

export function el(id: string): HTMLElement {
	return document.getElementById(id) as HTMLElement;
}
