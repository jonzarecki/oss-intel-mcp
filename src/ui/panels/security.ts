import { createApp, el, esc, scoreColor } from "./shared";

interface SubScore {
	name?: string;
	score: number;
	maxScore: number;
}

interface SecurityMetrics {
	overallScore?: number;
	subScores?: SubScore[];
}

interface AnalyzeRepoResult {
	metrics?: {
		security?: SecurityMetrics;
	};
}

function gradeLabel(s: number): string {
	if (s >= 80) return "Excellent";
	if (s >= 60) return "Good";
	if (s >= 40) return "Fair";
	if (s >= 20) return "Poor";
	return "Critical";
}

function ringChart(score: number, size: number): string {
	const s = 5;
	const r = (size - s) / 2;
	const c = 2 * Math.PI * r;
	const offset = c - (score / 100) * c;
	const col = scoreColor(score);
	const cx = size / 2;
	const cy = size / 2;
	let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
	svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-background-secondary, #24283b)" stroke-width="${s}"/>`;
	svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${s}"`;
	svg += ` stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round"`;
	svg += ` transform="rotate(-90 ${cx} ${cy})"/>`;
	svg += "</svg>";
	return svg;
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as AnalyzeRepoResult;
	const container = el("app");
	const m = data.metrics ?? {};
	const sec = m.security;
	let h = "";

	h += '<div class="title">Security</div>';

	if (!sec || sec.overallScore == null) {
		h += '<div class="no-data">No OpenSSF Scorecard data available for this repository</div>';
		container.innerHTML = h;
		return;
	}

	const s = sec.overallScore;
	const normalized = Math.round(s * 10);
	const col = scoreColor(normalized);

	h += '<div class="hero">';
	h += ringChart(normalized, 72);
	h += '<div class="hero-info">';
	h += `<div class="hero-score" style="color:${col}">${s.toFixed(1)} <span class="hero-max">/ 10</span></div>`;
	h += `<div class="hero-grade" style="color:${col}">${gradeLabel(normalized)}</div>`;
	h += "</div></div>";

	const subs = sec.subScores ?? [];
	if (subs.length) {
		h += '<div class="checks">';
		for (const check of subs.slice(0, 6)) {
			const pctVal = check.maxScore > 0 ? (check.score / check.maxScore) * 100 : 0;
			const cCol = scoreColor(pctVal);
			h += '<div class="check">';
			h += `<span class="check-score" style="color:${cCol}">${check.score}/${check.maxScore}</span>`;
			h += `<span class="check-name">${esc(check.name)}</span>`;
			h += `<div class="check-bar"><div class="check-bar-fill" style="width:${Math.round(pctVal)}%;background:${cCol}"></div></div>`;
			h += "</div>";
		}
		h += "</div>";
	}

	container.innerHTML = h;
}

const app = createApp("security");

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
			`<div class="title">Security</div><div class="hero" style="opacity:0.3">${esc(name)}</div>`;
	}
};
