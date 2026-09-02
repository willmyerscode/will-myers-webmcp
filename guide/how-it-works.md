# How it works

## The WebMCP bridge

The Footer Code Injection script first loads in the Squarespace site preview. It checks for a same-origin Squarespace editor page under `/config`, then loads one copy into that top editor page.

This extra step is needed because the current Codex browser does not find WebMCP tools inside the Squarespace preview iframe.

The top editor page uses `document.modelContext.registerTool()` to register the five tools. If WebMCP is not available, the script stops and Squarespace continues to work.

## The local site index

When you run `index_site`, the script:

1. reads the signed-in site's private page map;
2. gets structured page and collection data;
3. follows collection pagination;
4. reads rendered HTML for normal pages;
5. saves page, item, folder, section, and block records in IndexedDB.

The database is named `squarespace-webmcp-index`. It stays in the browser profile for that Squarespace origin.

A later index run skips a source when its Squarespace update value has not changed. A failed page keeps its last valid records. A page removed from the private page map is removed from the local index.

`search_site` searches the saved records in the editor page. `read_site_record` gets one record from Squarespace again and updates its local copy.

## CSS and Code Injection

`read_site_custom_css` returns the current CSS text. `read_site_code_injection` returns the current site-wide injection fields.

These tools do not use the local index. They do not parse the returned code or make cleanup decisions.

## Network requests

Normal tool requests have no added delay. If Squarespace returns `429`, the script follows `Retry-After`. Without that header, it waits 1, 2, 4, 8, then 16 seconds. It stops after five retries.

## Unsupported Squarespace interfaces

The alpha uses these interfaces and page details:

| Interface | Use | Status |
| --- | --- | --- |
| `GET /api/context/website` | Gets the signed-in site ID and page map. | Undocumented and unsupported. |
| `GET /api/template/GetTemplateCustomCss` | Gets Custom CSS. | Undocumented and unsupported. |
| `GET /api/config/GetInjectionSettings` | Gets site-wide Code Injection. | Undocumented and unsupported. |
| `GET <page-or-item>?format=json` | Gets page, collection, pagination, and item data. | Unsupported for this use. |
| Rendered page HTML | Finds the page root, sections, blocks, IDs, and block types. | Internal markup can change. |
| Editor URL and `iframe#sqs-site-frame` | Registers tools in the top editor page. | Internal editor structure can change. |

These details came from normal Squarespace network traffic and page markup. They are not a public Squarespace API contract. Squarespace can change, limit, or remove them at any time.

This project is not made, approved, or supported by Squarespace.

## WebMCP status

WebMCP is a proposed standard. This project uses its imperative `document.modelContext.registerTool()` API. The Codex built-in browser supports only part of the proposal.

See the [OpenAI site-tools guide](https://learn.chatgpt.com/docs/webmcp) and the [WebMCP proposal](https://github.com/webmachinelearning/webmcp).
