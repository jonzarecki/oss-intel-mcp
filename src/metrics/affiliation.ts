import type {
	AffiliationEntry,
	AffiliationInput,
	AffiliationResult,
	OrgShare,
	UserProfileData,
} from "./types.js";

export function computeAffiliation(input: AffiliationInput): AffiliationResult {
	const {
		userProfiles,
		ossInsightOrgs,
		contributorCommits,
		commitEmails,
		userOrgs,
		repoOwner,
		userNames,
	} = input;

	const ossInsightOrgMap = buildOssInsightLookup(ossInsightOrgs);

	const contributors: AffiliationEntry[] = userProfiles.map((u) => ({
		login: u.login,
		organization: resolveOrganization(
			u.login,
			u,
			commitEmails.get(u.login) ?? [],
			ossInsightOrgMap.get(u.login.toLowerCase()) ?? null,
			userOrgs?.get(u.login) ?? null,
			repoOwner ?? null,
			userNames?.get(u.login) ?? null,
		),
		commits: contributorCommits.get(u.login) ?? 0,
	}));

	const orgShares = computeOrgSharesFromProfiles(contributors);

	const totalCommits = contributors.reduce((s, c) => s + c.commits, 0);
	const corporateCommits = contributors
		.filter((c) => c.organization !== "Independent")
		.reduce((s, c) => s + c.commits, 0);
	const corporatePercentage = totalCommits > 0 ? corporateCommits / totalCommits : 0;

	const orgCommitMap = new Map<string, number>();
	for (const c of contributors) {
		if (c.organization === "Independent") continue;
		orgCommitMap.set(c.organization, (orgCommitMap.get(c.organization) ?? 0) + c.commits);
	}
	const elephantFactor = computeElephantFactor(orgCommitMap);

	const score = computeAffiliationScore(elephantFactor, corporatePercentage);

	return {
		topContributors: contributors.slice(0, 10),
		orgShares: [...orgShares].sort((a, b) => b.percentage - a.percentage).slice(0, 15),
		corporatePercentage: Math.round(corporatePercentage * 1000) / 1000,
		elephantFactor,
		score: Math.max(0, Math.min(100, score)),
	};
}

/**
 * Elephant Factor: minimum number of companies whose employees
 * contribute at least `threshold` (default 50%) of total commits.
 * EF=0 means no corporate contributors.
 */
export function computeElephantFactor(orgCommits: Map<string, number>, threshold = 0.5): number {
	if (orgCommits.size === 0) return 0;
	const total = Array.from(orgCommits.values()).reduce((s, v) => s + v, 0);
	if (total === 0) return 0;
	const target = total * threshold;
	const sorted = Array.from(orgCommits.values()).sort((a, b) => b - a);
	let sum = 0;
	for (let i = 0; i < sorted.length; i++) {
		sum += sorted[i]!;
		if (sum >= target) return i + 1;
	}
	return sorted.length;
}

function computeAffiliationScore(ef: number, corporatePct: number): number {
	const EF_BANDS: [number, number, number][] = [
		// [elephantFactor, baseMin, baseMax]
		[0, 0, 10],
		[1, 15, 25],
		[2, 30, 45],
		[3, 50, 65],
	];

	let baseMin: number;
	let baseMax: number;
	if (ef === 0) {
		[, baseMin, baseMax] = EF_BANDS[0]!;
	} else if (ef === 1) {
		[, baseMin, baseMax] = EF_BANDS[1]!;
	} else if (ef === 2) {
		[, baseMin, baseMax] = EF_BANDS[2]!;
	} else if (ef === 3) {
		[, baseMin, baseMax] = EF_BANDS[3]!;
	} else {
		baseMin = 70;
		baseMax = 85;
	}

	const depth = Math.min(corporatePct * 2, 1);
	return Math.round(baseMin + (baseMax - baseMin) * depth);
}

// --- Multi-signal affiliation resolution ---

function resolveOrganization(
	login: string,
	profile: UserProfileData | null,
	emails: string[],
	ossInsightOrg: string | null,
	orgMemberships: string[] | null,
	repoOwner: string | null,
	userName: string | null,
): string {
	// Signal 1 (highest): repo-owner org membership
	if (repoOwner && orgMemberships) {
		for (const org of orgMemberships) {
			if (org.toLowerCase() === repoOwner.toLowerCase()) {
				return CANONICAL_COMPANIES[org.toLowerCase()] ?? capitalizeWords(org);
			}
		}
	}

	// Signal 2: commit email corporate domain (with personal domain filtering)
	const hint = { login, name: userName };
	for (const email of emails) {
		const org = orgFromEmail(email, hint);
		if (org) return org;
	}

	// Signal 3: GitHub profile company field
	// If the company looks academic, check bio first for a stronger signal
	if (profile?.company && isAcademicAffiliation(profile.company)) {
		if (profile.bio) {
			const bioOrg = orgFromBio(profile.bio, repoOwner ?? undefined);
			if (bioOrg && bioOrg !== "Independent") return bioOrg;
		}
	}
	if (profile?.company) {
		const cleaned = normalizeCompanyName(profile.company);
		if (cleaned && cleaned !== "Independent" && !isLocation(cleaned)) return cleaned;
	}

	// Signal 4: known corporate org membership
	if (orgMemberships) {
		for (const org of orgMemberships) {
			const lower = org.toLowerCase();
			const canonical = CANONICAL_COMPANIES[lower];
			if (canonical) return canonical;
			const domainKey = `${lower}.com`;
			const domainMatch = WELL_KNOWN_DOMAINS[domainKey];
			if (domainMatch) return domainMatch;
		}
	}

	// Signal 5: GitHub profile email domain
	if (profile?.email) {
		const org = orgFromEmail(profile.email, hint);
		if (org) return org;
	}

	// Signal 6: OSS Insight org data (used as normalization source, not per-login lookup)
	if (ossInsightOrg) {
		const cleaned = normalizeCompanyName(ossInsightOrg);
		if (cleaned && cleaned !== "Independent" && !isNoiseOrg(ossInsightOrg) && !isLocation(cleaned))
			return cleaned;
	}

	// Signal 7 (lowest): bio parsing
	if (profile?.bio) {
		const org = orgFromBio(profile.bio, repoOwner ?? undefined);
		if (org) return org;
	}

	return "Independent";
}

function buildOssInsightLookup(
	orgs: { org_name: string; contributor_count: number; percentage: number }[] | null,
): Map<string, string> {
	const map = new Map<string, string>();
	if (!orgs) return map;
	for (const o of orgs) {
		if (!isNoiseOrg(o.org_name)) {
			map.set(o.org_name.toLowerCase(), o.org_name);
		}
	}
	return map;
}

// --- Company name normalization ---

const COMPANY_PREFIXES = /^[@#]/;
const COMPANY_SUFFIXES =
	/\s*(,?\s*(inc\.?|llc\.?|ltd\.?|gmbh|corp\.?|co\.?|s\.?a\.?|ag|plc))+\.?\s*$/i;

const JOB_TITLE_PREFIX =
	/^(?:(?:senior|junior|staff|principal|lead|head\s+of|director\s+of|vp\s+of|chief|co-?founder|founder|ceo|cto|coo|cfo)\s+)*(?:(?:software|mobile|frontend|backend|fullstack|full-stack|platform|infrastructure|devops|cloud|data|ml|ai|security|qa|test|site\s+reliability|mobility)\s+)*(?:engineer(?:s|ing)?|developer(?:s)?|architect(?:s)?|designer(?:s)?|product(?:\s+manager)?|manager|devrel|advocate|consultant|scientist|researcher|analyst|sre|intern|evangelist)\s*(?:at|@|,|-|–|—|\||·)?\s*/i;

export function normalizeCompanyName(raw: string): string {
	let name = raw.trim();
	name = name.replace(COMPANY_PREFIXES, "").trim();
	name = name.replace(COMPANY_SUFFIXES, "").trim();
	name = name.replace(JOB_TITLE_PREFIX, "").trim();
	name = name.replace(/^.*?\b(?:at|@)\s+/i, "").trim();
	name = name.replace(/\.(com|io|dev|org|net|co|app|ai|xyz|tech)$/i, "").trim();

	if (!name) return "Independent";
	if (isLocation(name)) return "Independent";

	const lower = name.toLowerCase();
	return CANONICAL_COMPANIES[lower] ?? capitalizeWords(name);
}

const CANONICAL_COMPANIES: Record<string, string> = {
	google: "Google",
	microsoft: "Microsoft",
	meta: "Meta",
	facebook: "Meta",
	fb: "Meta",
	amazon: "Amazon",
	aws: "Amazon",
	"amazon web services": "Amazon",
	apple: "Apple",
	netflix: "Netflix",
	ibm: "IBM",
	"red hat": "Red Hat",
	redhat: "Red Hat",
	github: "GitHub",
	vercel: "Vercel",
	cloudflare: "Cloudflare",
	stripe: "Stripe",
	shopify: "Shopify",
	twitter: "X",
	grafana: "Grafana",
	"grafana labs": "Grafana",
	posthog: "PostHog",
	datadog: "Datadog",
	hashicorp: "HashiCorp",
	elastic: "Elastic",
	confluent: "Confluent",
	mongodb: "MongoDB",
	supabase: "Supabase",
	planetscale: "PlanetScale",
	prisma: "Prisma",
	docker: "Docker",
	gitlab: "GitLab",
	atlassian: "Atlassian",
	jetbrains: "JetBrains",
	oracle: "Oracle",
	salesforce: "Salesforce",
	twilio: "Twilio",
	uber: "Uber",
	lyft: "Lyft",
	airbnb: "Airbnb",
	spotify: "Spotify",
	bytedance: "ByteDance",
	tencent: "Tencent",
	alibaba: "Alibaba",
	huawei: "Huawei",
	samsung: "Samsung",
	intel: "Intel",
	nvidia: "NVIDIA",
	amd: "AMD",
	cisco: "Cisco",
	vmware: "VMware",
	broadcom: "Broadcom",
	sap: "SAP",
	adobe: "Adobe",
	palantir: "Palantir",
	snowflake: "Snowflake",
	databricks: "Databricks",
	suse: "SUSE",
	canonical: "Canonical",
	cockroachdb: "Cockroach Labs",
	"cockroach labs": "Cockroach Labs",
	temporal: "Temporal",
	fly: "Fly.io",
	"fly.io": "Fly.io",
	railway: "Railway",
	render: "Render",
	netlify: "Netlify",
	fastly: "Fastly",
	akamai: "Akamai",
	linear: "Linear",
	notion: "Notion",
	figma: "Figma",
	slack: "Slack",
	discord: "Discord",
	zoom: "Zoom",
	snap: "Snap",
	pinterest: "Pinterest",
	reddit: "Reddit",
	linkedin: "LinkedIn",
	paypal: "PayPal",
	square: "Block",
	block: "Block",
	plaid: "Plaid",
	coinbase: "Coinbase",
	ripple: "Ripple",
};

// --- Email domain → company mapping ---

const WELL_KNOWN_DOMAINS: Record<string, string> = {
	"google.com": "Google",
	"chromium.org": "Google",
	"microsoft.com": "Microsoft",
	"outlook.com": "Microsoft",
	"meta.com": "Meta",
	"fb.com": "Meta",
	"amazon.com": "Amazon",
	"apple.com": "Apple",
	"netflix.com": "Netflix",
	"ibm.com": "IBM",
	"redhat.com": "Red Hat",
	"github.com": "GitHub",
	"gitlab.com": "GitLab",
	"atlassian.com": "Atlassian",
	"jetbrains.com": "JetBrains",
	"oracle.com": "Oracle",
	"salesforce.com": "Salesforce",
	"vmware.com": "VMware",
	"broadcom.com": "Broadcom",
	"cisco.com": "Cisco",
	"intel.com": "Intel",
	"nvidia.com": "NVIDIA",
	"amd.com": "AMD",
	"samsung.com": "Samsung",
	"huawei.com": "Huawei",
	"alibaba-inc.com": "Alibaba",
	"tencent.com": "Tencent",
	"bytedance.com": "ByteDance",
	"sap.com": "SAP",
	"adobe.com": "Adobe",
	"docker.com": "Docker",
	"hashicorp.com": "HashiCorp",
	"elastic.co": "Elastic",
	"grafana.com": "Grafana",
	"datadog.com": "Datadog",
	"cloudflare.com": "Cloudflare",
	"vercel.com": "Vercel",
	"netlify.com": "Netlify",
	"fastly.com": "Fastly",
	"akamai.com": "Akamai",
	"stripe.com": "Stripe",
	"shopify.com": "Shopify",
	"twilio.com": "Twilio",
	"palantir.com": "Palantir",
	"snowflake.com": "Snowflake",
	"databricks.com": "Databricks",
	"confluent.io": "Confluent",
	"mongodb.com": "MongoDB",
	"cockroachlabs.com": "Cockroach Labs",
	"planetscale.com": "PlanetScale",
	"supabase.io": "Supabase",
	"supabase.com": "Supabase",
	"suse.com": "SUSE",
	"canonical.com": "Canonical",
	"uber.com": "Uber",
	"lyft.com": "Lyft",
	"airbnb.com": "Airbnb",
	"spotify.com": "Spotify",
	"snap.com": "Snap",
	"pinterest.com": "Pinterest",
	"reddit.com": "Reddit",
	"linkedin.com": "LinkedIn",
	"paypal.com": "PayPal",
	"block.xyz": "Block",
	"squareup.com": "Block",
	"plaid.com": "Plaid",
	"coinbase.com": "Coinbase",
	"ripple.com": "Ripple",
	"figma.com": "Figma",
	"notion.so": "Notion",
	"linear.app": "Linear",
	"discord.com": "Discord",
	"zoom.us": "Zoom",
	"posthog.com": "PostHog",
	"temporal.io": "Temporal",
	"fly.io": "Fly.io",
	"railway.app": "Railway",
	"render.com": "Render",
};

const FREE_EMAIL_DOMAINS = new Set([
	"gmail.com",
	"googlemail.com",
	"hotmail.com",
	"outlook.com",
	"live.com",
	"yahoo.com",
	"yahoo.co.jp",
	"ymail.com",
	"aol.com",
	"icloud.com",
	"me.com",
	"mac.com",
	"protonmail.com",
	"proton.me",
	"pm.me",
	"tutanota.com",
	"mail.com",
	"zoho.com",
	"gmx.com",
	"gmx.de",
	"gmx.net",
	"fastmail.com",
	"hey.com",
	"yandex.ru",
	"yandex.com",
	"mail.ru",
	"qq.com",
	"163.com",
	"126.com",
	"foxmail.com",
	"sina.com",
	"naver.com",
	"hanmail.net",
	"daum.net",
]);

export function orgFromEmail(
	email: string,
	contributorHint?: { login: string; name: string | null },
): string | null {
	const domain = email.split("@")[1]?.toLowerCase();
	if (!domain) return null;
	if (FREE_EMAIL_DOMAINS.has(domain)) return null;
	if (domain.endsWith(".edu") || domain.endsWith(".ac.uk") || domain.endsWith(".edu.cn"))
		return null;

	if (WELL_KNOWN_DOMAINS[domain]) return WELL_KNOWN_DOMAINS[domain]!;

	// Generic corporate heuristic: non-free, non-edu domain → treat as company
	const parts = domain.split(".");
	if (parts.length >= 2) {
		const name = parts[0]!;
		if (name.length >= 3) {
			if (contributorHint && isPersonalDomain(name, contributorHint.login, contributorHint.name)) {
				return null;
			}
			return CANONICAL_COMPANIES[name] ?? capitalizeWords(name);
		}
	}
	return null;
}

function isPersonalDomain(domainBase: string, login: string, name: string | null): boolean {
	const base = domainBase.toLowerCase();
	const loginLower = login.toLowerCase();

	if (base === loginLower) return true;
	if (loginLower.includes(base) || base.includes(loginLower)) return true;

	if (name) {
		const nameParts = name.toLowerCase().split(/[\s-]+/);
		for (const part of nameParts) {
			if (part.length >= 3 && (base === part || base.includes(part) || part.includes(base))) {
				return true;
			}
		}
	}

	return false;
}

// --- Bio parsing ---

const BIO_PATTERNS = [
	/(?:founder|co-?founder|founding\s+\w+)\s+@(\w[\w-]*)/i,
	/(?:founder|co-?founder)\s+(?:of|at)\s+(\w[\w\s]*\w)/i,
	/(?:engineer|developer|designer|working|employed)\s+(?:at|@)\s+(\w[\w\s]*\w)/i,
	/(?:at|@)\s+(Google|Microsoft|Meta|Amazon|Apple|Netflix|IBM|Red Hat|GitHub|Vercel|Cloudflare|Stripe|Shopify|Grafana|PostHog|Datadog)/i,
];

const BIO_AT_ORG_PATTERN = /@(\w[\w-]+)/;

export function orgFromBio(bio: string, repoOwner?: string): string | null {
	for (const pattern of BIO_PATTERNS) {
		const match = bio.match(pattern);
		if (match?.[1]) {
			const name = match[1].replace(/^@/, "");
			return normalizeCompanyName(name);
		}
	}

	// Fallback: bare @org mention — only trust if it matches the repo owner or a known company
	const atMatch = bio.match(BIO_AT_ORG_PATTERN);
	if (atMatch?.[1]) {
		const orgLogin = atMatch[1];
		if (repoOwner && orgLogin.toLowerCase() === repoOwner.toLowerCase()) {
			return normalizeCompanyName(orgLogin);
		}
		const normalized = normalizeCompanyName(orgLogin);
		if (normalized !== "Independent" && CANONICAL_COMPANIES[orgLogin.toLowerCase()]) {
			return normalized;
		}
	}

	return null;
}

// --- Academic detection ---

const ACADEMIC_PATTERNS = /\b(university|universit[àáâãäå]|college|institute|school|academy|polytechnic|mit|caltech|eth\b|epfl\b)/i;

function isAcademicAffiliation(company: string): boolean {
	return ACADEMIC_PATTERNS.test(company) || /\.edu\b/i.test(company);
}

// --- Noise / location filters ---

const NOISE_ORGS = new Set([
	"student",
	"students",
	"university student",
	"freelance",
	"freelancer",
	"freelancing",
	"self-employed",
	"self",
	"home",
	"none",
	"n/a",
	"na",
	"-",
	"null",
	"independent",
	"independent consultant",
	"consultant",
	"software developer",
	"developer",
	"engineer",
	"programmer",
	"javascript",
	"typescript",
	"python",
	"golang",
	"rust",
	"open source",
	"open-source",
	"oss",
	"foss",
	"root",
	"admin",
	"personal",
	"private",
	"retired",
]);

function isNoiseOrg(name: string): boolean {
	const lower = name.toLowerCase().trim();
	if (NOISE_ORGS.has(lower)) return true;
	if (isLocation(lower)) return true;
	if (lower.length <= 2) return true;
	return false;
}

const KNOWN_LOCATIONS = new Set([
	"tokyo",
	"london",
	"berlin",
	"paris",
	"new york",
	"san francisco",
	"seattle",
	"boston",
	"austin",
	"chicago",
	"los angeles",
	"toronto",
	"vancouver",
	"sydney",
	"melbourne",
	"singapore",
	"beijing",
	"shanghai",
	"bangalore",
	"mumbai",
	"hyderabad",
	"delhi",
	"pune",
	"chennai",
	"amsterdam",
	"stockholm",
	"copenhagen",
	"oslo",
	"helsinki",
	"dublin",
	"zurich",
	"geneva",
	"vienna",
	"munich",
	"hamburg",
	"barcelona",
	"madrid",
	"lisbon",
	"milan",
	"rome",
	"prague",
	"warsaw",
	"budapest",
	"bucharest",
	"kiev",
	"moscow",
	"brazil",
	"argentina",
	"chile",
	"colombia",
	"mexico",
	"india",
	"china",
	"japan",
	"korea",
	"taiwan",
	"thailand",
	"germany",
	"france",
	"spain",
	"italy",
	"netherlands",
	"sweden",
	"norway",
	"finland",
	"denmark",
	"switzerland",
	"austria",
	"poland",
	"portugal",
	"ireland",
	"uk",
	"usa",
	"canada",
	"australia",
	"earth",
	"world",
	"remote",
	"worldwide",
	"global",
	"everywhere",
]);

function isLocation(name: string): boolean {
	return KNOWN_LOCATIONS.has(name.toLowerCase());
}

function capitalizeWords(s: string): string {
	if (/[^\x00-\x7F]/.test(s)) return s;
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Org share computation ---

function computeOrgSharesFromProfiles(contributors: AffiliationEntry[]): OrgShare[] {
	const totalCommits = contributors.reduce((s, c) => s + c.commits, 0);
	if (totalCommits === 0) {
		return [{ organization: "Independent", percentage: 1, contributorCount: 1 }];
	}

	const orgMap = new Map<string, { commits: number; count: number }>();
	for (const c of contributors) {
		const existing = orgMap.get(c.organization);
		if (existing) {
			existing.commits += c.commits;
			existing.count += 1;
		} else {
			orgMap.set(c.organization, { commits: c.commits, count: 1 });
		}
	}

	return Array.from(orgMap.entries()).map(([org, data]) => ({
		organization: org,
		percentage: data.commits / totalCommits,
		contributorCount: data.count,
	}));
}
