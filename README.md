# Will’s Toolkit MCP

A WebMCP tool layer for people who use ChatGPT while they work in the Squarespace Editor.

## Current tools

- `get_editor_context` reads the active site, page, template, colors, fonts, sections, blocks, and visible block text.
- `inspect_target` reads the HTML, size, and important styles for one selected element.
- `read_custom_css` reads current or saved Squarespace Custom CSS.
- `read_code_injection` reads one Code Injection area or the current page code blocks.
- `add_text_block` adds a paragraph at the bottom of a Fluid Engine section and saves the page.
- `preview_css` applies temporary CSS to the active page preview.
- `clear_preview` removes the temporary CSS.

Only `add_text_block` saves a site change. It works from the normal page preview and from a clean page editor. It refuses to run when the editor has unsaved manual work. The tool description tells ChatGPT to show the user the exact page, section, and text before it runs. The CSS preview disappears when the page reloads.

## How the editor bridge works

Squarespace loads site code injection inside `iframe#sqs-site-frame`. ChatGPT only reads tools from the top editor page.

The preview copy of `webmcp.js` checks that its parent is the same-origin Squarespace `/config` page. It then loads one copy of itself into that editor page. The editor copy registers tools only when `#sqs-site-frame` is available. A public site page cannot register these editor tools.

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

The product-search API and its API key are not part of Will’s Toolkit MCP.
