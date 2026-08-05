import { describe, expect, it } from "vitest";

import { getProductFaviconUrl } from "./product-favicon";

describe("getProductFaviconUrl", () => {
	it("derives the standard favicon from an HTTPS URL", () => {
		expect(getProductFaviconUrl("https://matilha.dev/products/check-in")).toBe(
			"https://matilha.dev/favicon.ico"
		);
	});

	it("preserves a non-default HTTP port", () => {
		expect(getProductFaviconUrl("http://localhost:3000/app")).toBe(
			"http://localhost:3000/favicon.ico"
		);
	});

	it("returns null for missing, malformed, and unsupported links", () => {
		expect(getProductFaviconUrl()).toBeNull();
		expect(getProductFaviconUrl("not a URL")).toBeNull();
		expect(getProductFaviconUrl("mailto:oi@matilha.dev")).toBeNull();
	});
});
