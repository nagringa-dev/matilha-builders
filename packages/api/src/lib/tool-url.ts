export interface NormalizedToolUrl {
	host: string;
	key: string;
	url: string;
}

// Hosts where the path carries the tool identity, not the domain. Without an entry here every repo on the host collapses into a single catalog row, and that merge is unrecoverable because only the first adopter ever submits a URL.
export const MULTI_TENANT_HOSTS: Record<string, number> = { "github.com": 2 };

// Two-label suffixes that are not registrable domains. Missing an entry merges
// every tenant on it into one catalog row, which is unrecoverable.
const MULTI_LABEL_SUFFIXES = new Set([
	"com.br",
	"co.uk",
	"github.io",
	"netlify.app",
	"pages.dev",
	"vercel.app",
]);

const TRAILING_HYPHEN_PATTERN = /-+$/;

function registrableDomain(host: string): string {
	const labels = host.split(".");
	const depth = MULTI_LABEL_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
	return labels.slice(-depth).join(".");
}

function multiTenantSegments(host: string): number | undefined {
	return (
		MULTI_TENANT_HOSTS[host] ?? MULTI_TENANT_HOSTS[registrableDomain(host)]
	);
}

export function normalizeToolUrl(input: string): NormalizedToolUrl | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

	let parsed: URL;
	try {
		parsed = new URL(withProtocol);
	} catch {
		return null;
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return null;
	}

	const hostname = parsed.hostname.toLowerCase();
	const host = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
	if (!host.includes(".")) {
		return null;
	}

	const tenantCount = multiTenantSegments(host);

	let key: string;
	if (tenantCount === undefined) {
		key = registrableDomain(host);
	} else {
		const tenantSegments = parsed.pathname
			.split("/")
			.filter((segment) => segment !== "")
			.slice(0, tenantCount)
			.map((segment) => segment.toLowerCase());
		key =
			tenantSegments.length > 0 ? `${host}/${tenantSegments.join("/")}` : host;
	}

	return { host, key, url: `https://${key}` };
}

export function slugify(name: string): string {
	const withoutDiacritics = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
	const slug = withoutDiacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const capped = slug.slice(0, 60).replace(TRAILING_HYPHEN_PATTERN, "");
	return capped || "tool";
}

// Built from the key, which is already unique, so the slug inherits that and
// never needs a collision retry. The name is only a readable prefix.
export function toolSlug(name: string, key: string): string {
	const namePart = slugify(name)
		.slice(0, 30)
		.replace(TRAILING_HYPHEN_PATTERN, "");
	const keyPart = slugify(key);
	return namePart === keyPart ? keyPart : `${namePart}-${keyPart}`;
}

export function faviconUrl(key: string): string | null {
	// A key with a path is multi-tenant; the domain icon would be wrong for it.
	if (key.includes("/")) {
		return null;
	}
	return `https://icons.duckduckgo.com/ip3/${key}.ico`;
}
