# Squarespace WebMCP

Squarespace WebMCP gives Codex read-only tools for a Squarespace site that is open in the editor. It uses [WebMCP](https://learn.chatgpt.com/docs/webmcp), a proposed web standard that lets an AI agent use tools supplied by the page that you are viewing.

> [!CAUTION]
> This project is an early alpha for testing and play. Do not use it as production infrastructure. It depends on unsupported Squarespace endpoints and page details that can change without notice. Make a backup before you act on any result.

## Install

You need:

- A Squarespace website.
- A WebMCP-capable agent. This project is currently tested with **Codex** in the app's built-in browser.

You use Codex through your ChatGPT account. You do not need an OpenAI API key. A ChatGPT subscription by itself does not guarantee site-tool access. Access also depends on your workspace, selected model, and the current OpenAI rollout. WebMCP does not work for this project in a normal browser tab by itself.

In Squarespace, open the Code Injection panel. Paste this line into **Footer**, and then save:

```html
<script defer src="https://cdn.jsdelivr.net/gh/willmyerscode/will-myers-webmcp@v0.6.0-alpha.1/dist/webmcp.js"></script>
```

The link loads `dist/webmcp.js` from the public GitHub repository through [jsDelivr](https://www.jsdelivr.com/?docs=gh). It is pinned to the `v0.6.0-alpha.1` Git tag, so later work on `main` will not change this file. To get a later alpha, replace the version in the link after a new release is published.

Next:

1. Open the Squarespace editor in the built-in browser.
2. Sign in to Squarespace.
3. Open the site that you want to inspect.
4. Open **Site tools** in the browser address bar. You should see the tools below.
5. Ask Codex to index the site before you search it.

Squarespace documents [how to use Footer Code Injection](https://support.squarespace.com/hc/en-us/articles/205815908-Using-code-injection). Squarespace also states that custom code is outside its support service.

## Questions to ask Codex now

Try prompts such as:

- “Index this Squarespace site. Wait until the index is complete, and then give me the page and block totals.”
- “Find all newsletter blocks on this site. Give me each page URL, section ID, and block ID.”
- “Find every page or collection item that contains the words `summer workshop`.”
- “Find every block that mentions `old product name`.”
- “Read this search result again and tell me if its content is still current.”
- “Read my Custom CSS. Use the site index to find CSS that may no longer be needed. Explain the evidence and possible mistakes. Do not change anything.”
- “Read my site-wide Code Injection. Explain what each script does and flag duplicate or broken-looking code. Do not change anything.”

## Current focus: find Custom CSS that may be unused

The narrow goal is to help a person review the Squarespace Custom CSS area. The current flow is:

1. Run `index_site` and wait for it to finish.
2. Run `read_site_custom_css` to get the current CSS text.
3. Ask Codex to compare the CSS with the site index.
4. Codex makes the judgment and explains its evidence.
5. You review the answer before you remove any CSS.

The WebMCP tool does not decide what is safe to remove. It only reads the CSS. Codex does the analysis. A selector that is absent from saved page HTML can still be used by a menu, hover state, pop-up, store page, member area, mobile layout, injected widget, or other temporary state. Treat each answer as a review suggestion, not proof.

The tool does **not** remove or save CSS.

## Current tools

| Tool | What it does |
| --- | --- |
| `index_site` | Starts a private site-index job or reports its progress. It finds pages from the signed-in Squarespace page map and saves page, collection item, folder, section, and block records. |
| `find_site` | Searches the saved index for text, titles, URLs, metadata, block types, and IDs. It returns exact page, section, block, or item locations. |
| `read_site` | Gets fresh Squarespace data for one indexed result and updates its saved browser record. |
| `read_site_custom_css` | Returns the current Custom CSS text. It does not analyze or change the CSS. |
| `read_site_code_injection` | Returns the current site-wide Code Injection fields. It does not analyze or change the code. |

All current tools are read-only. They use HTTP `GET`. They cannot change Squarespace pages, CSS, code, settings, or metadata.

## How it works

The Footer Code Injection script first loads in the Squarespace site preview. It checks that the parent page is a same-origin Squarespace editor URL under `/config`. It then loads one copy into that top editor page. This step is needed because the current built-in browser does not discover WebMCP tools inside an iframe.

On the editor page, the script uses `document.modelContext.registerTool()` to give Codex the five tools. If WebMCP is not present, the script stops and Squarespace continues to work.

When you run `index_site`, the script:

1. Reads the private page map for the signed-in site.
2. Gets structured page and collection data.
3. Follows collection pagination and reads each available item.
4. Reads rendered HTML for normal pages so it can find sections and blocks.
5. Saves the records in an IndexedDB database named `squarespace-webmcp-index`.

IndexedDB is a database inside your browser profile. The index stays on your computer. This project does not upload the index to jsDelivr, GitHub, Cloudflare, or a project database. The browser still sends normal read requests to Squarespace to build and refresh the index.

A later index run skips a source when its Squarespace update value did not change. A failed page keeps its last valid records. A page that is no longer in the private page map is removed from the local index.

`find_site` loads the current site's records from IndexedDB and searches them in the page. `read_site` gets one result from Squarespace again and replaces the saved copy for that URL.

`read_site_custom_css` returns the current Custom CSS text. `read_site_code_injection` returns the current header, footer, lock-page, order, and blog-post injection fields. The tools do not parse, judge, or change this code. Codex can analyze the returned text when you ask it a question.

## Local storage, speed, and privacy risks

Browser support has two separate parts:

| Part | Current support |
| --- | --- |
| IndexedDB | It is a standard browser database. MDN marks it as widely available across browsers since July 2015. |
| WebMCP site tools | This is the limiting part. WebMCP is still a proposal. This project is currently tested with Codex in the built-in browser in the ChatGPT desktop app. |
| Normal Chrome, Edge, Firefox, or Safari tab | IndexedDB works, but this project has no agent connection there by itself. The WebMCP tools will not appear. |

There is no single IndexedDB size limit. Each browser calculates a quota from the device, browser mode, free space, and its own storage policy. A write can fail with `QuotaExceededError`. Browser storage is normally “best effort,” so the browser can remove it under storage pressure. Private or Incognito mode usually removes it when that session ends. See [MDN's storage quota guide](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) and [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

Published upper limits also differ. These numbers are not promised free space:

| Browser family | Published best-effort limit per origin |
| --- | --- |
| Chromium, including Chrome and Edge | Up to about 60% of total disk size. |
| Firefox | The smaller of 10% of total disk size or 10 GiB for the group of related origins. |
| Safari 17 and later | Up to about 60% of total disk size for a browser app. |

The device can run out of real free space before it reaches these calculated limits. Other site data for the same origin can also use part of the quota.

The current alpha has these practical risks:

- A large site takes longer because the index reads each discovered page and collection item.
- The saved index can be larger than the visible page text. It also keeps source JSON and some section and block HTML so results have context.
- Search currently loads all records for the site into memory. A very large index can use more memory and can make a slow computer or editor tab pause.
- HTML parsing and text search run in the editor page. They can compete with Squarespace for CPU time.
- A full refresh replaces the saved records in one browser transaction. Low disk space or a browser quota can make that write fail.
- The index is not encrypted by this project. It can contain unpublished, draft, password-protected, or other private content that the signed-in Squarespace session returned.
- Scripts that run with the same Squarespace editor origin can access the same browser storage. Install only code that you trust.
- The script also downloads on public site pages because it is in Footer Code Injection. It only registers tools on the signed-in `/config` editor page, but public visitors still make the small script request.

To remove the tool, delete its script tag from Footer Code Injection. To also remove its local data, use the browser's site-data controls to delete the `squarespace-webmcp-index` IndexedDB database for that Squarespace origin.

## Unsupported Squarespace interfaces

These are the Squarespace interfaces and page details used by the current alpha:

| Interface | Use | Status |
| --- | --- | --- |
| `GET /api/context/website` | Gets the signed-in site's ID and page map. | Undocumented and unsupported. |
| `GET /api/template/GetTemplateCustomCss` | Gets the site's Custom CSS text. | Undocumented and unsupported. |
| `GET /api/config/GetInjectionSettings` | Gets the site-wide Code Injection fields. | Undocumented and unsupported. |
| `GET <page-or-item>?format=json` | Gets page, collection, pagination, and collection-item data. | Undocumented and unsupported for this use. |
| Rendered page HTML | Finds `#page`, `[data-section-id]`, `.sqs-block`, block IDs, and block types. | Internal markup can change. |
| Editor URL and `iframe#sqs-site-frame` | Moves tool registration from the preview into the top `/config` editor page. | Internal editor structure can change. |

These interfaces were found by inspecting normal Squarespace network traffic and page markup. They are not a public Squarespace API contract. Squarespace can change, limit, or remove them at any time. The project handles `429` responses with `Retry-After` or short increasing waits, but this does not make the interfaces supported.

This project is not made, approved, or supported by Squarespace.

## WebMCP status

WebMCP is a proposed standard, not a settled browser feature. This project uses its imperative `document.modelContext.registerTool()` API. OpenAI's built-in browser currently supports only part of the proposal. See the [official OpenAI site-tools guide](https://learn.chatgpt.com/docs/webmcp) and the [WebMCP proposal](https://github.com/webmachinelearning/webmcp).

## Develop locally

```sh
npm install
npm test
npm run check
npm run build
```

The build writes `dist/webmcp.js`. The detailed tool contracts are in [`docs/CONTRACTS.md`](docs/CONTRACTS.md), and the test steps are in [`docs/TESTING.md`](docs/TESTING.md).

## License

[MIT](LICENSE) © Will Myers
