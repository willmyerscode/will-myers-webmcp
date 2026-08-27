# Read-only index checks

## Completion criteria

This slice is complete when:

- The index contains every discovered page and collection item.
- Paginated collection items from pages such as `/technical-blog?format=json` are included.
- Page, section, and block records have stable locations.
- The index remains after a browser reload and stays separate for each site.
- A later run skips unchanged pages, keeps valid data after a read error, and removes missing pages.
- Search covers text, URLs, titles, block types, and metadata.
- Search takes less than one second for a 1,000-item test index.
- A fresh read updates the saved record and removes a record after a 404 response.
- All browser requests use GET, and no tool can change Squarespace.
- A large crawl runs in the page and can report progress without one long tool call.
- The index does not request `sitemap.xml`.
- Navigation folders are searchable without a request to their URLs.
- A `429` response waits and retries without slowing normal requests.

## Automated

Run:

```sh
npm test
npm run check
npm run build
```

## Live browser check

1. Open the Everything Testing site in the signed-in Squarespace Editor.
2. Call `index_site` with `action: "start"`.
3. Call it with `action: "status"` until it is complete. Confirm that it reports no errors.
4. Search for a normal page block and confirm its page, section, and block IDs.
5. Search for a Technical Blog item that is not on the first collection page.
6. Reload the Squarespace Editor and repeat both searches without another index run.
7. Change test content in Squarespace, then run `read_site` for that record. Confirm that it returns the new content.
8. Confirm that Squarespace shows no saved content, design, code, or metadata change from the tools.

## Normal browser fallback

Open the site in a browser without WebMCP support. Confirm that the console has no uncaught tool error and that Squarespace works normally.

## Rollback

Remove the `webmcp.js` script tag from footer code injection. To also remove the local index, delete the `squarespace-webmcp-index` IndexedDB database in browser storage.
