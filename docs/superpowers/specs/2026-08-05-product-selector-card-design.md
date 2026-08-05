# Product selector card design

## Goal

Replace plain product names in every product selector with a reusable compact card that makes each product easier to recognize. The card appears both in the closed trigger and in every dropdown option.

## Scope

The web app currently has two product selectors:

- the new check-in form
- the editable check-in drawer introduced by the editable-product change

Both selectors will use the same new presentation component. Selection behavior, form state, validation, and API contracts remain unchanged.

## Component

Create `ProductSelectCard` in the Matilha component directory. It is a presentational component and receives a product containing:

- `id`
- `name`
- `imageUrl`
- `status` (`validating`, `building`, or `launched`)

The component owns only product presentation. The surrounding `SelectTrigger` and `SelectItem` remain responsible for interaction, keyboard behavior, selected state, highlighting, and the checkmark.

## Visual treatment

The card uses one horizontal row:

- a compact square thumbnail with rounded corners on the left
- the product name in medium-weight text on the right
- a smaller status line below the name
- a colored status dot followed by the Portuguese label: `validando`, `construindo`, or `lançado`

When an image is absent or fails to load, the thumbnail shows the uppercase initial of the product name using the existing muted fallback treatment. Long names truncate instead of increasing the selector width.

The selector trigger becomes tall enough for the two-line card while retaining its current border, focus ring, chevron, disabled state, and full-width layout. Dropdown options rely on the existing select item highlight and selected checkmark, with spacing adjusted for the card.

## Integration

In both selectors:

- resolve the selected product from the existing product list
- render `ProductSelectCard` inside the trigger when a product is selected
- keep `Escolher produto` as the empty-state text
- render `ProductSelectCard` inside every `SelectItem`
- keep the product ID as the select value and the product name as its accessible label

No product fetching or mutation logic moves into the component.

## Error handling

Broken image URLs fall back to the product initial without affecting selection. An empty or loading product list keeps the current placeholder behavior. Existing form validation continues to prevent saving without a required product where applicable.

## Validation

- run the web typecheck
- run Biome on the new component and both selector consumers
- verify the new check-in selector with and without a selected product
- verify the edit check-in selector is prefilled and can switch products
- verify image, initial fallback, status colors, long-name truncation, keyboard selection, and focus styling
