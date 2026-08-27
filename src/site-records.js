function primitiveText(value) {
  if (value === null || value === undefined) return [];
  if (["string", "number", "boolean"].includes(typeof value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap(primitiveText);
  if (typeof value === "object") return Object.values(value).flatMap(primitiveText);
  return [];
}

function searchableText(record) {
  const values =
    record.kind === "section"
      ? [record.kind, record.sectionId]
      : record.kind === "block"
        ? [record.kind, record.blockId, record.blockType, record.content]
        : [
            record.title,
            record.url,
            record.kind,
            record.content,
            ...primitiveText(record.metadata),
          ];
  return values.filter(Boolean).join("\n").toLocaleLowerCase();
}

function createRecord(fields) {
  const record = {
    sectionId: null,
    blockId: null,
    blockType: null,
    updatedOn: null,
    content: "",
    metadata: {},
    raw: null,
    ...fields,
  };
  record.searchText = searchableText(record);
  return record;
}

function textFromUnknown(value) {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").trim();
  if (!value || typeof value !== "object") return "";
  return Object.values(value).filter((part) => typeof part === "string").join(" ");
}

function textFromHtml(browser, html) {
  if (!html || typeof html !== "string") return "";
  if (!browser.DOMParser) return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const document = new browser.DOMParser().parseFromString(
    `<html><body>${html}</body></html>`,
    "text/html",
  );
  document.querySelectorAll?.("script,style,noscript").forEach((node) => node.remove());
  return (document.body?.textContent || "").replace(/\s+/g, " ").trim();
}

export function pageInfoFromHtml(browser, html) {
  if (!browser.DOMParser || !html || typeof html !== "string") {
    return { valid: false, title: null };
  }
  const document = new browser.DOMParser().parseFromString(html, "text/html");
  const title =
    document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
    document.querySelector("title")?.textContent?.trim() ||
    null;
  return { valid: Boolean(document.querySelector("#page")), title };
}

export function pageRecord(siteId, collection, fallbackUrl) {
  const pageId = collection?.id || fallbackUrl;
  return createRecord({
    recordId: `${siteId}:page:${pageId}`,
    siteId,
    kind: "page",
    url: collection?.fullUrl || fallbackUrl,
    title: collection?.title || fallbackUrl,
    pageId,
    updatedOn: collection?.updatedOn || null,
    metadata: {
      typeName: collection?.typeName || null,
      description: textFromUnknown(collection?.description),
      enabled: collection?.enabled,
      draft: collection?.draft,
      passwordProtected: collection?.passwordProtected,
      seoData: collection?.seoData || null,
    },
    raw: collection || null,
  });
}

export function itemRecord(browser, siteId, collection, item) {
  return createRecord({
    recordId: `${siteId}:item:${item.id}`,
    siteId,
    kind: "item",
    url: item.fullUrl || `/${item.urlId || item.id}`,
    title: item.title || item.urlId || item.id,
    pageId: item.collectionId || collection?.id || null,
    updatedOn: item.updatedOn || null,
    content: textFromHtml(browser, item.body || item.excerpt || ""),
    metadata: {
      typeName: collection?.typeName || item.recordTypeLabel || null,
      tags: item.tags || [],
      categories: item.categories || [],
      excerpt: textFromHtml(browser, item.excerpt || ""),
    },
    raw: item,
  });
}

function blockType(element) {
  if (element.dataset?.blockType) return element.dataset.blockType;
  for (const name of element.classList || []) {
    const match = name.match(/^sqs-block-(?!content$)([a-z0-9-]+)$/i);
    if (match) return match[1];
  }
  return null;
}

export function structureRecords(browser, siteId, collection, fallbackUrl, html) {
  if (!browser.DOMParser) return [];
  const document = new browser.DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll?.("script,style,noscript").forEach((node) => node.remove());
  const root = document.querySelector("#page") || document.body;
  if (!root) return [];

  const url = collection?.fullUrl || fallbackUrl;
  const pageId = collection?.id || fallbackUrl;
  const title = collection?.title || fallbackUrl;
  const updatedOn = collection?.updatedOn || null;
  const records = [];

  for (const section of root.querySelectorAll("[data-section-id]")) {
    const sectionId = section.dataset?.sectionId;
    if (!sectionId) continue;
    records.push(
      createRecord({
        recordId: `${siteId}:section:${pageId}:${sectionId}`,
        siteId,
        kind: "section",
        url,
        title,
        pageId,
        sectionId,
        updatedOn,
        raw: { html: section.outerHTML },
      }),
    );

    for (const block of section.querySelectorAll(".sqs-block[id], [data-block-id]")) {
      const blockId = block.id || block.dataset?.blockId;
      if (!blockId) continue;
      records.push(
        createRecord({
          recordId: `${siteId}:block:${blockId}`,
          siteId,
          kind: "block",
          url,
          title,
          pageId,
          sectionId,
          blockId,
          blockType: blockType(block),
          updatedOn,
          content: (block.textContent || "").replace(/\s+/g, " ").trim(),
          raw: { html: block.outerHTML },
        }),
      );
    }
  }

  return records;
}

export function resultFromRecord(record) {
  return {
    recordId: record.recordId,
    kind: record.kind,
    url: record.url,
    title: record.title,
    pageId: record.pageId,
    sectionId: record.sectionId,
    blockId: record.blockId,
    blockType: record.blockType,
    updatedOn: record.updatedOn,
    snippet: record.content || record.title || record.url,
  };
}
