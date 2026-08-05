export interface NormalizedToolUrl {
	host: string;
	key: string;
	url: string;
}

// Hosts where the path carries the tool identity, not the domain. Without an entry here every repo on the host collapses into a single catalog row, and that merge is unrecoverable because only the first adopter ever submits a URL.
export const MULTI_TENANT_HOSTS: Record<string, number> = { "github.com": 2 };

const TRAILING_HYPHEN_PATTERN = /-+$/;

function registrableDomain(host: string): string {
	const labels = host.split(".");
	return labels.slice(-2).join(".");
}

export function isMultiTenantHost(host: string): boolean {
	return (
		host in MULTI_TENANT_HOSTS || registrableDomain(host) in MULTI_TENANT_HOSTS
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

	const segments = parsed.pathname
		.split("/")
		.filter((segment) => segment !== "");

	const multiTenantCount =
		MULTI_TENANT_HOSTS[host] ?? MULTI_TENANT_HOSTS[registrableDomain(host)];

	let key: string;
	if (multiTenantCount === undefined) {
		key = registrableDomain(host);
	} else {
		const tenantSegments = segments
			.slice(0, multiTenantCount)
			.map((segment) => segment.toLowerCase());
		key =
			tenantSegments.length > 0 ? `${host}/${tenantSegments.join("/")}` : host;
	}

	const url = `https://${key}`;

	return { host, key, url };
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

export function faviconUrl(host: string): string | null {
	if (isMultiTenantHost(host)) {
		return null;
	}
	return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}
