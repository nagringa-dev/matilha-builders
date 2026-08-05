# Feed check-in card design

## Goal

Make feed check-ins easier to scan while preserving the existing dark, compact, mono-accented visual language. The card should lead with the product and the current check-in state, then make each written update easy to separate.

## Card layout

### Header

- Show the product first, using its favicon and name. The compact product presentation must not show the product lifecycle status, because the check-in status owns that visual role here.
- Replace the header author and relative time with one accessible status indicator on the right:
  - green when the check-in contains only progress;
  - yellow when it contains a blocked update;
  - red when it requests help, including when both optional sections are present.
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
- Add independent `Travou nesta semana` and `Precisa de ajuda da comunidade` checkboxes in both the creation page and edit drawer.
- Each checkbox controls its corresponding textarea. Enabling it displays the textarea and makes it required. Disabling it clears the value and hides the textarea.
- Optional text fields are represented by empty values when disabled. No schema migration or new database columns are needed.
- The API accepts an empty blocked value, while progress remains required. Help continues to be omitted when empty.

## State derivation

The feed card derives its status directly from persisted content:

1. non-empty help: red;
2. otherwise non-empty blocked: yellow;
3. otherwise: green.

This keeps existing check-ins compatible and makes red deterministic when both checkboxes are selected.

## Validation

- Add or adjust API tests for creating and editing check-ins without a blocked value.
- Add component tests for checkbox-driven required fields and for the three feed state variants.
- Run targeted formatting, Svelte type checking, and web tests.
- Validate locally with the three seeded founders: green-only, yellow blocked, and red help states; verify icon tooltips and responsive layout.
