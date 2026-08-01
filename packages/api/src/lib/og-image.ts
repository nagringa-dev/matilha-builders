import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const FETCH_TIMEOUT_MS = 4000;
const MAX_BYTES = 300_000;

const OG_IMAGE_RE =
	/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_RE_REVERSED =
	/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i;
const TWITTER_IMAGE_RE =
	/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i;
const TWITTER_IMAGE_RE_REVERSED =
	/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i;

function isPrivateIp(ip: string): boolean {
	if (ip.includes(":")) {
		const lower = ip.toLowerCase();
		return (
			lower === "::1" ||
			lower.startsWith("fe80:") ||
			lower.startsWith("fc") ||
			lower.startsWith("fd") ||
			lower.startsWith("::ffff:127.") ||
			lower.startsWith("::ffff:10.") ||
			lower.startsWith("::ffff:169.254.") ||
			lower.startsWith("::ffff:192.168.")
		);
	}
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
		return true;
	}
	const [a, b] = parts as [number, number, number, number];
	return (
		a === 127 ||
		a === 10 ||
		a === 0 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168)
	);
}

async function assertPublicHost(hostname: string): Promise<void> {
	if (hostname === "localhost") {
		throw new Error("Blocked host");
	}
	if (isIP(hostname)) {
		if (isPrivateIp(hostname)) {
			throw new Error("Blocked host");
		}
		return;
	}
	const { address } = await lookup(hostname);
	if (isPrivateIp(address)) {
		throw new Error("Blocked host");
	}
}

/**
 * Best-effort og:image scrape for a product link. Never throws — any
 * failure (unreachable host, no meta tag, blocked/private target) just
 * resolves to null so callers can treat it as "no image found".
 *
 * Guards against SSRF (blocks loopback/private/link-local targets, no
 * redirect following) and against slow/huge responses (timeout + byte cap).
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
	try {
		const parsed = new URL(pageUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		await assertPublicHost(parsed.hostname);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		let response: Response;
		try {
			response = await fetch(parsed, {
				headers: { "user-agent": "Mozilla/5.0 (compatible; MatilhaBot/1.0)" },
				redirect: "manual",
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeout);
		}

		if (!(response.ok && response.body)) {
			return null;
		}
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) {
			return null;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let html = "";
		let bytesRead = 0;
		while (bytesRead < MAX_BYTES) {
			// biome-ignore lint/performance/noAwaitInLoops: each read() depends on the stream cursor from the previous one; the reads are inherently sequential.
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			bytesRead += value.byteLength;
			html += decoder.decode(value, { stream: true });
			if (OG_IMAGE_RE.test(html) || OG_IMAGE_RE_REVERSED.test(html)) {
				break;
			}
		}
		await reader.cancel().catch(() => undefined);

		const match =
			OG_IMAGE_RE.exec(html) ??
			OG_IMAGE_RE_REVERSED.exec(html) ??
			TWITTER_IMAGE_RE.exec(html) ??
			TWITTER_IMAGE_RE_REVERSED.exec(html);
		const rawImageUrl = match?.[1];
		if (!rawImageUrl) {
			return null;
		}

		const imageUrl = new URL(rawImageUrl, parsed);
		if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
			return null;
		}
		return imageUrl.toString();
	} catch {
		return null;
	}
}
