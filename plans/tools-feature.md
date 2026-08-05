# Tools Feature — Spec

Source design: `Tools Feature.dc.html` (Claude Design project `044b0919-00c7-4899-8153-e8e0632bfe8a`).

Four surfaces:

| id | surface | route |
|----|---------|-------|
| 1a | Tool detail — who uses it + "Eu uso também" | `/tools/[slug]` |
| 1b | Discovery — ranked by adoption, category filter | `/tools` |
| 1c | "Adicionar ferramenta" drawer | component |
| 2a | Profile "Ferramentas" tab | `/profile/[id]?tab=ferramentas` |

## Decisions

### Identity

A tool is identified by its **normalized URL**. The link is **required**.

Rationale: tools are "everything" — companies, services, APIs, MCP servers, agent skill packs, CLIs. Names collide and drift; canonical URLs don't. Making the link required trades a 3-second tax at creation for permanent identity hygiene, and removes the need for a merge system, an admin approval queue, and a request-to-add flow.

Normalization:

```
lowercase → strip protocol, "www.", trailing slash, query string, fragment, port
           → collapse subdomains to the registrable domain
           → keep N leading path segments if host is in MULTI_TENANT_HOSTS, else 0
```

```ts
const MULTI_TENANT_HOSTS: Record<string, number> = { "github.com": 2 };

const keep = MULTI_TENANT_HOSTS[host] ?? 0;
const key = keep ? `${host}/${segments.slice(0, keep).join("/")}` : host;
```

| input | key |
|-------|-----|
| `https://www.screen.studio/pricing?ref=x` | `screen.studio` |
| `https://docs.stripe.com/api` | `stripe.com` |
| `github.com/anthropics/mcp/tree/main/src` | `github.com/anthropics/mcp` |

Accepted consequences:

- `docs.stripe.com` and `stripe.com` are the same tool. Correct — docs aren't a separate product.
- Stripe Payments and Stripe Connect are one row. Sub-product granularity is a rabbit hole; the per-adopter note carries the nuance.
- `vercel.com` and `nextjs.org` stay separate. Correct — different tools.

`MULTI_TENANT_HOSTS` exists because a multi-tenant collapse is **unrecoverable**, not merely inconvenient: only the *first* adopter submits a URL. Everyone after clicks "Eu uso também" on an existing row. If twenty repos collapse into one "GitHub" row, there is no stored signal recording which repo each adopter meant. Extend the list by PR when a collapse is noticed; edits only affect normalization of new input, so they never orphan existing rows.

### No moderation layer

- **No admin approval.** Creation is open to any approved member.
- **No merge system.** Structurally near-impossible to create a duplicate; the unique constraint on the normalized key is the enforcement.
- **No request-to-add queue.** A request queue only makes sense when creation is gated. It isn't.
- **No admin UI** in this scope.

### Wiki-style editing

Any authenticated builder **who has adopted the tool** can edit its `name`, `category`, and `description`.

- Small, non-anonymous, trusted community — vandalism risk is near zero; a bad name shipping forever is a certainty.
- Gating on adopters is a light guard: you must use it to describe it.
- **The canonical URL is immutable.** It is the identity key. Wrong URL = wrong tool; the fix is to adopt the correct one and drop the bad row.
- No revision history, no diff UI. A plain edit form on 1a.

Creator-owns was rejected: it reintroduces the ownership/permission model this design avoids, and dies the moment that person leaves the community.

### Categories

A TypeScript const in the repo, **not** a DB table. `tool.category` is `text` holding a slug, validated by a zod enum derived from the const.

```ts
// packages/db/src/tool-categories.ts
// SLUGS ARE APPEND-ONLY. Deleting or renaming a slug orphans every tool
// holding it. Renaming a `label` is free. Retire via `deprecated: true`.
export const TOOL_CATEGORIES = [
  { slug: "payments",      label: "Pagamentos" },
  { slug: "deploy",        label: "Deploy" },
  { slug: "design",        label: "Design" },
  { slug: "screen-recording", label: "Gravação de tela" },
  { slug: "email",         label: "Email" },
  { slug: "backend",       label: "Backend" },
  { slug: "database",      label: "Banco de dados" },
  { slug: "auth",          label: "Auth" },
  { slug: "analytics",     label: "Analytics" },
  { slug: "ai-agents",     label: "IA / Agentes" },
  { slug: "mcp",           label: "MCP" },
  { slug: "automation",    label: "Automação" },
  { slug: "marketing",     label: "Marketing" },
  { slug: "support",       label: "Suporte" },
  { slug: "productivity",  label: "Produtividade" },
  { slug: "no-code",       label: "No-code" },
  { slug: "other",         label: "Outros" },
] as const;
```

The repo is open source, so **the PR is the approval queue** — the one place a review gate genuinely belongs. A contributor adds one line; taxonomy quality is reviewed in the diff. No admin CRUD screen, no seed migration, no database access required to contribute.

- **Single** category per tool. Multi-category makes 1b's filter ambiguous (appears under both? double-counted in ranking?) and the row subtitle has room for one label.
- **No free text.** Free entry produces a 200-chip filter row within a month.
- `Outros` is the pressure valve covering the lag between "needs a category" and "PR merged".
- Picker and 1b filter chips both render from this const — cannot drift.

`MULTI_TENANT_HOSTS` follows the same const-in-repo, contribute-by-PR pattern.

### Logo

`tool.logoUrl`, same treatment as `product.imageUrl`:

- New `toolLogoUploader` uploadthing endpoint, reusing `image-upload-button.svelte`. Permission follows the wiki rule (has adopted the tool) rather than `productImageUploader`'s ownership check.
- **Seeded at creation** with `https://icons.duckduckgo.com/ip3/{host}.ico`. One line, zero new infra. Manual upload overwrites it. Upgradeable later to fetch-and-persist-to-uploadthing without a schema change — same column, different value.
- **Skip the favicon seed for multi-tenant hosts** — every GitHub tool would otherwise render an identical GitHub mark.
- `logoUrl` null → letter tile on `--accent`, as drawn in the design.

### Favicon rendering (shared rule)

Tool logos and product tag-chips follow **one identical rule**: favicon from the URL's host, letter tile on failure. One `tool-logo.svelte` component serves both.

```
url present + host not multi-tenant → https://icons.duckduckgo.com/ip3/{host}.ico
  ↳ onerror / no url / multi-tenant host → letter tile
```

Verified against the live service: real hosts return `200`, unknown hosts and unindexed `*.vercel.app` subdomains return **`404`** — so `onerror` fires reliably and no generic-placeholder problem exists. A `GENERIC_PLATFORM_HOSTS` skip-list was considered and rejected as unnecessary for this reason.

**Product tag-chips (builder feedback):** `product-chip.svelte` `variant="tag"` currently renders `product.imageUrl` at `size-6` with `object-cover`. That column holds an **og:image** — a wide banner — so it crops to an illegible center slice. Replace the source with the favicon derived from `product.link`, falling back to the existing letter tile.

- Scope is `variant="tag"` **only**. `cover` and `tile` render large, where the og:image is the correct asset.
- No schema change — derived at render from `product.link`. `imageUrl` is untouched for the big surfaces.
- Chosen over the alternative feedback of dropping the thumbnail entirely: name-only chips lose the visual anchor and three in a row become indistinguishable pills.

### Slug

Separate `slug` column, generated from the name at creation, unique, **frozen thereafter**. Wiki renames do not regenerate it, so shared links never rot.

Collision handling: unique constraint + suffix loop (`screen-studio-2`, `-3`) **retrying on unique-violation** rather than check-then-insert, so simultaneous creates can't both pass a check and collide. Collisions are rare by construction — two tools only reach the same slug with the same name but *different* URLs, i.e. genuinely different tools. Same name + same URL was already deduped at the identity layer.

### Adoption unit

One `builder_tool` row per (builder, tool). The note is **per-tool, not per-product**. Products link through a join table.

## Screens

### 1c — Drawer (the only entry point)

Two states, driven by the link field. Entered from 2a ("Adicionar" / add-slot) or 1b.

```
Link:  [ screen.studio          ]
  ↓ debounced normalize + lookup
┌─ found ────────────────────────────┐   ┌─ not found ──────────────────┐
│ [S] Screen Studio                  │   │ Nome:      [            ]    │
│     Gravação de tela · 34 builders │   │ Categoria: [ select ▾   ]    │
│  (read-only drawer header)         │   │ Descrição: [            ]    │
└────────────────────────────────────┘   └──────────────────────────────┘
  ↓ both continue to the same tail
Por que você usa? (opcional)  [ textarea ]
Em quais produtos?            [ chips    ]
[ Cancelar ]  [ Adicionar ao stack ]
```

Link-first ordering makes dedup a **UI consequence, not a validation error** — you never see "this tool already exists", you see the tool, already filled in. One component, one `addToStack` mutation; the server upserts the tool then inserts the adoption row. Two code paths would drift.

The design has no separate "create tool" screen — this two-state drawer is it.

### 1b — Discovery (`/tools`)

Ranked list: **adopter count desc, tiebreak by most recent adoption**.

Known limitation, accepted for now: the ranking is frozen — early tools accumulate adopters and permanently outrank newer ones. Revisit past ~50 tools with time-decay or a "recentes" toggle.

Category filter chips render from `TOOL_CATEGORIES`. Avatar-overlap stack per row.

**Ships empty.** No seed data. Empty state: "Ninguém adicionou ferramentas ainda — seja o primeiro."

### 1a — Tool detail (`/tools/[slug]`)

Hero: logo, name, category badge, description, external link, adopter count. Actions: "Eu uso também" (opens 1c) and "Compartilhar".

**"Compartilhar" = copy URL to clipboard + sonner toast.** The whole app is behind auth plus an approval gate, so this is an internal share. No Web Share API, no OG image work, no public page. A public/indexable tools directory is explicitly out of scope.

"Quem usa na Matilha" is **two-tiered**, because the note is optional and a noteless adopter would otherwise render as an empty paragraph block:

```
Quem usa na Matilha                                34 builders

[L] Lucas Chitolina   12 sem
    Uso pros vídeos de changelog — o zoom...
    usa em  [M Matilha Builders ●]

[M] Marina Alves       7 sem
    Melhor ferramenta pra demos de produto...
    usa em  [F Fluxo ●]

─────────────────────────────────────────────────
[L][M][R][A][J][+28]  também usam
```

- **With notes** — full entry, ordered most-recent-note first. Fresh opinions on top; gives people a reason to write one. Paginate at 10 ("Ver todos os 34").
- **Without notes** — collapse into one avatar stack, reusing 1b's overlap component. Caps at ~8 avatars + counter, no pagination.

A flat list ordered by streak was rejected: it buries the written opinions, which are the entire point of the page.

"usa em" chips are the existing `product-chip.svelte` with `variant="tag"` — already renders the 24px thumbnail + name + status dot and opens a product drawer. Nothing new to build.

### 2a — Profile tab

Append `ferramentas` as a **fourth** tab, keeping `geral`: Geral · Produtos · Check-ins · Ferramentas. Same `selectTab` query-param sync (`/profile/[id]/+page.svelte:274`).

Ownership, which the design doesn't cover (`/profile/[id]` renders any builder, but 2a is drawn as your own):

- **Own profile** — "Adicionar" header button + dashed add-slot tile, both opening 1c. Cards get a hover `×` to remove, no confirm dialog (cheap, non-destructive, one click to restore).
- **Other profiles** — read-only grid, cards link to 1a. Empty state is a flat line, not a CTA.

### Navigation

Add to `apps/web/src/components/app-sidebar.svelte` after Feed:

```ts
{ href: "/tools", icon: WrenchIcon, label: "Ferramentas" }
```

### Notifications

**Silent write.** No WhatsApp announcement, no `/feed` event.

- Volume is wrong: onboarding fills a stack in one sitting — 8 tools, 8 events. The group gets spammed the day this ships, then nothing for weeks. Check-ins are weekly and deliberate; adoptions are bursty and cheap.
- Signal is wrong: "Lucas added Stripe" isn't news. The interesting artifact is the aggregate, which 1b already shows permanently.
- The WhatsApp announcer is the one piece here that's genuinely hard to undo.

If a discovery loop is wanted later, the right shape is a periodic aggregate ("3 novas ferramentas na Matilha"), not per-adoption events. Separate feature, separate decision.

## Schema sketch

```
tool
  id            text pk
  normalizedKey text  unique   -- identity
  url           text           -- as submitted, immutable
  slug          text  unique   -- addressing, frozen at creation
  name          text
  category      text           -- TOOL_CATEGORIES slug
  description   text
  logoUrl       text  null
  createdAt / updatedAt

builder_tool                    -- adoption
  id         text pk
  builderId  text -> user.id
  toolId     text -> tool.id
  note       text null
  createdAt
  unique (builderId, toolId)

builder_tool_product            -- "usa em"
  builderToolId text -> builder_tool.id
  productId     text -> product.id
  unique (builderToolId, productId)
```

## Explicitly out of scope

Admin UI · merge tooling · approval queue · request-to-add · public directory · revision history · multi-category · free-text categories · seed data · adoption notifications · time-decay ranking · server-side favicon persistence.

---

# Implementation notes

Codebase reconnaissance for whoever picks this up cold. Stack: pnpm + Turborepo, SvelteKit 5 (runes), oRPC + TanStack Query, Drizzle + Neon, better-auth, uploadthing, Biome/Ultracite.

## Files to create

| path | what |
|---|---|
| `packages/db/src/schema/tools.ts` | `tool`, `builderTool`, `builderToolProduct` + relations |
| `packages/db/src/tool-categories.ts` | `TOOL_CATEGORIES` const |
| `packages/api/src/lib/tool-url.ts` | `normalizeToolUrl`, `MULTI_TENANT_HOSTS`, `slugify` |
| `packages/api/src/routers/tools.ts` | `toolsRouter` |
| `apps/web/src/routes/tools/+page.svelte` | 1b discovery |
| `apps/web/src/routes/tools/[slug]/+page.svelte` | 1a detail |
| `apps/web/src/lib/components/matilha/tool-logo.svelte` | favicon → letter-tile fallback |
| `apps/web/src/lib/components/matilha/tool-drawer.svelte` | 1c, two-state |
| `apps/web/src/lib/components/matilha/tool-card.svelte` | 2a stack card |
| `apps/web/src/lib/components/matilha/profile-tools.svelte` | 2a tab body |

## Files to modify

| path | change |
|---|---|
| `packages/db/src/schema/index.ts` | `export * from "./tools"` |
| `packages/api/src/routers/index.ts` | spread `...toolsRouter` into `appRouter` |
| `apps/web/src/lib/server/uploadthing.ts` | add `toolLogoUploader` |
| `apps/web/src/lib/components/matilha/image-upload-button.svelte` | widen `endpoint` union with `"toolLogoUploader"`; `input` type gains `{ toolId: string }` |
| `apps/web/src/components/app-sidebar.svelte` | add `/tools` link after Feed (`links` array, ~line 29) |
| `apps/web/src/routes/profile/[id]/+page.svelte` | 4th tab (see below) |

## Conventions to match

Non-obvious, enforced by Biome/Ultracite — violating these fails `pnpm check`:

- **Object keys and Svelte props are sorted alphabetically.** Applies to Drizzle column definitions, zod shapes, oRPC router keys, component prop objects, and JSX-ish attribute order in markup. Existing code is uniformly sorted; match it.
- `db` is a singleton import from `@matilha-builders/db`, not injected.
- Schema imports are subpath: `@matilha-builders/db/schema/tools`.
- Errors are `ORPCError("NOT_FOUND" | "BAD_REQUEST" | "FORBIDDEN")` with **pt-BR** `message` for anything user-facing. Messages surface via the global `MutationCache` toast in `apps/web/src/lib/orpc.ts` — don't toast manually unless `meta: { skipErrorToast: true }`.
- Pagination is **offset-based**: `PAGE_SIZE` from `packages/api/src/lib/constants.ts`, and the `paginate()` helper shape `{ items, nextCursor }` (`matilha.ts:29`). Reuse it — it's local to `matilha.ts`, so either move it to `lib/` or duplicate.
- All procedures are `protectedProcedure` (auth + approval gate already handled upstream).
- Svelte 5 runes only: `$props()`, `$state()`, `$derived()`, `$effect()`. No stores in components.
- Queries: `createQuery(() => orpc.x.y.queryOptions({ input }))`. Infinite: `createInfiniteQuery` + `infiniteOptions` + `InfiniteScrollSentinel`.
- Animation: `@humanspeak/svelte-motion` (`motion.div`, `AnimatePresence`), `transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}`. See `plans/00*.md` for the motion conventions already ratified.
- UI primitives come from `$lib/components/ui/*` (shadcn-svelte). `select` and `drawer` are already installed. Add missing ones with `pnpm exec shadcn-svelte add <component>` from `apps/web` — never hand-roll.

## Optimistic mutation pattern

`profile-products.svelte` is the reference implementation and should be copied closely for stack add/remove — snapshot, patch, restore, settle:

```ts
const m = createMutation(() => ({
  ...orpc.tools.addToStack.mutationOptions(),
  onError: (_e, _i, ctx) => restoreSnapshot(ctx?.snapshot),
  onMutate: async (input) => {
    const snapshot = await snapshotAndCancel();
    patch((data) => /* optimistic edit */);
    return { snapshot };
  },
  onSettled: settleOtherCaches,
}));
```

Optimistic rows use `_key: "optimistic-" + crypto.randomUUID()` as the `{#each}` key, swapped for the real row in `onSuccess` — this keeps `AnimatePresence` from re-mounting the card and replaying its enter animation.

## Reused components

- `product-chip.svelte` `variant="tag"` — the "usa em" chips on 1a and the chips inside 2a cards. Already renders 24px thumbnail + name + status dot and opens a product drawer. Nothing new needed.
- `avatar.svelte` — adopter avatars and the overlap stack (`size="sm"`, negative margin + `ring-2 ring-card`).
- `streak-badge.svelte` — the `12 semanas` pill next to each adopter.
- `image-upload-button.svelte` — tool logo upload.
- `infinite-scroll-sentinel.svelte` — noted-adopters pagination on 1a.
- `field.svelte` / `form-input-field.svelte` / `form-textarea-field.svelte` — drawer form fields, driven by `@tanstack/svelte-form` + zod `validators: { onSubmit: schema }`.

## Profile tab wiring

In `apps/web/src/routes/profile/[id]/+page.svelte`:

- `tabs` const (line 71) → `["geral", "produtos", "check-ins", "ferramentas"]`. `parseTab` and `selectTab` need no change; they already derive from the array and keep `geral` as the param-less default.
- Add `{@render tabTrigger("ferramentas", "Ferramentas")}` to `TabsList` (after line 281).
- Add `<TabsContent class="pt-5" value="ferramentas"><ProfileTools {founderId} {isOwnProfile} /></TabsContent>`.
- `isOwnProfile` already exists (line 41) — gates the "Adicionar" button, the add-slot tile, and the hover `×`.

## Router surface

```
tools.list          { cursor?, category? }        → paginate(), adopters desc, tiebreak recent
tools.get           { slug }                      → tool + noted adopters + noteless avatars
tools.lookup        { url }                       → normalize → existing tool | null   (drawer debounce)
tools.addToStack    { url, name?, category?, description?, note?, productIds[] }
                                                  → upsert tool, insert adoption
tools.updateStack   { toolId, note?, productIds[] }
tools.removeFromStack { toolId }
tools.updateTool    { toolId, name, category, description }  → wiki edit, adopters only
tools.byFounder     { founderId }                 → 2a
```

`addToStack` does the upsert inside one transaction: normalize URL → `insert ... on conflict (normalizedKey) do nothing returning` → select if the insert no-op'd → insert adoption row (unique on `(builderId, toolId)`) → replace product links. Slug generation retries on unique violation rather than check-then-insert.

## Gotchas

- **Neon HTTP driver has no interactive transactions.** `drizzle-orm/neon-http` (`packages/db/src/index.ts`) can't do `db.transaction(async (tx) => ...)` with round-trips. Either batch into a single statement, lean on `onConflictDoNothing().returning()` + a follow-up select, or switch that path to the WebSocket driver. Do **not** write the upsert assuming interactive transactions work — it will fail at runtime, not compile time.
- Slug retry loop needs a bounded attempt count; catch the Postgres unique-violation code rather than string-matching the message.
- `tool.category` validation: derive the zod enum from `TOOL_CATEGORIES` so adding a slug needs no second edit — `z.enum(TOOL_CATEGORIES.map((c) => c.slug) as [string, ...string[]])`.
- Favicon `<img>` needs an `onerror` fallback to the letter tile, and must be skipped entirely for `MULTI_TENANT_HOSTS` (every GitHub tool would render an identical mark).
- `product-chip.svelte` expects the full `Product` shape (`id`, `name`, `imageUrl`, `status`, `link`, `icp`, `painPoint`, `solution`) — `tools.get` must select those columns, not just id + name.
- Tests: `packages/api/src/routers/matilha.test.ts` is the only existing test file. URL normalization and slug generation are pure functions in `lib/tool-url.ts` and are the highest-value things to unit-test.

## Verification

```bash
pnpm check          # biome/ultracite — will flag unsorted keys
pnpm check-types
pnpm --filter @matilha-builders/db db:push    # or db:generate for a migration
```

Commit `0ecf57a` ("Fix all lint and type-check errors") means the tree starts clean — any new failure is from this work.
