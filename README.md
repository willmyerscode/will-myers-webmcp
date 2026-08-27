# Squarespace WebMCP

A browser-only WebMCP layer for people who use an AI assistant while they work in the Squarespace Editor.

## Current state

The script registers zero tools. It keeps only the small bridge that loads WebMCP code from the Squarespace preview frame into the signed-in top editor page.

The next slice will add three read-only tools:

- `index_site` will build a local site index in the browser.
- `find_site` will search that index.
- `read_site` will get current Squarespace data and refresh the local index.

No tool can write to Squarespace. The planned index will stay in the user's browser.

## How the editor bridge works

Squarespace loads footer code inside `iframe#sqs-site-frame`. The AI assistant reads tools from the top editor page.

The preview copy of `webmcp.js` checks that its parent is the same-origin Squarespace `/config` page. It then loads one copy of itself into that editor page. The editor copy starts the empty tool shell only when `#sqs-site-frame` is available. A public site page cannot start the shell.

Browsers without WebMCP support ignore the script. Squarespace keeps working normally.

## Local checks

```sh
npm install
npm test
npm run check
npm run build
```

The built browser file is `dist/webmcp.js`.

## Squarespace test installation

Add this line to the test site footer code injection area:

```html
<script defer src="https://will-myers-webmcp.otis.solutions/webmcp.js"></script>
```

Do not install this test build on a customer site yet.

## Hosting

Cloudflare Workers hosts the script at [will-myers-webmcp.otis.solutions](https://will-myers-webmcp.otis.solutions/).
