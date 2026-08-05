import { describe, expect, it } from "vitest";
import { faviconUrl, normalizeToolUrl, slugify } from "./tool-url";

describe("normalizeToolUrl", () => {
	it("normalizes a URL with query string and www prefix", () => {
		expect(normalizeToolUrl("https://www.screen.studio/pricing?ref=x")).toEqual(
			{
				host: "screen.studio",
				key: "screen.studio",
				url: "https://screen.studio",
			}
		);
	});

	it("collapses a subdomain to its registrable domain", () => {
		expect(normalizeToolUrl("https://docs.stripe.com/api")).toEqual({
			host: "docs.stripe.com",
			key: "stripe.com",
			url: "https://stripe.com",
		});
	});

	it("prepends https when no protocol is given", () => {
		expect(normalizeToolUrl("screen.studio")).toEqual({
			host: "screen.studio",
			key: "screen.studio",
			url: "https://screen.studio",
		});
	});

	it("lowercases the host and path", () => {
		expect(normalizeToolUrl("SCREEN.STUDIO/Pricing")).toEqual({
			host: "screen.studio",
			key: "screen.studio",
			url: "https://screen.studio",
		});
	});

	it("keeps the first two path segments for a multi-tenant host", () => {
		expect(normalizeToolUrl("github.com/anthropics/mcp/tree/main/src")).toEqual(
			{
				host: "github.com",
				key: "github.com/anthropics/mcp",
				url: "https://github.com/anthropics/mcp",
			}
		);
	});

	it("strips www before checking the multi-tenant host map", () => {
		expect(normalizeToolUrl("https://www.github.com/foo/bar")).toEqual({
			host: "github.com",
			key: "github.com/foo/bar",
			url: "https://github.com/foo/bar",
		});
	});

	it("uses whatever segments exist when fewer than the tenant count", () => {
		expect(normalizeToolUrl("github.com/onlyoneseg")).toEqual({
			host: "github.com",
			key: "github.com/onlyoneseg",
			url: "https://github.com/onlyoneseg",
		});
	});

	it("falls back to the bare host when no segments exist", () => {
		expect(normalizeToolUrl("github.com")).toEqual({
			host: "github.com",
			key: "github.com",
			url: "https://github.com",
		});
	});

	it("drops the port", () => {
		expect(normalizeToolUrl("stripe.com:8443/x")).toEqual({
			host: "stripe.com",
			key: "stripe.com",
			url: "https://stripe.com",
		});
	});

	it("returns null for an empty string", () => {
		expect(normalizeToolUrl("")).toBeNull();
	});

	it("returns null for whitespace only", () => {
		expect(normalizeToolUrl("   ")).toBeNull();
	});

	it("returns null for text that is not a url", () => {
		expect(normalizeToolUrl("not a url")).toBeNull();
	});

	it("returns null for a non-http protocol", () => {
		expect(normalizeToolUrl("ftp://foo.com")).toBeNull();
	});

	it("returns null for a host with no dot", () => {
		expect(normalizeToolUrl("localhost")).toBeNull();
	});

	it("produces the same key for two different URLs of the same tool", () => {
		const first = normalizeToolUrl("https://www.screen.studio/pricing");
		const second = normalizeToolUrl("screen.studio/download");

		expect(first?.key).toBe(second?.key);
	});
});

describe("slugify", () => {
	it("lowercases and hyphenates spaces", () => {
		expect(slugify("Screen Studio")).toBe("screen-studio");
	});

	it("strips diacritics", () => {
		expect(slugify("Automação Pro")).toBe("automacao-pro");
	});

	it("falls back to tool when nothing alphanumeric remains", () => {
		expect(slugify("  !!!  ")).toBe("tool");
	});

	it("caps at 60 characters without a trailing hyphen", () => {
		const longName = "a".repeat(70);

		const result = slugify(longName);

		expect(result.length).toBe(60);
		expect(result.endsWith("-")).toBe(false);
	});
});

describe("faviconUrl", () => {
	it("returns null for a multi-tenant host", () => {
		expect(faviconUrl("github.com")).toBeNull();
	});

	it("returns a duckduckgo icon url for a regular host", () => {
		expect(faviconUrl("stripe.com")).toBe(
			"https://icons.duckduckgo.com/ip3/stripe.com.ico"
		);
	});
});
