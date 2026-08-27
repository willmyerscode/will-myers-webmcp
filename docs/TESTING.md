# Empty bridge checks

## Completion criteria

This reset phase is complete when:

- The signed-in Squarespace Editor starts the browser bridge.
- The bridge registers zero MCP tools.
- A public Squarespace page does not start the editor bridge.
- The preview frame adds only one bridge script to its editor parent.
- The source has no old read, preview, or write tool code.

## Automated

Run:

```sh
npm test
npm run check
npm run build
```

The browser tests check the first four completion criteria. A source search checks the last criterion.

## Browser check

1. Sign in to the test Squarespace site inside the AI browser.
2. Open the Squarespace Editor at a `/config/` URL.
3. Confirm that the bridge script loads in the top editor page.
4. Confirm that the WebMCP tool list is empty.
5. Open a public site page outside the editor. Confirm that the editor bridge does not start.
6. Confirm that no page content, design setting, or site code changes.

## Normal browser fallback

Open the site in a browser without WebMCP support. Confirm that the console has no uncaught tool error and that Squarespace works normally.

## Rollback

Remove the `webmcp.js` script tag from footer code injection. The bridge has no database and makes no Squarespace changes.
