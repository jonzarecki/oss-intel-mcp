import { createApp, el, esc } from "./shared";

const COLORS = ["#7aa2f7", "#bb9af7", "#9ece6a", "#e0af68", "#f7768e"];

interface Contributor {
	login?: string;
	commits: number;
}

interface BusFactor {
	score?: number;
	isHighRisk?: boolean;
	giniCoefficient?: number;
	top2Share?: number;
}

interface AnalyzeRepoResult {
	metrics?: {
		busFactor?: BusFactor;
		affiliation?: {
			topContributors?: Contributor[];
		};
	};
}

function busScoreColor(s: number): string {
	if (s >= 60) return "var(--color-text-success, #9ece6a)";
	if (s >= 30) return "var(--color-text-warning, #e0af68)";
	return "var(--color-text-danger, #f7768e)";
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as AnalyzeRepoResult;
	const container = el("app");
	const m = data.metrics ?? {};
	const bf = m.busFactor ?? {};
	const aff = m.affiliation ?? {};
	const topC = aff.topContributors ?? [];
	let h = "";

	h += '<div class="head">';
	h += '<span class="title">Bus Factor</span>';
	if (bf.isHighRisk) {
		h += '<span class="risk-badge risk-high">\u26A0 High Risk</span>';
	} else {
		h += '<span class="risk-badge risk-ok">\u2713 Healthy</span>';
	}
	h += "</div>";

	h += `<div class="big-score" style="color:${busScoreColor(bf.score ?? 0)}">${bf.score != null ? bf.score : "\u2014"}</div>`;

	if (topC.length) {
		const maxCommits = topC[0].commits || 1;
		h += '<div class="contributors">';
		for (const [i, c] of topC.slice(0, 5).entries()) {
			const pctVal = Math.round((c.commits / maxCommits) * 100);
			h += '<div class="c-row">';
			h += `<span class="c-name">${esc(c.login)}</span>`;
			h += `<div class="c-bar-track"><div class="c-bar-fill" style="width:${pctVal}%;background:${COLORS[i % COLORS.length]}"></div></div>`;
			h += `<span class="c-pct">${c.commits}</span>`;
			h += "</div>";
		}
		h += "</div>";
	}

	h += '<div class="meta">';
	h += `<div class="meta-item"><span class="meta-val">${bf.giniCoefficient != null ? bf.giniCoefficient.toFixed(2) : "\u2014"}</span><span class="meta-lbl">Gini</span></div>`;
	h += `<div class="meta-item"><span class="meta-val">${bf.top2Share != null ? `${Math.round(bf.top2Share * 100)}%` : "\u2014"}</span><span class="meta-lbl">Top 2 Share</span></div>`;
	h += "</div>";

	container.innerHTML = h;
}

const app = createApp("bus-factor");

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
			`<div class="head"><span class="title">Bus Factor</span></div><div class="big-score" style="opacity:0.3">${esc(name)}</div>`;
	}
};
