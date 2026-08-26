# Editor context checks

## Automated

Run:

```sh
npm test
npm run check
npm run build
```

## ChatGPT browser

1. Sign in to the test Squarespace site inside the ChatGPT browser.
2. Open a page in the Squarespace Editor.
3. Confirm that `get_editor_context`, `inspect_target`, `preview_css`, and `clear_preview` are available on the top `/config/` page.
4. Call the tool with `{}`.
5. Confirm that it returns the current site ID, page ID, template version, colors, fonts, sections, and blocks.
6. Change to another page and call the tool again. Confirm that the page data changes.
7. Confirm that the call does not save content or add a preview style.
8. Call `inspect_target` with one returned section or block ID. Confirm that it returns HTML and computed styles.
9. Call `preview_css` with CSS that targets that section or block ID.
10. Confirm that the preview changes and that Squarespace does not show a saved change.
11. Call `clear_preview` and confirm that the temporary change disappears.

## Normal browser fallback

1. Open the site in a browser without WebMCP support.
2. Confirm that the console has no uncaught tool error.
3. Confirm that the editor and preview work normally.

## Rollback

Remove the `webmcp.js` script tag from footer code injection. The editor bridge has no database and saves no Squarespace data.
