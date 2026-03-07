import { createApp, el, esc } from "./shared";

const COLORS = ["#7aa2f7", "#bb9af7", "#e0af68", "#f7768e", "#7dcfff", "#ff9e64", "#73daca"];

interface OrgShare {
	organization?: string;
	percentage: number;
}

interface AnalyzeRepoResult {
	metrics?: {
		affiliation?: {
			corporatePercentage?: number;
			elephantFactor?: number;
			orgShares?: OrgShare[];
		};
	};
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as AnalyzeRepoResult;
	const container = el("app");
	const m = data.metrics ?? {};
	const aff = m.affiliation ?? {};
	const orgShares = aff.orgShares ?? [];
	const corpPct = aff.corporatePercentage != null ? Math.round(aff.corporatePercentage) : 0;
	const indPct = 100 - corpPct;
	const ef = aff.elephantFactor;
	let h = "";

	h += '<div class="head">';
	h += '<span class="title">Corporate Backing</span>';
	if (ef != null) h += `<span class="ef-badge">EF: ${ef}</span>`;
	h += "</div>";

	h += '<div class="split">';
	h += '<div class="split-bar">';
	if (corpPct > 0)
		h += `<div class="split-corp" style="width:${corpPct}%">${corpPct > 8 ? `${corpPct}%` : ""}</div>`;
	if (indPct > 0)
		h += `<div class="split-indep" style="width:${indPct}%">${indPct > 8 ? `${indPct}%` : ""}</div>`;
	h += "</div>";
	h += '<div class="split-legend">';
	h += `<span class="split-legend-item"><span class="leg-dot" style="background:var(--color-text-info, #7aa2f7)"></span>Corporate ${corpPct}%</span>`;
	h += `<span class="split-legend-item"><span class="leg-dot" style="background:var(--color-text-success, #9ece6a)"></span>Independent ${indPct}%</span>`;
	h += "</div>";
	h += "</div>";

	const corpOrgs = orgShares.filter((o) => {
		const n = (o.organization ?? "").toLowerCase();
		return n !== "independent" && n !== "unaffiliated";
	});

	if (corpOrgs.length) {
		const maxPct = corpOrgs[0].percentage || 1;
		h += '<div class="orgs">';
		for (const [i, o] of corpOrgs.slice(0, 5).entries()) {
			const barW = Math.round((o.percentage / maxPct) * 100);
			h += '<div class="org-row">';
			h += `<span class="org-name">${esc(o.organization)}</span>`;
			h += `<div class="org-bar-track"><div class="org-bar-fill" style="width:${barW}%;background:${COLORS[i % COLORS.length]}"></div></div>`;
			h += `<span class="org-pct">${Math.round(o.percentage)}%</span>`;
			h += "</div>";
		}
		h += "</div>";
	} else {
		h +=
			'<div style="font-size:var(--font-text-sm-size, 13px);color:var(--color-text-tertiary, #565f89);margin-top:8px">Community-driven project \u2014 no dominant corporate backers detected</div>';
	}

	container.innerHTML = h;
}

const app = createApp("corporate-backing");

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
			`<div class="head"><span class="title">Corporate Backing</span></div><div style="opacity:0.3">${esc(name)}</div>`;
	}
};
