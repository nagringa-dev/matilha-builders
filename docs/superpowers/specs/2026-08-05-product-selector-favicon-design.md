# Product selector favicon design

## Goal

Use a product website's standard favicon in product selectors instead of the product thumbnail. When no favicon is available, show the uppercase initial of the product name.

## Scope

Change only `ProductSelectCard`, which is already shared by the new check-in form and the editable check-in drawer in PR #12. Product selection, form values, API contracts, and database fields remain unchanged.

## Favicon resolution

The component receives the product `link` in addition to its name and status. For a valid HTTP or HTTPS URL, it derives the favicon URL from the origin:

```
https://example.com/path -> https://example.com/favicon.ico
```

The component does not use a third-party favicon service and does not fetch or persist favicon metadata through the API.

## Fallback behavior

- no link: show the product initial
- malformed or unsupported link: show the product initial
- favicon request fails: show the product initial
- favicon loads: show it as the compact selector image

Failure is tracked per derived favicon URL, so changing to a product with another link retries that product's favicon normally.

## Component and integration

`ProductSelectCard` removes its dependency on `imageUrl` and accepts an optional `link`. Existing selector consumers already receive product links from the products query; the edit drawer product type is extended to include the field.

The card keeps its current name, status dot, localized status label, dimensions, truncation, select accessibility, keyboard behavior, and selected-item styling. The favicon is decorative because the adjacent product name already provides the accessible label.

## Validation

- run Svelte typecheck and Biome for the component and both selector consumers
- verify a product with a valid website link loads `<origin>/favicon.ico`
- verify products without links and failed favicon URLs use the initial
- verify selection in the create and edit check-in selectors, including keyboard navigation
