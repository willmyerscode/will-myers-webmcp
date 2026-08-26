# Will Myers WebMCP

A small WebMCP pilot for [will-myers.com](https://www.will-myers.com/). It adds one read-only browser tool while leaving the normal Squarespace site in control.

## Tools

- `find_products` searches the current public Squarespace product catalog and returns matching product links.

The script uses the browser draft API at `document.modelContext`. Browsers without WebMCP support ignore the tool registration and continue to use the normal site.

## Data and safety

- A Cloudflare Worker reads products from the official Squarespace Products API.
- The Squarespace API key is a Cloudflare secret. It is not in the browser script or this repository.
- Only visible products with public `will-myers.com` URLs go to the browser.
- No product, checkout, account, or form-submission action is available.
- The script sends a product search phrase to no server. It downloads the public product list and ranks matches in the visitor's browser.

## Local work

```sh
npm install
npm test
npm run check
npm run build
npx wrangler dev
```

The built browser file is `dist/webmcp.js`.

## Squarespace API key

Create a Squarespace API key with `Products API — Read Only` permission. Then store it directly in Cloudflare from a local terminal:

```sh
npx wrangler secret put SQUARESPACE_API_KEY
```

Paste the key only into that terminal prompt. Do not put the key in this repository or in the Squarespace footer.

## Squarespace installation

After the Cloudflare host is live, add this one line to the Squarespace site footer code injection area:

```html
<script defer src="https://will-myers-webmcp.otis.solutions/webmcp.js"></script>
```

Do not add this tag until the host is deployed and the live script URL passes the checks in `docs/TESTING.md`.

## Hosting

Cloudflare Workers hosts the script and product service at [will-myers-webmcp.otis.solutions](https://will-myers-webmcp.otis.solutions/). Product data has a five-minute cache. The generated `workers.dev` address remains available as a fallback.
