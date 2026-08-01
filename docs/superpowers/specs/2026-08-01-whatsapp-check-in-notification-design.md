# WhatsApp Check-in Notification — Design

**Date:** 2026-08-01
**Status:** Approved

## Goal

Announce every new check-in in the community's WhatsApp group, ending with a link back to the check-in form so the message doubles as a nudge for everyone else.

The board already rewards a weekly cadence, but nothing surfaces a check-in to people who aren't looking at the app. The group is where the community actually is, so a post there both celebrates the founder and creates the social pull to reciprocate.

## Message format

Approved shape (product and help lines are conditional — see below):

```
🔥 *Lucas Chitolina* fez o check-in da semana — streak 2

📦 better-posture

✅ *Avançou*
Lancei a landing nova e fechei 3 entrevistas

🚧 *Travou*
Integração do Stripe, webhook não dispara

🙏 *Precisa de ajuda*
Alguém já integrou Stripe com webhook na Vercel?

—
Já fez o teu? 👉 https://app.matilha.dev/checkin
```

The help section is deliberately included: it's the part the group can actually act on, which turns the announcement into a conversation rather than a broadcast.

Conditional parts:

| Condition | Behaviour |
|---|---|
| `productId` is null | Omit the `📦` line entirely |
| `help` is empty or null | Omit the whole `🙏` section |
| Always | Trailing link line, built from the app origin |

## Architecture

New module `packages/api/src/lib/whatsapp.ts` with two functions split by responsibility:

**`formatCheckInMessage(input): string`** — pure, no I/O. Takes founder name, product name, streak, progress, blocked, help and the app **origin** (the function appends `/checkin` itself, so callers never build the path); returns the message body. Unit-testable without touching the network. Message copy is where product iteration will happen, so it deserves tests that don't need a `fetch` mock.

**`notifyCheckIn(input): Promise<void>`** — performs the POST. **Never throws.** Any failure (unreachable host, non-2xx, timeout, missing config) is logged and swallowed.

The split keeps the part that changes often (copy) independent from the part that talks to the network.

### Request

```
POST $WHATSAPP_API_URL
Content-Type: application/json
x-api-secret: $WHATSAPP_API_SECRET

{ "to": "$WHATSAPP_GROUP_ID", "message": "<formatted body>" }
```

## Integration point

At the end of the `checkIns.create` handler (`packages/api/src/routers/matilha.ts`), after the check-in insert and the founder streak update, before the return.

**The send is awaited inside a try/catch, not left floating.** On serverless a detached promise is killed once the response returns, so a true fire-and-forget would drop messages non-deterministically. The added latency is invisible to the user: the client mutation is optimistic (`postCheckIn.onMutate`), so the success screen renders before the request resolves.

A 4s timeout via `AbortController` bounds the wait, matching the existing convention in `fetchOgImage`.

`requireOwnedProduct` currently returns `void` after validating ownership. It will return the product name instead, so the handler gets the name without a second query. The founder's name comes from `context.session.user.name` — no query at all.

## Configuration

Three variables added to the server schema in `packages/env/src/server.ts`, all optional strings:

| Variable | Holds |
|---|---|
| `WHATSAPP_API_SECRET` | Credential for the `x-api-secret` header |
| `WHATSAPP_API_URL` | Endpoint the message is POSTed to |
| `WHATSAPP_GROUP_ID` | Destination group |

**No values are hardcoded — not the endpoint, not the group id.** The code reads all three from the environment and carries no fallback. Baking the endpoint or the group id into a default would put them in the repository, which is exactly what env vars exist to avoid. All three are already set in `apps/web/.env`.

They are declared optional so that a checkout without them still boots. When **any** of the three is missing the send is skipped silently and the check-in proceeds normally. This is missing-configuration handling, not environment gating.

The link is `CORS_ORIGIN` + `/checkin`. `CORS_ORIGIN` is already validated as a URL in the schema and resolves to the Vercel origin in deployed environments.

### Environment behaviour

Messages are sent from **every** environment, including preview deployments and local development. This was an explicit product decision.

> [!WARNING]
> A check-in posted from a preview deploy or a local dev server reaches the real community group. There is no environment gate. If test check-ins become a nuisance, the cheapest fix is pointing `WHATSAPP_GROUP_ID` at a scratch group for non-production environments.

## Behaviour on edit and dismissal

Only the original `checkIns.create` sends a message.

- **Edits** (`checkIns.update`) send nothing. Edits fix typos; re-announcing would show the group the same check-in repeatedly.
- **Dismissals** send nothing. The group already saw the original post; a retraction is noise.

## Error handling

| Failure | Result |
|---|---|
| Endpoint unreachable / DNS failure | Check-in saved, error logged |
| Non-2xx response | Check-in saved, status logged |
| Timeout (>4s) | Request aborted, check-in saved |
| Any of the three env vars unset | Send skipped, no error |

The invariant in every row: **the check-in and the streak are never lost because WhatsApp failed.** The founder's record is the product; the notification is a side effect.

## Testing

**`formatCheckInMessage`** (`packages/api/src/lib/whatsapp.test.ts`):
- full message with product and help
- product omitted when `productId` is null
- help section omitted when `help` is empty
- link built from the given app origin

**Router** (`packages/api/src/routers/matilha.test.ts`):
- `create` calls the sender with the expected payload
- **a rejected send still resolves the mutation with the correct streak** — the invariant above

## Out of scope

- Retry or queueing for failed sends
- Per-founder opt-out
- Rich formatting beyond WhatsApp's `*bold*`
- Notifying anywhere other than the single configured group
