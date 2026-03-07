import { describe, expect, it } from "vitest";
import {
	computeAffiliation,
	computeElephantFactor,
	normalizeCompanyName,
	orgFromEmail,
} from "../../src/metrics/affiliation.js";
import type { AffiliationInput } from "../../src/metrics/types.js";

describe("normalizeCompanyName", () => {
	it('strips @ prefix and maps "google" to Google', () => {
		expect(normalizeCompanyName("@google")).toBe("Google");
	});

	it('strips LLC suffix and maps "Google LLC" to Google', () => {
		expect(normalizeCompanyName("Google LLC")).toBe("Google");
	});

	it("maps Facebook Inc. to Meta", () => {
		expect(normalizeCompanyName("Facebook Inc.")).toBe("Meta");
	});

	it("returns Independent for empty string", () => {
		expect(normalizeCompanyName("")).toBe("Independent");
		expect(normalizeCompanyName("   ")).toBe("Independent");
	});

	it("strips # prefix", () => {
		expect(normalizeCompanyName("#microsoft")).toBe("Microsoft");
	});

	it("strips job titles", () => {
		expect(normalizeCompanyName("head of product posthog")).toBe("PostHog");
		expect(normalizeCompanyName("senior engineer at grafana")).toBe("Grafana");
	});

	it("strips .com TLD", () => {
		expect(normalizeCompanyName("supervaize.com")).toBe("Supervaize");
	});

	it("filters locations", () => {
		expect(normalizeCompanyName("Tokyo")).toBe("Independent");
		expect(normalizeCompanyName("Berlin")).toBe("Independent");
	});
});

describe("orgFromEmail", () => {
	it("maps well-known domains to companies", () => {
		expect(orgFromEmail("alice@google.com")).toBe("Google");
		expect(orgFromEmail("bob@redhat.com")).toBe("Red Hat");
		expect(orgFromEmail("charlie@grafana.com")).toBe("Grafana");
	});

	it("returns null for free email providers", () => {
		expect(orgFromEmail("test@gmail.com")).toBeNull();
		expect(orgFromEmail("test@hotmail.com")).toBeNull();
		expect(orgFromEmail("test@protonmail.com")).toBeNull();
		expect(orgFromEmail("test@qq.com")).toBeNull();
	});

	it("returns null for .edu domains", () => {
		expect(orgFromEmail("student@mit.edu")).toBeNull();
		expect(orgFromEmail("student@ox.ac.uk")).toBeNull();
	});

	it("uses generic corporate heuristic for unknown domains", () => {
		expect(orgFromEmail("dev@supervaize.com")).toBe("Supervaize");
		expect(orgFromEmail("dev@mycorp.io")).toBe("Mycorp");
	});

	it("returns null for short domain names", () => {
		expect(orgFromEmail("test@ab.com")).toBeNull();
	});
});

describe("computeElephantFactor", () => {
	it("returns 0 for empty map", () => {
		expect(computeElephantFactor(new Map())).toBe(0);
	});

	it("returns 1 when one company has > 50%", () => {
		const orgs = new Map([
			["Google", 80],
			["Microsoft", 20],
		]);
		expect(computeElephantFactor(orgs)).toBe(1);
	});

	it("returns 2 when two companies needed for 50%", () => {
		const orgs = new Map([
			["Google", 30],
			["Microsoft", 25],
			["Amazon", 20],
			["Meta", 15],
			["Apple", 10],
		]);
		expect(computeElephantFactor(orgs)).toBe(2);
	});

	it("returns 3 for evenly distributed commits", () => {
		const orgs = new Map([
			["A", 20],
			["B", 20],
			["C", 20],
			["D", 20],
			["E", 20],
		]);
		expect(computeElephantFactor(orgs)).toBe(3);
	});
});

describe("computeAffiliation", () => {
	it("returns Independent-only for empty input", () => {
		const input: AffiliationInput = {
			userProfiles: [],
			ossInsightOrgs: null,
			contributorCommits: new Map(),
			commitEmails: new Map(),
		};
		const result = computeAffiliation(input);
		expect(result.orgShares).toHaveLength(1);
		expect(result.orgShares[0]?.organization).toBe("Independent");
		expect(result.elephantFactor).toBe(0);
		expect(result.corporatePercentage).toBe(0);
		expect(result.score).toBeLessThanOrEqual(10);
	});

	it("prioritizes commit email over profile company", () => {
		const input: AffiliationInput = {
			userProfiles: [{ login: "alice", company: "Acme Corp", email: null, bio: null }],
			ossInsightOrgs: null,
			contributorCommits: new Map([["alice", 100]]),
			commitEmails: new Map([["alice", ["alice@google.com"]]]),
		};
		const result = computeAffiliation(input);
		expect(result.topContributors[0]?.organization).toBe("Google");
	});

	it("falls back to profile company when no commit emails", () => {
		const input: AffiliationInput = {
			userProfiles: [{ login: "bob", company: "@microsoft", email: null, bio: null }],
			ossInsightOrgs: null,
			contributorCommits: new Map([["bob", 50]]),
			commitEmails: new Map(),
		};
		const result = computeAffiliation(input);
		expect(result.topContributors[0]?.organization).toBe("Microsoft");
	});

	it("computes elephant factor correctly", () => {
		const input: AffiliationInput = {
			userProfiles: [
				{ login: "a", company: "@google", email: null, bio: null },
				{ login: "b", company: "Microsoft", email: null, bio: null },
				{ login: "c", company: null, email: null, bio: null },
			],
			ossInsightOrgs: null,
			contributorCommits: new Map([
				["a", 60],
				["b", 30],
				["c", 10],
			]),
			commitEmails: new Map(),
		};
		const result = computeAffiliation(input);
		expect(result.elephantFactor).toBe(1);
		expect(result.corporatePercentage).toBe(0.9);
		expect(result.score).toBeGreaterThan(20);
	});

	it("scores higher for multi-org diversity", () => {
		const singleOrg: AffiliationInput = {
			userProfiles: [
				{ login: "a", company: "Google", email: null, bio: null },
				{ login: "b", company: "Google", email: null, bio: null },
			],
			ossInsightOrgs: null,
			contributorCommits: new Map([
				["a", 50],
				["b", 50],
			]),
			commitEmails: new Map(),
		};
		const multiOrg: AffiliationInput = {
			userProfiles: [
				{ login: "a", company: "Google", email: null, bio: null },
				{ login: "b", company: "Microsoft", email: null, bio: null },
				{ login: "c", company: "Meta", email: null, bio: null },
			],
			ossInsightOrgs: null,
			contributorCommits: new Map([
				["a", 40],
				["b", 30],
				["c", 30],
			]),
			commitEmails: new Map(),
		};
		const single = computeAffiliation(singleOrg);
		const multi = computeAffiliation(multiOrg);
		expect(multi.elephantFactor).toBeGreaterThan(single.elephantFactor);
		expect(multi.score).toBeGreaterThan(single.score);
	});
});
