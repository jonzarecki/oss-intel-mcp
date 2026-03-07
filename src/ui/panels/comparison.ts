import { createApp, el, esc } from "./shared";

interface ComparisonValue {
	repo: string;
	value: number;
}

interface ComparisonRow {
	metric: string;
	values: ComparisonValue[];
	winner: string;
}

interface ComparisonData {
	comparison?: ComparisonRow[];
	recommendation?: string;
}

function shortName(fullName: string | undefined): string {
	return fullName ? (fullName.split("/").pop() ?? "") : "";
}

function render(d: Record<string, unknown>): void {
	const data = d as unknown as ComparisonData;
	const container = el("app");
	const comparison = data.comparison ?? [];
	let h = "";

	if (data.recommendation) {
		h += `<div class="rec">${esc(data.recommendation)}</div>`;
	}

	if (!comparison.length) {
		h +=
			'<div style="text-align:center;padding:40px;color:var(--color-text-tertiary,#565f89)">No comparison data</div>';
		container.innerHTML = h;
		return;
	}

	const repoNames = comparison[0].values.map((v) => v.repo);

	h += "<table>";
	h += "<thead><tr><th>Metric</th>";
	for (const n of repoNames) {
		h += `<th class="repo-col score-cell">${esc(shortName(n))}</th>`;
	}
	h += "</tr></thead><tbody>";

	for (const row of comparison) {
		h += "<tr>";
		h += `<td class="metric-name">${esc(row.metric)}</td>`;
		for (const v of row.values) {
			const isWinner = v.repo === row.winner;
			h += `<td class="score-cell${isWinner ? " winner" : ""}">${Math.round(v.value)}</td>`;
		}
		h += "</tr>";
	}

	h += "</tbody></table>";
	container.innerHTML = h;
}

const app = createApp("comparison");

app.ontoolresult = (result) => {
	if (result.structuredContent) render(result.structuredContent);
};

app.ontoolinputpartial = (params) => {
	const args = params.arguments;
	if (!args) return;
	const repos = args.repos as Array<{ owner?: string; repo?: string }> | undefined;
	if (repos?.length) {
		const names = repos
			.map((r) => (r.owner && r.repo ? `${r.owner}/${r.repo}` : (r.repo ?? r.owner ?? "")))
			.filter(Boolean);
		el("app").innerHTML =
			`<div class="rec" style="opacity:0.6">Comparing ${names.map((n) => esc(n)).join(" vs ")}…</div>`;
	}
};
