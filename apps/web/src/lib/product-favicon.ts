export function getProductFaviconUrl(link?: string | null) {
	if (!link) {
		return null;
	}

	try {
		const url = new URL(link);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return null;
		}
		return `${url.origin}/favicon.ico`;
	} catch {
		return null;
	}
}
