# Risks and limitations

## Alpha software

This project is for testing. It depends on unsupported Squarespace endpoints and editor markup. A Squarespace change can break it without warning.

Do not use it as production infrastructure. Back up code before you remove or replace anything.

## Browser support

| Part | Current support |
| --- | --- |
| IndexedDB | Available in current major browsers. |
| WebMCP tools | This is the limiting part. WebMCP is still a proposal. |
| Codex built-in browser | This is the browser used for current testing. |
| Normal Chrome, Edge, Firefox, or Safari tab | IndexedDB works, but the WebMCP tools do not appear by themselves. |

A ChatGPT subscription does not guarantee site-tool access. Access also depends on the current OpenAI rollout, workspace, and selected model.

## Local storage

There is no single IndexedDB size limit. Each browser calculates a quota from the device, browser mode, free space, and its storage rules. A write can fail with `QuotaExceededError`.

Browser storage is normally best effort. The browser can remove it under storage pressure. Private or Incognito mode normally removes it when the session ends.

Published best-effort limits differ by browser family:

| Browser family | Published upper limit per origin |
| --- | --- |
| Chromium, including Chrome and Edge | About 60% of total disk size. |
| Firefox | The smaller of 10% of disk size or 10 GiB for a group of related origins. |
| Safari 17 and later | About 60% of disk size for a browser app. |

These are calculated limits, not promised free space. See [MDN's storage quota guide](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) and [WebKit's storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

## Speed and memory

- A large site takes longer because the index reads each discovered page and collection item.
- The index keeps source JSON and some HTML, so it can be larger than the visible page text.
- Search loads all records for the current site into memory.
- HTML parsing and search run in the editor page and compete with Squarespace for CPU time.
- Low disk space or a browser quota can make an index write fail.

A very large site can make a slow computer or editor tab pause.

## Privacy

The index can contain unpublished, draft, password-protected, or other private content returned by the signed-in Squarespace session.

The project does not send the whole index to GitHub, jsDelivr, Cloudflare, or a project database. When you call a WebMCP tool, its result is given to the agent so it can answer your question.

This project does not encrypt its IndexedDB records. Other scripts running with the same Squarespace editor origin can access the same browser storage. Install only code you trust.

The Footer Code Injection script also downloads on public site pages. It registers tools only on the signed-in `/config` editor page, but public visitors still request the small script file.

## Remove the project

Delete the script tag from Footer Code Injection.

To also remove the local index, open the browser's site-data controls and delete the `squarespace-webmcp-index` IndexedDB database for the Squarespace origin.
