type CheckInMessageInput = {
	appOrigin: string;
	blocked: string;
	founderName: string;
	help?: string | null;
	productName?: string | null;
	progress: string;
	streak: number;
};

/**
 * Builds the WhatsApp group announcement for a check-in. Pure on purpose: the
 * copy is what iterates, so it stays testable without mocking the network.
 * The product line and the help section are dropped when absent, since both
 * fields are optional on a check-in.
 */
export function formatCheckInMessage(input: CheckInMessageInput): string {
	const checkInUrl = `${input.appOrigin.replace(/\/$/, "")}/checkin`;
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
