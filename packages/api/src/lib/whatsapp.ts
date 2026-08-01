import { env } from "@matilha-builders/env/server";

interface CheckInMessageInput {
	appOrigin: string;
	blocked: string;
	founderName: string;
	help?: string | null;
	productName?: string | null;
	progress: string;
	streak: number;
}

const TRAILING_SLASH_RE = /\/$/;

/**
 * Builds the WhatsApp group announcement for a check-in. Pure on purpose: the
 * copy is what iterates, so it stays testable without mocking the network.
 * The product line and the help section are dropped when absent, since both
 * fields are optional on a check-in.
 */
export function formatCheckInMessage(input: CheckInMessageInput): string {
	const checkInUrl = `${input.appOrigin.replace(TRAILING_SLASH_RE, "")}/checkin`;
	const blocks = [
		`🔥 *${input.founderName}* fez o check-in da semana — streak ${input.streak}`,
	];

	if (input.productName) {
		blocks.push(`📦 ${input.productName}`);
	}

	blocks.push(`✅ *Avançou*\n${input.progress}`);
	blocks.push(`🚧 *Travou*\n${input.blocked}`);

	if (input.help?.trim()) {
		blocks.push(`🙏 *Precisa de ajuda*\n${input.help.trim()}`);
	}

	blocks.push(`—\nJá fez o teu? 👉 ${checkInUrl}`);

	return blocks.join("\n\n");
}

const SEND_TIMEOUT_MS = 4000;

/**
 * Posts a check-in announcement to the community group. Never throws and never
 * rejects: a check-in is the product, the notification is a side effect, so no
 * WhatsApp failure may cost a founder their post or their streak.
 *
 * Silently does nothing unless all three WHATSAPP_* variables are configured —
 * there are no built-in defaults for the endpoint or the group.
 */
export async function notifyCheckIn(
	input: Omit<CheckInMessageInput, "appOrigin">
): Promise<void> {
	const apiUrl = env.WHATSAPP_API_URL;
	const groupId = env.WHATSAPP_GROUP_ID;
	const apiSecret = env.WHATSAPP_API_SECRET;
	if (!(apiUrl && groupId && apiSecret)) {
		return;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
	try {
		const response = await fetch(apiUrl, {
			body: JSON.stringify({
				message: formatCheckInMessage({
					...input,
					appOrigin: env.CORS_ORIGIN,
				}),
				to: groupId,
			}),
			headers: {
				"content-type": "application/json",
				"x-api-secret": apiSecret,
			},
			method: "POST",
			signal: controller.signal,
		});
		if (!response.ok) {
			console.error(`WhatsApp notification failed: HTTP ${response.status}`);
		}
	} catch (error) {
		console.error("WhatsApp notification failed", error);
	} finally {
		clearTimeout(timeout);
	}
}
