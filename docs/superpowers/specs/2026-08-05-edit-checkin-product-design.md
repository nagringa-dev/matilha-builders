# Edit check-in product association

## Goal

Allow a founder to replace the product associated with an editable check-in. The existing edit window, ownership rules, and text-field behavior remain unchanged.

## User experience

- The edit drawer shows a `Sobre qual produto` select before the text fields.
- The current product is selected when the drawer opens.
- The select lists only products owned by the signed-in founder.
- The founder must select a product; the editor does not offer a `Sem produto` option.
- Saving closes the drawer and updates both the check-in text and product chip optimistically.
- If the request fails, the existing error toast appears and affected check-in lists are invalidated to restore server state.

## Client design

`CheckInItem` loads the signed-in founder's products through the existing `products.mine` query. TanStack Query shares this result across item instances, so multiple editable check-ins do not produce independent network fetches.

`CheckInEditor` receives the product list and extends its form values with `productId`. Its `prime` method initializes `productId` from the check-in's current product. The existing shadcn-svelte select primitives and field wrapper are reused to match the creation form.

The update mutation includes `productId`. Its optimistic cache patch replaces the product object alongside `blocked`, `help`, and `progress`, so feed and founder-history chips update immediately.

## Server design

The `checkIns.update` input requires `productId`. Before updating the check-in, the handler calls the existing owned-product guard with the authenticated founder ID. The update writes `productId` together with the text fields.

This prevents a crafted request from associating another founder's product and preserves the existing edit-window and check-in ownership validation.

## Error handling

- A missing or foreign product is rejected by the owned-product guard.
- A non-editable check-in continues to be rejected by the existing editable-check-in guard.
- Client failures keep the existing toast and list invalidation behavior.

## Validation

- API tests verify that a valid owned product ID is persisted.
- API tests verify that a foreign or missing product is rejected and the check-in is not updated.
- Svelte type checking verifies the extended editor values, props, and optimistic cache types.
- Existing API and web tests remain green.
