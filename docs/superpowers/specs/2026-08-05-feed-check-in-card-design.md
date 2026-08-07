# Feed check-in card design

## Goal

Make feed check-ins easier to scan while preserving the existing dark, compact, mono-accented visual language. The card should lead with the product and the current check-in state, then make each written update easy to separate.

## Card layout

### Header

- Show the product first, using its favicon and name. The compact product presentation must not show the product lifecycle status, because the check-in status owns that visual role here.
- Show an accessible red status indicator on the right only when the check-in requests help. Progress and blocked-only updates do not need a header indicator.
- The indicator has a tooltip describing the state. It must not be represented only by color to assistive technology.
- Legacy check-ins without a product receive a neutral fallback label and initial instead of failing to render.

### Update body

- Keep progress as the first and required section.
- Render blocked and help only when their content is present.
- Give each rendered section its own vertical spacing and a small colored label: green for progress, amber for blocked, and red for help.
- Keep copy untruncated and maintain the existing card surface, rounded border, and restrained visual treatment.

### Footer and actions

- Move identity and time to the footer: `Seu check-in` for the viewer's own item, otherwise the founder name; relative time sits below it in muted small text.
- Preserve edit as an icon-only button.
- Make dismissal an icon-only flag button with tooltip text, retaining the existing confirmation dialog, voting count, pending state, and accessibility label.

## Check-in form behavior

- Progress stays required.
- Add independent `Travou nesta semana?` and `Precisa de ajuda?` disclosures in both the creation page and edit drawer.
- Opening a disclosure reveals its textarea and makes it required. Closing it hides the textarea while preserving text already entered, so people can reconsider without losing their work.
- Optional text fields are represented by empty values when unused. No schema migration or new database columns are needed.
- The API accepts an empty blocked value, while progress remains required. Help continues to be omitted when empty.

## State derivation

The feed card shows its status indicator directly from persisted content: a non-empty help value produces the red marker. This keeps existing check-ins compatible and makes the call for community help immediately visible.

## Validation

- Add or adjust API tests for creating and editing check-ins without a blocked value.
- Add component tests for disclosure-driven required fields and the red help indicator.
- Run targeted formatting, Svelte type checking, and web tests.
- Validate locally with the three seeded founders: progress-only, blocked, and red help states; verify icon tooltips and responsive layout.
