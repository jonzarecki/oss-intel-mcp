import { createApp, el, esc, fmtTime, pct, scoreColor, timeColor } from "./shared";

interface PrHealth {
	mergeRate?: number;
	medianTimeToFirstReviewHours?: number;
	medianTimeToMergeHours?: number;
	label?: string;
}

interface IssueHealth {
	medianResponseTimeHours?: number;
	closeRate?: number;
}

interface ResponsivenessData {
	repo?: string;
	prHealth?: PrHealth;
	issueHealth?: IssueHealth;
	goodFirstIssueCount?: number;
}

function rateColor(r: number | null | undefined): string {
	if (r == null) return "var(--color-text-tertiary, #565f89)";
	return scoreColor(r);
}

function arcSvg(fraction: number, size: number, color: string): string {
	const s = 5;
	const r = (size - s) / 2;
	const sa = Math.PI * 0.75;
	const ta = Math.PI * 1.5;
	const ea = sa + ta * Math.min(fraction, 1);
	const cx = size / 2;
	const cy = size / 2;
	const bgX1 = cx + r * Math.cos(sa);
	const bgY1 = cy + r * Math.sin(sa);
	const bgX2 = cx + r * Math.cos(sa + ta);
	const bgY2 = cy + r * Math.sin(sa + ta);
	const x2 = cx + r * Math.cos(ea);
	const y2 = cy + r * Math.sin(ea);
	const la = ea - sa > Math.PI ? 1 : 0;
	let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
	svg += `<path d="M${bgX1.toFixed(1)},${bgY1.toFixed(1)} A${r},${r} 0 1,1 ${bgX2.toFixed(1)},${bgY2.toFixed(1)}" fill="none" stroke="var(--color-background-tertiary, #1a1b26)" stroke-width="${s}" stroke-linecap="round"/>`;
	if (fraction > 0) {
		svg += `<path d="M${bgX1.toFixed(1)},${bgY1.toFixed(1)} A${r},${r} 0 ${la},1 ${x2.toFixed(1)},${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${s}" stroke-linecap="round"/>`;
	}
	svg += "</svg>";
	return svg;
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as ResponsivenessData;
	const container = el("app");
	const pr = data.prHealth ?? {};
	const issue = data.issueHealth ?? {};
	let h = "";

	if (data.repo) {
		h += `<div class="repo-name">${esc(data.repo)}</div>`;
	}

	const mergeRate = pr.mergeRate ?? 0;
	const reviewH = pr.medianTimeToFirstReviewHours;
	const reviewMax = 168;

	h += '<div class="gauges">';
	h += '<div class="gauge">';
	h += arcSvg(mergeRate / 100, 80, rateColor(mergeRate));
	h += `<div class="gauge-val" style="color:${rateColor(mergeRate)}">${pct(mergeRate)}</div>`;
	h += '<div class="gauge-lbl">Merge Rate</div>';
	if (pr.label) h += `<div class="gauge-sub">${esc(pr.label)}</div>`;
	h += "</div>";

	h += '<div class="gauge">';
	h += arcSvg(reviewH != null ? Math.min(reviewH / reviewMax, 1) : 0, 80, timeColor(reviewH));
	h += `<div class="gauge-val" style="color:${timeColor(reviewH)}">${fmtTime(reviewH)}</div>`;
	h += '<div class="gauge-lbl">First Review</div>';
	h += `<div class="gauge-sub">${fmtTime(pr.medianTimeToMergeHours)} to merge</div>`;
	h += "</div>";
	h += "</div>";

	h += '<div class="stats">';
	h += `<div class="stat"><div class="stat-val" style="color:${timeColor(issue.medianResponseTimeHours)}">${fmtTime(issue.medianResponseTimeHours)}</div><div class="stat-lbl">Issue Response</div></div>`;
	h += `<div class="stat"><div class="stat-val">${pct(issue.closeRate)}</div><div class="stat-lbl">Close Rate</div></div>`;

	const gfi = data.goodFirstIssueCount;
	h += `<div class="stat"><div class="stat-val" style="color:${gfi != null && gfi > 0 ? "var(--color-text-info, #7dcfff)" : "var(--color-text-tertiary, #565f89)"}">${gfi != null ? gfi : "\u2014"}</div><div class="stat-lbl">Good First Issues</div></div>`;
	h += "</div>";

	container.innerHTML = h;
}

const app = createApp("responsiveness");

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
			`<div class="repo-name">${esc(name)}</div><div class="gauges"><div class="gauge" style="opacity:0.3">...</div></div>`;
	}
};
