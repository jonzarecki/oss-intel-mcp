import { createApp, el, esc } from "./shared";

interface ActivityTrend {
	trend?: string;
	percentageChange?: number;
	recentCommits?: number;
	previousCommits?: number;
}

interface ReleaseCadence {
	averageIntervalDays?: number;
	label?: string;
}

interface AnalyzeRepoResult {
	metrics?: {
		activityTrend?: ActivityTrend;
		releaseCadence?: ReleaseCadence;
	};
}

function trendColor(t: string | undefined): string {
	if (t === "growing") return "var(--color-text-success, #9ece6a)";
	if (t === "declining") return "var(--color-text-danger, #f7768e)";
	return "var(--color-text-warning, #e0af68)";
}

function trendArrow(t: string | undefined): string {
	if (t === "growing") return "\u2197";
	if (t === "declining") return "\u2198";
	return "\u2192";
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as AnalyzeRepoResult;
	const container = el("app");
	const m = data.metrics ?? {};
	const at = m.activityTrend ?? {};
	const rc = m.releaseCadence ?? {};
	let h = "";

	h += '<div class="title">Activity Pulse</div>';

	const col = trendColor(at.trend);
	const arrow = trendArrow(at.trend);
	const pctVal = at.percentageChange != null ? Math.abs(Math.round(at.percentageChange * 100)) : 0;
	const label = (at.trend ?? "unknown").charAt(0).toUpperCase() + (at.trend ?? "unknown").slice(1);

	h += '<div class="trend-row">';
	h += `<span class="trend-arrow" style="color:${col}">${arrow}</span>`;
	h += `<span class="trend-pct" style="color:${col}">${pctVal}%</span>`;
	h += `<span class="trend-label">${label}</span>`;
	h += "</div>";

	const recent = at.recentCommits ?? 0;
	const prev = at.previousCommits ?? 0;

	h += '<div class="compare">';
	h += `<div class="compare-box"><div class="compare-val" style="color:var(--color-text-info, #7aa2f7)">${recent}</div><div class="compare-lbl">Recent (3 mo)</div></div>`;
	h += `<div class="compare-box"><div class="compare-val">${prev}</div><div class="compare-lbl">Previous (3 mo)</div></div>`;
	h += "</div>";

	const total = Math.max(recent + prev, 1);
	h += '<div class="bar-compare">';
	h += `<div class="bar-recent" style="width:${Math.round((recent / total) * 100)}%"></div>`;
	h += `<div class="bar-prev" style="width:${Math.round((prev / total) * 100)}%"></div>`;
	h += "</div>";

	const interval = rc.averageIntervalDays;
	h += '<div class="release-row">';
	h += '<div class="release-info"><div class="release-lbl">Release Cadence</div>';
	h += `<div class="release-sub">${esc(rc.label ?? "unknown")}</div></div>`;
	h += `<div class="release-val">${interval != null ? `${Math.round(interval)}d` : "\u2014"}</div>`;
	h += "</div>";

	container.innerHTML = h;
}

const app = createApp("activity-pulse");

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
			`<div class="title">Activity Pulse</div><div class="trend-row"><span class="trend-arrow" style="opacity:0.3">\u2192</span><span class="trend-label">${esc(name)}</span></div>`;
	}
};
