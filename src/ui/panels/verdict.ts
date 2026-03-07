import { createApp, el, esc, scoreColor } from "./shared";

interface AnalyzeResult {
	repo?: { fullName?: string; language?: string; license?: string; archived?: boolean };
	verdict?: {
		score?: number;
		verdict?: string;
		breakdown?: Array<{ metric: string; score: number }>;
	};
}

function verdictKey(v: string | undefined): string {
	if (!v) return "caution";
	const l = v.toLowerCase();
	if (l.includes("safe")) return "safe";
	if (l.includes("risky")) return "risky";
	return "caution";
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as AnalyzeResult;
	const container = el("app");
	const v = data.verdict ?? {};
	const repo = data.repo ?? {};
	const cls = verdictKey(v.verdict);
	let h = "";

	h += '<div class="header">';
	h += `<span class="repo">${esc(repo.fullName)}</span>`;
	if (repo.language) h += `<span class="tag">${esc(repo.language)}</span>`;
	if (repo.license) h += `<span class="tag">${esc(repo.license)}</span>`;
	if (repo.archived) h += '<span class="tag archived">Archived</span>';
	h += "</div>";

	h += `<div class="hero ${cls}">`;
	h += `<span class="score">${v.score != null ? v.score : "?"}</span>`;
	h += `<span class="badge">${esc(v.verdict ?? "Unknown")}</span>`;
	h += "</div>";

	if (v.breakdown?.length) {
		h += '<div class="bars">';
		for (const b of v.breakdown) {
			const s = Math.round(b.score);
			h += '<div class="bar-row">';
			h += `<span class="bar-label">${esc(b.metric)}</span>`;
			h += `<div class="bar-track"><div class="bar-fill" style="width:${s}%;background:${scoreColor(s)}"></div></div>`;
			h += `<span class="bar-val">${s}</span>`;
			h += "</div>";
		}
		h += "</div>";
	}

	container.innerHTML = h;
}

const app = createApp("verdict");

app.ontoolresult = (result) => {
	if (result.structuredContent) render(result.structuredContent);
};

app.ontoolinputpartial = (params) => {
	const args = params.arguments;
	if (!args) return;
	const owner = args.owner as string | undefined;
	const repo = args.repo as string | undefined;
	if (owner || repo) {
		const name = owner && repo ? `${owner}/${repo}` : (owner ?? repo);
		el("app").innerHTML =
			`<div class="header"><span class="repo">${esc(name)}</span></div><div class="hero caution"><span class="score" style="opacity:0.3">...</span></div>`;
	}
};
