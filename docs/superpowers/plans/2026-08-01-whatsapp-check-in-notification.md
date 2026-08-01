# WhatsApp Check-in Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Announce each new check-in in the community's WhatsApp group, ending with a link back to the check-in form so the message nudges everyone else to post too.

**Architecture:** A new `packages/api/src/lib/whatsapp.ts` splits message formatting (pure, no I/O) from sending (POSTs, never throws). The `checkIns.create` handler awaits the send inside a try/catch after its database writes, so a WhatsApp failure can never cost someone their check-in or streak.

**Tech Stack:** TypeScript, oRPC, Drizzle ORM, Vitest, `@t3-oss/env-core`, Zod

## Global Constraints

- **No hardcoded values.** The endpoint, group id and secret are read from the environment with **no fallback defaults**. The literal endpoint URL and group id must never appear in any file under version control — including this plan.
- All three env vars are optional in the schema; if **any** is missing, skip the send silently.
- Sends happen in **every** environment — no `VERCEL_ENV` gate. This is deliberate.
- Only `checkIns.create` notifies. `checkIns.update` and dismissal send nothing.
- The check-in and streak must survive any WhatsApp failure. This is the feature's core invariant.
- Message copy is Brazilian Portuguese, matching the rest of the app's user-facing strings.
- Run all commands from `packages/api` unless stated otherwise.

## File Structure

| File | Responsibility |
|---|---|
| `packages/env/src/server.ts` | Declare the three `WHATSAPP_*` vars (modify) |
| `packages/api/src/lib/whatsapp.ts` | Format the message; POST it without ever throwing (create) |
| `packages/api/src/lib/whatsapp.test.ts` | Unit tests for the pure formatter (create) |
| `packages/api/src/routers/matilha.ts` | Call the notifier from `checkIns.create`; return the product name from `requireOwnedProduct` (modify) |
| `packages/api/src/routers/matilha.test.ts` | Prove create notifies, and that a failed send still succeeds (modify) |

---

### Task 1: Declare the WhatsApp environment variables

**Files:**
- Modify: `packages/env/src/server.ts:24-38`

**Interfaces:**
- Consumes: nothing
- Produces: `env.WHATSAPP_API_SECRET`, `env.WHATSAPP_API_URL`, `env.WHATSAPP_GROUP_ID`, each typed `string | undefined`

- [x] **Step 1: Add the three optional vars to the server schema**

In `packages/env/src/server.ts`, inside the `server: { ... }` object, add these three entries. Keep the existing keys alphabetically ordered — insert after `UPLOADTHING_TOKEN`:

```ts
		UPLOADTHING_TOKEN: z.string().min(1),
		WHATSAPP_API_SECRET: z.string().min(1).optional(),
		WHATSAPP_API_URL: z.url().optional(),
		WHATSAPP_GROUP_ID: z.string().min(1).optional(),
```

Do not add `.default(...)` to any of them. The values live in `apps/web/.env` only.

- [x] **Step 2: Verify the schema still loads**

Run from the repo root:

```bash
cd apps/web && pnpm check
```

Expected: `0 ERRORS`. If it reports a missing env var, the `.optional()` was omitted somewhere.

- [x] **Step 3: Commit**

```bash
git add packages/env/src/server.ts
git commit -m "feat(env): declare WhatsApp notification variables"
```

---

### Task 2: Format the check-in message

**Files:**
- Create: `packages/api/src/lib/whatsapp.ts`
- Test: `packages/api/src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  ```ts
  type CheckInMessageInput = {
      appOrigin: string;
      blocked: string;
      founderName: string;
      help?: string | null;
      productName?: string | null;
      progress: string;
      streak: number;
  };
  export function formatCheckInMessage(input: CheckInMessageInput): string;
  ```

- [x] **Step 1: Write the failing tests**

Create `packages/api/src/lib/whatsapp.test.ts`:

```ts
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
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
pnpm vitest run src/lib/whatsapp.test.ts
```

Expected: FAIL — `Failed to load .../whatsapp` (the module does not exist yet).

- [x] **Step 3: Write the formatter**

Create `packages/api/src/lib/whatsapp.ts`:

```ts
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
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run src/lib/whatsapp.test.ts
```

Expected: PASS, 7 tests.

- [x] **Step 5: Commit**

```bash
git add packages/api/src/lib/whatsapp.ts packages/api/src/lib/whatsapp.test.ts
git commit -m "feat(whatsapp): format the check-in group announcement"
```

---

### Task 3: Send the message without ever throwing

**Files:**
- Modify: `packages/api/src/lib/whatsapp.ts`

**Interfaces:**
- Consumes: `formatCheckInMessage` from Task 2
- Produces:
  ```ts
  export function notifyCheckIn(
      input: Omit<CheckInMessageInput, "appOrigin">
  ): Promise<void>;
  ```
  Never rejects. Reads `env.WHATSAPP_API_URL`, `env.WHATSAPP_GROUP_ID`,
  `env.WHATSAPP_API_SECRET` and `env.CORS_ORIGIN` internally, so callers pass
  no configuration.

- [x] **Step 1: Add the sender**

Append to `packages/api/src/lib/whatsapp.ts`. Add the import at the top of the file, above the type declaration:

```ts
import { env } from "@matilha-builders/env/server";
```

Then append:

```ts
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
			console.error(
				`WhatsApp notification failed: HTTP ${response.status}`
			);
		}
	} catch (error) {
		console.error("WhatsApp notification failed", error);
	} finally {
		clearTimeout(timeout);
	}
}
```

- [x] **Step 2: Verify types and lint**

```bash
cd ../../apps/web && pnpm check && cd ../../packages/api
pnpm exec ultracite check src/lib/whatsapp.ts
```

Expected: `0 ERRORS` from svelte-check. If ultracite objects to `console.error`, check whether the repo bans it elsewhere — `packages/api` has no logger, so `console.error` is the established option. If the rule fires, add a targeted `// biome-ignore lint/suspicious/noConsole: no logger in this package` above each call.

- [x] **Step 3: Run the existing tests to confirm nothing regressed**

```bash
pnpm test
```

Expected: PASS — 26 tests (19 existing + 7 from Task 2).

- [x] **Step 4: Commit**

```bash
git add packages/api/src/lib/whatsapp.ts
git commit -m "feat(whatsapp): post announcements without failing the caller"
```

---

### Task 4: Return the product name from the ownership check

**Files:**
- Modify: `packages/api/src/routers/matilha.ts:49-58`

**Interfaces:**
- Consumes: nothing
- Produces: `requireOwnedProduct(productId, founderId)` now resolves to `string` — the product's name — instead of `void`

- [x] **Step 1: Select and return the name**

Replace the body of `requireOwnedProduct` in `packages/api/src/routers/matilha.ts`:

```ts
async function requireOwnedProduct(productId: string, founderId: string) {
	const [row] = await db
		.select({ founderId: product.founderId, name: product.name })
		.from(product)
		.where(eq(product.id, productId))
		.limit(1);
	if (!row || row.founderId !== founderId) {
		throw new ORPCError("NOT_FOUND");
	}
	return row.name;
}
```

This avoids a second query for the name in Task 5. Existing callers ignore the return value, so nothing else changes.

- [x] **Step 2: Run the tests**

```bash
pnpm test
```

Expected: PASS — 26 tests. No behaviour changed; only the return type widened.

- [x] **Step 3: Commit**

```bash
git add packages/api/src/routers/matilha.ts
git commit -m "refactor(api): return the product name from requireOwnedProduct"
```

---

### Task 5: Notify the group when a check-in is created

**Files:**
- Modify: `packages/api/src/routers/matilha.ts:171-202`
- Test: `packages/api/src/routers/matilha.test.ts`

**Interfaces:**
- Consumes: `notifyCheckIn` from Task 3, `requireOwnedProduct` returning `string` from Task 4
- Produces: nothing new — `checkIns.create` still resolves to `{ streak: number }`

- [x] **Step 1: Teach the database mock about the product name**

Task 4 made `requireOwnedProduct` select `name` alongside `founderId`. The test's fake Drizzle surface still returns only `founderId`, so `row.name` would come back `undefined` and the mock would no longer match the real schema.

In `packages/api/src/routers/matilha.test.ts`, inside `vi.hoisted`, update the `founderId` branch of the `select` mock:

```ts
			if (keys.includes("founderId")) {
				rows = [{ founderId: "founder-1", name: "better-posture" }];
			} else if (keys.includes("createdAt")) {
```

- [x] **Step 2: Write the failing tests**

In the same file, add a mock for the WhatsApp module. Put this **immediately after** the existing `vi.mock("@matilha-builders/db", ...)` line:

```ts
const { notifyCheckIn } = vi.hoisted(() => ({
	notifyCheckIn: vi.fn(async () => undefined),
}));

vi.mock("../lib/whatsapp", () => ({ notifyCheckIn }));
```

Then add these two tests inside the existing `describe("checkIns.create", ...)` block:

```ts
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
```

The second test is the important one: it encodes the invariant that a WhatsApp outage never costs a founder their check-in.

- [x] **Step 3: Run the tests to verify they fail**

```bash
pnpm vitest run src/routers/matilha.test.ts
```

Expected: FAIL — the first with `expected "spy" to be called`, the second with `whatsapp is down` propagating out of the handler.

- [x] **Step 4: Wire the notification into the handler**

In `packages/api/src/routers/matilha.ts`, add the import alongside the other `../lib/` imports:

```ts
import { notifyCheckIn } from "../lib/whatsapp";
```

Then change the `checkIns.create` handler. Capture the product name from the ownership check, and notify after the database writes:

```ts
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				let productName: string | null = null;
				if (input.productId) {
					productName = await requireOwnedProduct(input.productId, founderId);
				}
				const [profile] = await db
					.select({
						lastCheckInAt: founder.lastCheckInAt,
						streak: founder.streak,
					})
					.from(founder)
					.where(eq(founder.userId, founderId))
					.limit(1);
				const now = new Date();
				const nextStreak = computeNextStreak(
					profile?.streak ?? 0,
					profile?.lastCheckInAt ?? null,
					now
				);
				await db.insert(checkIn).values({
					blocked: input.blocked,
					founderId,
					help: input.help,
					productId: input.productId,
					progress: input.progress,
				});
				await db
					.update(founder)
					.set({ lastCheckInAt: now, streak: nextStreak })
					.where(eq(founder.userId, founderId));

				// Awaited rather than fire-and-forget: on serverless a floating
				// promise dies when the response returns. The client mutation is
				// optimistic, so this latency never reaches the founder. The catch
				// is the safety net for a rejection notifyCheckIn didn't swallow.
				await notifyCheckIn({
					blocked: input.blocked,
					founderName: context.session.user.name,
					help: input.help,
					productName,
					progress: input.progress,
					streak: nextStreak,
				}).catch(() => undefined);

				return { streak: nextStreak };
			}),
```

- [x] **Step 5: Run the tests to verify they pass**

```bash
pnpm test
```

Expected: PASS — 28 tests.

- [x] **Step 6: Verify types**

```bash
cd ../../apps/web && pnpm check && cd ../../packages/api
```

Expected: `0 ERRORS`. If `context.session.user.name` errors, inspect the session type in `packages/api/src/context.ts` and use the field better-auth actually exposes.

- [x] **Step 7: Commit**

```bash
git add packages/api/src/routers/matilha.ts packages/api/src/routers/matilha.test.ts
git commit -m "feat(checkin): announce new check-ins in the WhatsApp group"
```

---

### Task 6: Confirm no secrets landed in version control

**Files:** none modified — this is a verification gate

**Interfaces:**
- Consumes: everything above
- Produces: nothing

- [x] **Step 1: Scan the repository for the literal values**

From the repo root. The patterns are read out of `apps/web/.env` at runtime, so the values being hunted for are never written into this plan either:

```bash
url=$(grep '^WHATSAPP_API_URL=' apps/web/.env | cut -d= -f2- | tr -d '"')
gid=$(grep '^WHATSAPP_GROUP_ID=' apps/web/.env | cut -d= -f2- | tr -d '"')
host=$(printf '%s' "$url" | sed -E 's#https?://([^/]+).*#\1#')
git grep -nF -e "$host" -e "$gid" -- . ':!*.env' \
  || echo "CLEAN: no literals tracked"
```

Expected: `CLEAN: no literals tracked`. Any hit is a Global Constraints violation — replace it with an env read before continuing.

- [x] **Step 2: Confirm the env file is still ignored**

```bash
git check-ignore -v apps/web/.env
git log --oneline --all -- apps/web/.env
```

Expected: the first prints the ignore rule; the second prints nothing.

- [x] **Step 3: Run the whole suite one last time**

```bash
cd packages/api && pnpm test
cd ../../apps/web && pnpm check && pnpm build
```

Expected: 28 tests pass, `0 ERRORS`, build succeeds.

---

## Deployment note

The three `WHATSAPP_*` variables must exist in Vercel or production silently skips every send and the feature simply doesn't happen. The repo already ships `scripts/sync-vercel-env.ts`:

```bash
pnpm env:production
```

Run it before deploying, then confirm in the Vercel dashboard that all three are present.

## Manual verification after deploy

The automated tests mock the network, so the real endpoint is never exercised. After deploying, post one real check-in and confirm the message lands in the group with the product line, the help section and a working link.

> [!WARNING]
> There is no environment gate. Testing a check-in from a preview deployment or local dev sends a real message to the community group.
