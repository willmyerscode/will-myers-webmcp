# Tool contracts

## `index_site`

Purpose: build or refresh the private browser index for the current Squarespace site.

Input:

- `action`: `start` begins a background crawl. `status` reports its progress and final result.

It reads the signed-in Squarespace site map, public sitemap, structured page JSON, collection pagination, collection item JSON, and rendered normal-page HTML. It stores page, item, section, and block records in IndexedDB.

Every response includes `status` and progress counts. A complete result also includes the site ID, discovered URL count, stored record count, collection item count, fetched count, unchanged count, ignored navigation-folder count, removed count, and page errors.

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

## Safety

All tool requests use HTTP GET. The tools do not send site content to the Cloudflare host. They do not change pages, code, styles, settings, or metadata.
