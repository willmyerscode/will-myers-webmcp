# Will’s Toolkit MCP

A WebMCP tool layer for people who use ChatGPT while they work in the Squarespace Editor.

## Current tool

- `get_editor_context` reads the active site, page, template, colors, fonts, sections, blocks, and visible block text.
- `inspect_target` reads the HTML, size, and important styles for one selected element.
- `preview_css` applies temporary CSS to the active page preview.
- `clear_preview` removes the temporary CSS.

No tool saves or changes the Squarespace site. The CSS preview disappears when the page reloads.

## How the editor bridge works

Squarespace loads site code injection inside `iframe#sqs-site-frame`. ChatGPT only reads tools from the top editor page.

The preview copy of `webmcp.js` checks that its parent is the same-origin Squarespace `/config` page. It then loads one copy of itself into that editor page. The editor copy registers `get_editor_context` and reads the preview frame when ChatGPT calls the tool.

Browsers without WebMCP support ignore the registration. Squarespace keeps working normally.

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

The old product API remains in the Worker for rollback safety, but no registered tool calls it. The product-search API key is not needed for Will’s Toolkit MCP.
