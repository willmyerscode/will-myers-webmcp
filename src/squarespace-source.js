export function siteOrigin(browser) {
  return new URL(browser.location?.href || "about:blank").origin;
}

export function normalizePath(value, origin) {
  const url = new URL(value || "/", origin);
  return `${url.pathname}${url.search}`;
}

export function jsonUrl(value, origin) {
  const url = new URL(value, origin);
  url.searchParams.set("format", "json");
  return url;
}

async function fetchSource(browser, value, accept) {
  const response = await browser.fetch(String(value), {
    method: "GET",
    credentials: "same-origin",
    headers: { accept },
  });
  if (!response.ok) {
    const error = new Error(`Squarespace returned ${response.status} for ${value}.`);
    // @ts-ignore
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function fetchJson(browser, value) {
  const response = await fetchSource(browser, value, "application/json");
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    const html = response.headers.get("content-type")?.toLowerCase().includes("text/html");
    const error = new Error(
      html
        ? `Squarespace returned HTML instead of JSON for ${value}.`
        : `Squarespace did not return valid JSON for ${value}.`,
    );
    // @ts-ignore
    error.code = html ? "HTML_RESPONSE" : "INVALID_JSON";
    throw error;
  }
}

export async function fetchHtml(browser, value) {
  return (await fetchSource(browser, value, "text/html")).text();
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function sitemapEntries(xml, origin) {
  const entries = [];
  const urls = xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi);
  for (const match of urls) {
    const body = match[1];
    const location = body.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i)?.[1]?.trim();
    if (!location) continue;
    const lastModified = body.match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim();
    entries.push({
      url: normalizePath(decodeXml(location), origin),
      updatedOn: lastModified || null,
    });
  }
  return entries;
}

function layoutEntries(layout, origin) {
  const entries = [];

  function walk(links) {
    for (const link of links || []) {
      const value = link.fullUrl || (link.urlId ? `/${link.urlId}` : null);
      if (value && !link.externalLink) {
        const url = normalizePath(value, origin);
        entries.push({
          url,
          updatedOn: link.updatedOn || null,
          collection: {
            ...link,
            id: link.collectionId || link.id || url,
            fullUrl: url,
          },
        });
      }
      walk(link.children);
    }
  }

  for (const area of layout || []) walk(area.links);
  return entries;
}

export function discoverUrls(context, sitemapXml, origin) {
  const discovered = new Map();
  for (const entry of [
    ...layoutEntries(context.siteLayout, origin),
    ...sitemapEntries(sitemapXml, origin),
  ]) {
    const current = discovered.get(entry.url);
    discovered.set(entry.url, current ? { ...entry, ...current } : entry);
  }
  return discovered;
}
