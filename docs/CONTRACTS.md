# Tool contracts

## `index_site`

Purpose: build or refresh the private browser index for the current Squarespace site.

Input:

- `action`: `start` begins a background crawl. `status` reports its progress and final result.

It reads the signed-in Squarespace page map, structured page JSON, collection pagination, collection item JSON, and rendered normal-page HTML. It does not read the public sitemap. It stores page, item, folder, section, and block records in IndexedDB. Folder URLs are not fetched.

Every response includes `status` and progress counts. A complete result also includes the site ID, discovered route count, stored record count, detailed record counts, fetched count, unchanged count, removed count, request count, `429` count, retry count, total cooldown time, total run time, retry settings, and errors.

Normal requests have no added delay. A `429` response uses `Retry-After`. Without that header, delays are 1, 2, 4, 8, then 16 seconds. The tool makes at most five retries. Each fallback delay is limited to 30 seconds.

## `find_site`

Purpose: search the saved browser index.

Inputs:

- `query`: required search text.
- `limit`: optional result limit from 1 to 200. The default is 50.

It searches page titles, URLs, content, SEO metadata, item tags and categories, block IDs, and block types. Each result includes a record ID, URL, title, kind, page ID, section ID, block ID, block type, update value, and text sample.

## `read_site`

Purpose: get fresh Squarespace data for one indexed record and update its browser copy.

Inputs:

- `record_id`: an ID returned by `find_site`; or
- `url`: an indexed site URL, with optional `section_id` or `block_id`.

The result says whether the record still exists and returns its current content, metadata, raw source data, and exact location. A 404 response removes the old records for that URL. Other read errors keep the last valid records. An index job and a live read cannot run at the same time. This prevents one job from replacing the other job's data.

## `read_site_custom_css`

Purpose: return the current Custom CSS text.

Input: none.

The result contains the source path and the raw CSS text. The tool does not need the site index. It does not parse, analyze, or change the CSS.

## `read_site_code_injection`

Purpose: return the current site-wide Code Injection settings.

Input: none.

The result contains the source path and the raw fields that Squarespace returns. These fields currently include the header, footer, lock page, order confirmation page, order status page, blog post item, and order-status migration value. The tool does not need the site index. It does not parse, analyze, or change the code.

## Safety

All tool requests use HTTP GET. The tools do not send site content to the Cloudflare host. They do not change pages, code, styles, settings, or metadata.
