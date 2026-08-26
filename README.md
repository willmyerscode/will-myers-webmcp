# Will Myers WebMCP

A small WebMCP pilot for [will-myers.com](https://www.will-myers.com/). It adds two browser tools while leaving the normal Squarespace site in control.

## Tools

- `find_products` searches the current public Squarespace product catalog and returns matching product links.
- `start_support_request` opens `/contact` and fills a support-request draft. It never checks the admin-access confirmation and never submits the form.

The script uses the browser draft API at `document.modelContext`. Browsers without WebMCP support ignore the tool registration and continue to use the normal site.

## Data and safety

- Products come from the public `/products?format=json` response. Version 1 does not need a Squarespace API key.
- No product, checkout, account, or form-submission action is available.
- A pending support draft stays in the visitor tab's `sessionStorage` only long enough to move from the current page to `/contact`.
- The user must review all fields, make the admin-access confirmation, and press Submit.
- The script sends no visitor data to Cloudflare. Cloudflare only hosts the static JavaScript file.

## Local work

```sh
npm install
npm test
npm run check
npm run build
npx wrangler dev
```

The built browser file is `dist/webmcp.js`.

## Squarespace installation

After the Cloudflare host is live, add this one line to the Squarespace site footer code injection area:

```html
<script defer src="https://webmcp.otis.solutions/webmcp.js"></script>
```

Do not add this tag until the host is deployed and the live script URL passes the checks in `docs/TESTING.md`.

## Hosting

Cloudflare Workers Static Assets hosts the script at [webmcp.otis.solutions](https://webmcp.otis.solutions/). The pilot uses a five-minute browser cache to make rollback fast. The generated `workers.dev` address remains available as a fallback.
