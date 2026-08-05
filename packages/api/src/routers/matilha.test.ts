import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, insertValues, selectResults, updateSet, updateWhere } =
	vi.hoisted(() => {
		interface SelectChain {
			from: () => SelectChain;
			limit: () => Promise<unknown[]>;
			orderBy: () => SelectChain;
			where: () => SelectChain;
		}

		const insertValuesMock = vi.fn(async () => undefined);
		const selectResultsMock: unknown[][] = [];
		const updateWhereMock = vi.fn(async () => undefined);
		const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
		const databaseMock = {
			insert: vi.fn(() => ({ values: insertValuesMock })),
			select: vi.fn((fields: Record<string, unknown>) => {
				const keys = Object.keys(fields);
				let rows: unknown[];
				if (selectResultsMock.length > 0) {
					rows = selectResultsMock.shift() ?? [];
				} else if (keys.includes("founderId")) {
					rows = [{ founderId: "founder-1", name: "better-posture" }];
				} else if (keys.includes("createdAt")) {
					rows = [{ createdAt: new Date("2026-07-21T12:00:00Z") }];
				} else {
					rows = [
						{
							lastCheckInAt: new Date("2026-07-21T12:00:00Z"),
							streak: 4,
						},
					];
				}
				const chain = {} as SelectChain;
				chain.from = () => chain;
				chain.limit = async () => rows;
				chain.orderBy = () => chain;
				chain.where = () => chain;
				return chain;
			}),
			update: vi.fn(() => ({
				set: updateSetMock,
			})),
		};
		return {
			dbMock: databaseMock,
			insertValues: insertValuesMock,
			selectResults: selectResultsMock,
			updateSet: updateSetMock,
			updateWhere: updateWhereMock,
		};
	});

vi.mock("@matilha-builders/db", () => ({ db: dbMock }));

const { notifyCheckIn } = vi.hoisted(() => ({
	notifyCheckIn: vi.fn(async () => undefined),
}));

vi.mock("../lib/whatsapp", () => ({ notifyCheckIn }));

import { matilhaRouter } from "./matilha";

// The mocked founder last checked in on 2026-07-21, in the calendar week
// starting Monday 2026-07-20 (São Paulo time), with a stored streak of 4.
const client = createRouterClient(matilhaRouter, {
	context: {
		session: { user: { id: "founder-1", name: "Lucas Chitolina" } },
	} as never,
});

describe("checkIns.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResults.length = 0;
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("records another check-in during the same week without scoring again", async () => {
		vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));

		await expect(
			client.checkIns.create({
				blocked: "Nothing",
				productId: "product-1",
				progress: "Shipped another iteration",
			})
		).resolves.toEqual({ streak: 4 });
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				founderId: "founder-1",
				productId: "product-1",
			})
		);
		expect(updateWhere).toHaveBeenCalledOnce();
	});

	it("scores a point on the first check-in of the following week", async () => {
		vi.setSystemTime(new Date("2026-07-29T12:00:00Z"));

		await expect(
			client.checkIns.create({
				blocked: "Nothing",
				productId: "product-1",
				progress: "Shipped another iteration",
			})
		).resolves.toEqual({ streak: 5 });
	});

	it("announces the check-in in the group", async () => {
		vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));

		await client.checkIns.create({
			blocked: "Nothing",
			help: "Preciso de ajuda com deploy",
			productId: "product-1",
			progress: "Shipped another iteration",
		});

		expect(notifyCheckIn).toHaveBeenCalledWith(
			expect.objectContaining({
				blocked: "Nothing",
				founderName: "Lucas Chitolina",
				help: "Preciso de ajuda com deploy",
				productName: "better-posture",
				progress: "Shipped another iteration",
				streak: 4,
			})
		);
	});

	it("still saves the check-in when the group notification fails", async () => {
		vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
		notifyCheckIn.mockRejectedValueOnce(new Error("whatsapp is down"));

		await expect(
			client.checkIns.create({
				blocked: "Nothing",
				productId: "product-1",
				progress: "Shipped another iteration",
			})
		).resolves.toEqual({ streak: 4 });
		expect(updateWhere).toHaveBeenCalledOnce();
	});
});

describe("checkIns.update", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResults.length = 0;
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("changes the check-in to another product owned by the founder", async () => {
		selectResults.push(
			[
				{
					createdAt: new Date("2026-07-21T12:00:00Z"),
					dismissedAt: null,
					founderId: "founder-1",
				},
			],
			[{ founderId: "founder-1", name: "new-product" }]
		);

		await client.checkIns.update({
			blocked: "Nothing",
			help: "Feedback",
			id: "check-in-1",
			productId: "product-2",
			progress: "Shipped an iteration",
		});

		expect(updateSet).toHaveBeenCalledWith({
			blocked: "Nothing",
			help: "Feedback",
			productId: "product-2",
			progress: "Shipped an iteration",
		});
		expect(updateWhere).toHaveBeenCalledOnce();
	});

	it("rejects a product owned by another founder", async () => {
		selectResults.push(
			[
				{
					createdAt: new Date("2026-07-21T12:00:00Z"),
					dismissedAt: null,
					founderId: "founder-1",
				},
			],
			[{ founderId: "founder-2", name: "foreign-product" }]
		);

		await expect(
			client.checkIns.update({
				blocked: "Nothing",
				id: "check-in-1",
				productId: "product-2",
				progress: "Shipped an iteration",
			})
		).rejects.toThrow();
		expect(updateSet).not.toHaveBeenCalled();
	});

	it("rejects a product that does not exist", async () => {
		selectResults.push(
			[
				{
					createdAt: new Date("2026-07-21T12:00:00Z"),
					dismissedAt: null,
					founderId: "founder-1",
				},
			],
			[]
		);

		await expect(
			client.checkIns.update({
				blocked: "Nothing",
				id: "check-in-1",
				productId: "missing-product",
				progress: "Shipped an iteration",
			})
		).rejects.toThrow();
		expect(updateSet).not.toHaveBeenCalled();
	});
});
