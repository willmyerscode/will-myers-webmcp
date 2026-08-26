# Pilot tool contracts

## `find_products`

Purpose: help a visitor find a relevant Will Myers product without buying it.

Inputs:

- `query: string` — required after trimming, 1–200 characters.
- `max_results?: integer` — optional, 1–10, default 5. Strings, fractions, zero, and values above 10 are errors.

Success output:

- `query: string` — the trimmed query.
- `count: number` — the number of returned matches.
- `products: Product[]` — up to `max_results` matches.
- `note: string` — the next step or a no-match message.

Each `Product` has:

- `id: string`
- `title: string`
- `summary: string` — plain text made from the public HTML excerpt.
- `price: { currency: string, value: string } | null`
- `onSale: boolean`
- `url: string` — an absolute public product URL.

Side effects: none. The tool reads the public `/api/products` endpoint at `will-myers-webmcp.otis.solutions`.

The Cloudflare Worker uses `GET https://api.squarespace.com/v2/commerce/products`. It follows Squarespace pagination, removes hidden products, removes HTML from descriptions, and returns only public product fields. It uses the product price or the first variant price. A sale price is used when it exists. The tool does not infer a license field. License words remain visible in the public product title.

Failures throw a JavaScript `Error` with a short public message. Failure cases are a non-text, empty, or long query; an invalid `max_results`; a failed product-service HTTP response; an empty product list; a response without `products`; or a product without `id`, `title`, or `url`. No close match is a successful result with `count: 0` and an empty `products` list.
