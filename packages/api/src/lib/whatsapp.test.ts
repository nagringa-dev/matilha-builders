import { describe, expect, it } from "vitest";

import { formatCheckInMessage } from "./whatsapp";

const base = {
	appOrigin: "https://app.example.com",
	blocked: "Integração do Stripe",
	founderName: "Lucas Chitolina",
	progress: "Lancei a landing nova",
	streak: 2,
};

describe("formatCheckInMessage", () => {
	it("includes the founder, streak, progress and blocker", () => {
		const message = formatCheckInMessage(base);

		expect(message).toContain("*Lucas Chitolina*");
		expect(message).toContain("streak 2");
		expect(message).toContain("Lancei a landing nova");
		expect(message).toContain("Integração do Stripe");
	});

	it("appends the check-in link built from the app origin", () => {
		expect(formatCheckInMessage(base)).toContain(
			"https://app.example.com/checkin"
		);
	});

	it("does not double the slash when the origin has a trailing one", () => {
		const message = formatCheckInMessage({
			...base,
			appOrigin: "https://app.example.com/",
		});

		expect(message).toContain("https://app.example.com/checkin");
		expect(message).not.toContain("example.com//checkin");
	});

	it("shows the product when the check-in has one", () => {
		const message = formatCheckInMessage({
			...base,
			productName: "better-posture",
		});

		expect(message).toContain("📦 better-posture");
	});

	it("omits the product line when the check-in has no product", () => {
		expect(formatCheckInMessage(base)).not.toContain("📦");
	});

	it("shows the help section when help was asked for", () => {
		const message = formatCheckInMessage({
			...base,
			help: "Alguém já integrou Stripe na Vercel?",
		});

		expect(message).toContain("*Precisa de ajuda*");
		expect(message).toContain("Alguém já integrou Stripe na Vercel?");
	});

	it("omits the help section when help is empty or missing", () => {
		expect(formatCheckInMessage(base)).not.toContain("Precisa de ajuda");
		expect(formatCheckInMessage({ ...base, help: "   " })).not.toContain(
			"Precisa de ajuda"
		);
	});
});
