# Compact product chip favicon design

## Goal

Make compact product presentations use the same favicon rule as product selectors: derive a website's standard favicon from the product link and fall back to the product initial.

## Scope

Change `ProductChip` only for its compact `tile` and `tag` variants. These variants appear in the profile timeline, check-in cards, featured-product strip, and other small product references.

The `cover` variant remains unchanged and continues to use `imageUrl`, because large product cards benefit from the product's full visual image rather than a small favicon.

## Shared favicon rule

Move the favicon URL derivation into a shared web helper used by both `ProductSelectCard` and `ProductChip`:

```
valid HTTP(S) link -> <origin>/favicon.ico
otherwise -> null
```

Each component tracks a failed derived favicon URL locally. A missing link, malformed or unsupported URL, or image loading failure shows the uppercase initial of the product name.

## ProductChip behavior

- `tile` and `tag`: use the derived favicon, then initial fallback
- `cover`: use the current `imageUrl`, then current initial fallback
- preserve dimensions, rounded corners, external product links, status labels, status dots, truncation, and tooltip behavior

The favicon is decorative because the product name remains adjacent and accessible.

## Validation

- run typecheck, web tests, and Biome for the helper, selector card, and product chip
- verify `tile` and `tag` show a favicon when the product has a valid website link
- verify compact variants show the initial when there is no link or the favicon fails
- verify `cover` continues to render its configured `imageUrl`
- visually inspect a profile timeline entry and a check-in product chip
