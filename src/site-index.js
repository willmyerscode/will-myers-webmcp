import {
  allSiteRecords,
  loadSite,
  replaceSiteRecords,
  replaceUrlRecords,
} from "./browser-index-storage.js";
import {
  folderRecord,
  itemRecord,
  pageInfoFromHtml,
  pageRecord,
  resultFromRecord,
  structureRecords,
} from "./site-records.js";
import {
  discoverUrls,
  fetchHtml,
  fetchJson,
  getRateLimitPolicy,
  getRequestStats,
  jsonUrl,
  normalizePath,
  resetRequestStats,
  siteOrigin,
} from "./squarespace-source.js";

async function previousIndex(browser, origin, siteId) {
  try {
    const site = await loadSite(browser, origin);
    return site.siteId === siteId ? allSiteRecords(browser, siteId) : [];
  } catch {
    return [];
  }
}

function recordsBySource(records) {
  const grouped = new Map();
  for (const record of records) {
    const sources = record.sourceVersions
      ? Object.keys(record.sourceVersions)
      : [record.sourceUrl || record.url];
    for (const sourceUrl of sources) {
      if (!grouped.has(sourceUrl)) grouped.set(sourceUrl, []);
      grouped.get(sourceUrl).push(record);
    }
  }
  return grouped;
}

function keepRecord(records, record) {
  const current = records.get(record.recordId);
  if (current) {
    record.sourceVersions = {
      ...(current.sourceVersions || {}),
      ...(record.sourceVersions || {}),
    };
  }
  records.set(record.recordId, record);
}

function recordFromSource(record, sourceUrl) {
  const sourceVersion = record.sourceVersions
    ? record.sourceVersions[sourceUrl]
    : record.sourceUrl === sourceUrl
      ? record.sourceVersion
      : null;
  return { ...record, sourceVersions: { [sourceUrl]: sourceVersion } };
}

function recordCounts(records) {
  return {
    pages: records.filter((record) => record.kind === "page").length,
    collectionItems: records.filter((record) => record.kind === "item").length,
    folders: records.filter((record) => record.kind === "folder").length,
    sections: records.filter((record) => record.kind === "section").length,
    blocks: records.filter((record) => record.kind === "block").length,
    textRecords: records.filter((record) => record.content?.trim()).length,
    uniqueUrls: new Set(records.map((record) => record.url)).size,
    metadataRecords: records.filter(
      (record) => record.metadata && Object.keys(record.metadata).length > 0,
    ).length,
    totalRecords: records.length,
  };
}

async function fullCollectionItems(
  browser,
  origin,
  siteId,
  items,
  records,
  errors,
  previousRecords,
) {
  let complete = true;
  for (const item of items) {
    if (!item.fullUrl) continue;
    try {
      const detail = await fetchJson(browser, jsonUrl(item.fullUrl, origin));
      if (!detail.item) {
        throw new Error(`Squarespace did not return full item data for ${item.fullUrl}.`);
      }
      const record = itemRecord(browser, siteId, detail.collection, detail.item);
      const currentIndex = records.findIndex(
        (candidate) => candidate.recordId === record.recordId,
      );
      if (currentIndex >= 0) records[currentIndex] = record;
      else records.push(record);
    } catch (error) {
      complete = false;
      errors.push({ url: item.fullUrl, message: error.message });
      const previous = previousRecords.find(
        (record) => record.recordId === `${siteId}:item:${item.id}`,
      );
      if (previous) {
        const currentIndex = records.findIndex(
          (candidate) => candidate.recordId === previous.recordId,
        );
        if (currentIndex >= 0) records[currentIndex] = previous;
        else records.push(previous);
      }
    }
  }
  return complete;
}

async function primaryRecords(browser, origin, siteId, url, data, includePage) {
  if (data.item) {
    return [itemRecord(browser, siteId, data.collection, data.item)];
  }
  if (!includePage || !data.collection) return [];

  const records = [pageRecord(siteId, data.collection, url)];
  if (data.collection.typeName === "page") {
    const html = await fetchHtml(browser, new URL(url, origin));
    records.push(...structureRecords(browser, siteId, data.collection, url, html));
  }
  return records;
}

async function renderedPageRecords(browser, origin, siteId, entry) {
  if (entry.collection && entry.collection.typeName !== "page") {
    throw new Error(
      `Squarespace did not return JSON for the ${entry.collection.typeName || "unknown"} collection ${entry.url}.`,
    );
  }
  const html = await fetchHtml(browser, new URL(entry.url, origin));
  const pageInfo = pageInfoFromHtml(browser, html);
  if (!pageInfo.valid) {
    throw new Error(`Squarespace did not return valid Squarespace page HTML for ${entry.url}.`);
  }
  const collection = entry.collection || {
    id: entry.url,
    fullUrl: entry.url,
    typeName: "page",
    updatedOn: entry.updatedOn || null,
  };
  const titledCollection = {
    ...collection,
    title: collection.title || pageInfo.title || entry.url,
  };
  return [
    pageRecord(siteId, titledCollection, entry.url),
    ...structureRecords(browser, siteId, titledCollection, entry.url, html),
  ];
}

async function readDiscoveredUrl(
  browser,
  origin,
  siteId,
  entry,
  errors,
  knownItemUrls,
  previousRecords,
) {
  const records = [];
  const itemIds = new Set();
  const collectionItems = [];
  let next = jsonUrl(entry.url, origin);
  let firstPage = true;

  while (next) {
    let data;
    try {
      data = await fetchJson(browser, next);
    } catch (error) {
      if (firstPage && error.code === "HTML_RESPONSE") {
        if (knownItemUrls.has(entry.url)) throw error;
        records.push(...(await renderedPageRecords(browser, origin, siteId, entry)));
        break;
      }
      throw error;
    }
    records.push(
      ...(await primaryRecords(browser, origin, siteId, entry.url, data, firstPage)),
    );

    for (const item of data.items || []) {
      if (itemIds.has(item.id)) continue;
      itemIds.add(item.id);
      if (item.fullUrl) knownItemUrls.add(normalizePath(item.fullUrl, origin));
      records.push(itemRecord(browser, siteId, data.collection, item));
      if (data.items) collectionItems.push(item);
    }

    firstPage = false;
    next =
      data.pagination?.nextPage && data.pagination.nextPageUrl
        ? jsonUrl(data.pagination.nextPageUrl, origin)
        : null;
  }

  const complete = await fullCollectionItems(
    browser,
    origin,
    siteId,
    collectionItems,
    records,
    errors,
    previousRecords,
  );
  for (const record of records) {
    record.sourceVersions = {
      [entry.url]: complete ? (entry.updatedOn ?? record.updatedOn ?? null) : null,
    };
  }
  return records;
}

/** @param {any} browser @param {(progress: object) => void} [onProgress] */
export async function indexSite(browser, onProgress = () => {}) {
  const startedAt = Date.now();
  resetRequestStats(browser);
  const origin = siteOrigin(browser);
  const context = await fetchJson(browser, new URL("/api/context/website", origin));
  const siteId = context.website?.id;
  if (!siteId) throw new Error("Squarespace did not return a site ID.");

  const discovered = discoverUrls(context, origin);
  onProgress({ completed: 0, total: discovered.size, url: null });
  const previousRecords = await previousIndex(browser, origin, siteId);
  const knownItemUrls = new Set(
    previousRecords
      .filter((record) => record.kind === "item")
      .map((record) => normalizePath(record.url, origin)),
  );
  const previousBySource = recordsBySource(previousRecords);
  const nextRecords = new Map();
  const errors = [];
  let skipped = 0;
  let indexed = 0;
  let completed = 0;

  for (const entry of discovered.values()) {
    if (["folder", "folders"].includes(entry.collection?.typeName)) {
      const record = folderRecord(siteId, entry.collection, entry.url);
      record.sourceVersions = {
        [entry.url]: entry.updatedOn ?? record.updatedOn ?? null,
      };
      keepRecord(nextRecords, record);
    } else {
      const previous = previousBySource.get(entry.url) || [];
      const unchanged =
        entry.updatedOn !== null &&
        entry.updatedOn !== undefined &&
        previous.length > 0 &&
        previous.every((record) => {
          const version = record.sourceVersions
            ? record.sourceVersions[entry.url]
            : record.sourceUrl === entry.url
              ? record.sourceVersion
              : undefined;
          return version === entry.updatedOn;
        });

      if (unchanged) {
        for (const record of previous) {
          keepRecord(nextRecords, recordFromSource(record, entry.url));
        }
        skipped += 1;
      } else {
        try {
          const records = await readDiscoveredUrl(
            browser,
            origin,
            siteId,
            entry,
            errors,
            knownItemUrls,
            previous,
          );
          for (const record of records) keepRecord(nextRecords, record);
          indexed += 1;
        } catch (error) {
          errors.push({ url: entry.url, message: error.message });
          for (const record of previous) {
            keepRecord(nextRecords, recordFromSource(record, entry.url));
          }
        }
      }
    }
    completed += 1;
    onProgress({ completed, total: discovered.size, url: entry.url });
  }

  const records = [...nextRecords.values()];
  const nextIds = new Set(records.map((record) => record.recordId));
  const removed = previousRecords.filter((record) => !nextIds.has(record.recordId)).length;

  await replaceSiteRecords(
    browser,
    { origin, siteId, title: context.website?.siteTitle || null, indexedAt: Date.now() },
    records,
  );
  const counts = recordCounts(records);

  return {
    siteId,
    discovered: discovered.size,
    records: counts.totalRecords,
    collectionItems: counts.collectionItems,
    folders: counts.folders,
    counts,
    indexed,
    skipped,
    removed,
    elapsedMs: Date.now() - startedAt,
    rateLimitPolicy: getRateLimitPolicy(),
    ...getRequestStats(browser),
    errors,
  };
}

function jobSnapshot(job) {
  return {
    status: job?.status || "idle",
    progress: job?.progress || { completed: 0, total: 0, url: null },
    ...(job?.result || {}),
    ...(job?.error ? { error: job.error } : {}),
  };
}

/** @param {any} browser @param {{action?: "start" | "status"}} input */
export async function runIndexSiteTool(browser, input) {
  const action = input?.action || "start";
  if (action === "status") return jobSnapshot(browser.__squarespaceSiteIndexJob);
  if (browser.__squarespaceSiteReadCount > 0) {
    throw new Error(
      "index_site is unavailable while read_site_record is running. Wait until the live read is complete.",
    );
  }

  const current = browser.__squarespaceSiteIndexJob;
  if (current?.status === "running") return jobSnapshot(current);

  const job = {
    status: "running",
    progress: { completed: 0, total: 0, url: null },
    result: null,
    error: null,
  };
  browser.__squarespaceSiteIndexJob = job;
  void indexSite(browser, (progress) => {
    job.progress = progress;
  }).then(
    (result) => {
      job.result = result;
      job.status = "complete";
    },
    (error) => {
      job.error = error?.message || String(error);
      job.status = "failed";
    },
  );
  return jobSnapshot(job);
}

/** @param {any} browser @param {{query?: string, limit?: number}} input */
export async function searchSite(browser, input) {
  const query = input?.query?.trim().toLocaleLowerCase();
  if (!query) throw new Error("A search query is required.");
  const origin = siteOrigin(browser);
  const site = await loadSite(browser, origin);
  const records = await allSiteRecords(browser, site.siteId);
  const terms = query.split(/\s+/).filter(Boolean);
  const matches = records.filter((record) =>
    terms.every((term) => record.searchText.includes(term)),
  );
  const limit = Math.min(Math.max(input?.limit || 50, 1), 200);
  return {
    siteId: site.siteId,
    query: input.query,
    total: matches.length,
    results: matches.slice(0, limit).map(resultFromRecord),
  };
}

/**
 * @param {any} browser
 * @param {{record_id?: string, url?: string, section_id?: string, block_id?: string}} input
 */
async function readSiteRecordUnlocked(browser, input) {
  const origin = siteOrigin(browser);
  const site = await loadSite(browser, origin);
  const cached = await allSiteRecords(browser, site.siteId);
  const requestedUrl = input?.url ? normalizePath(input.url, origin) : null;
  const target = input?.record_id
    ? cached.find((record) => record.recordId === input.record_id)
    : cached.find(
        (record) =>
          record.url === requestedUrl &&
          (!input?.section_id || record.sectionId === input.section_id) &&
          (!input?.block_id || record.blockId === input.block_id),
      );

  if (!target) {
    throw new Error("The requested site record is not in the browser index.");
  }

  let fresh;
  try {
    const data = await fetchJson(browser, jsonUrl(target.url, origin));
    fresh = await primaryRecords(
      browser,
      origin,
      site.siteId,
      target.url,
      data,
      true,
    );
  } catch (error) {
    if (error.status === 404) {
      await replaceUrlRecords(browser, site.siteId, target.url, []);
      return { found: false, refreshed: true, removed: true, record: null };
    }
    if (error.code !== "HTML_RESPONSE") throw error;
    if (target.kind === "item") throw error;
    const page = cached.find(
      (record) => record.url === target.url && record.kind === "page",
    );
    if (!page || page.raw?.typeName !== "page") throw error;
    fresh = await renderedPageRecords(browser, origin, site.siteId, {
      url: target.url,
      updatedOn: page?.updatedOn || target.updatedOn,
      collection: page?.raw || null,
    });
  }

  if (fresh.length === 0) {
    throw new Error("Squarespace did not return valid page or item data.");
  }
  for (const record of fresh) {
    record.sourceVersions = target.sourceVersions || {
      [target.sourceUrl || target.url]: target.sourceVersion ?? null,
    };
  }

  await replaceUrlRecords(browser, site.siteId, target.url, fresh);
  const record = fresh.find(
    (candidate) =>
      candidate.recordId === target.recordId ||
      (candidate.url === target.url &&
        candidate.sectionId === target.sectionId &&
        candidate.blockId === target.blockId &&
        candidate.kind === target.kind),
  );

  return {
    found: Boolean(record),
    refreshed: true,
    removed: !record,
    record: record || null,
  };
}

export async function readSiteRecord(browser, input) {
  if (browser.__squarespaceSiteIndexJob?.status === "running") {
    throw new Error(
      "read_site_record is unavailable while index_site is running. Wait until indexing is complete.",
    );
  }

  browser.__squarespaceSiteReadCount = (browser.__squarespaceSiteReadCount || 0) + 1;
  try {
    return await readSiteRecordUnlocked(browser, input);
  } finally {
    browser.__squarespaceSiteReadCount -= 1;
  }
}
