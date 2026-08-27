# Squarespace WebMCP

A browser-only WebMCP layer for people who use an AI assistant while they work in the Squarespace Editor.

## Current tools

- `index_site` starts a private site index job and reports its progress.
- `find_site` searches the index and returns exact page, section, block, or item locations.
- `read_site` gets fresh Squarespace data for one result and updates its saved browser record.

All three tools are read-only. They cannot change Squarespace. The index stays in IndexedDB in the user's browser. There is no content database on the Cloudflare host.

## What the index contains

The index starts with the signed-in Squarespace page map. It does not read `sitemap.xml`. It follows `?format=json` pagination for blogs and other collection pages. When an item URL is available, its full item response replaces the collection summary. Navigation folders become searchable folder records, but their URLs are not fetched.

Call `index_site` with `action: "start"`. Then call it with `action: "status"` until it returns `status: "complete"`. The crawl continues in the page between calls, so a large site does not exceed the browser tool time limit.

Normal pages also use their rendered HTML because Squarespace can return an empty `mainContent` value. The stored records include pages, collection items, sections, and blocks. Block records keep their page → section → block location.

A later index run skips records whose Squarespace update value did not change. A failed page keeps its last valid records. A page that is gone from the private page map is removed.

Normal requests have no added delay. If Squarespace returns `429`, the index uses `Retry-After`. If that header is missing, it waits 1, 2, 4, 8, then 16 seconds. It makes at most five retry requests. Each fallback wait is limited to 30 seconds.

## How the editor bridge works

Squarespace loads footer code inside `iframe#sqs-site-frame`. The AI assistant reads tools from the top editor page.

The preview copy of `webmcp.js` checks that its parent is the same-origin Squarespace `/config` page. It then loads one copy of itself into that editor page. A public site page cannot start the editor tools.

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
