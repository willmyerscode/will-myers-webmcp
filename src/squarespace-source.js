const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RATE_LIMIT_DELAY_MS = 1_000;
const MAX_RATE_LIMIT_DELAY_MS = 30_000;

function fallbackDelayMs(retryNumber) {
  return Math.min(
    DEFAULT_RATE_LIMIT_DELAY_MS * 2 ** retryNumber,
    MAX_RATE_LIMIT_DELAY_MS,
  );
}

export function getRateLimitPolicy() {
  return {
    normalDelayMs: 0,
    maxRetries: MAX_RATE_LIMIT_RETRIES,
    fallbackDelaysMs: Array.from(
      { length: MAX_RATE_LIMIT_RETRIES },
      (_, retryNumber) => fallbackDelayMs(retryNumber),
    ),
    maxFallbackDelayMs: MAX_RATE_LIMIT_DELAY_MS,
    honorsRetryAfter: true,
  };
}

function requestState(browser) {
  if (!browser.__squarespaceRequestState) {
    browser.__squarespaceRequestState = {
      requests: 0,
      rateLimits: 0,
      retries: 0,
      cooldownMs: 0,
      cooldownUntil: 0,
    };
  }
  return browser.__squarespaceRequestState;
}

export function resetRequestStats(browser) {
  browser.__squarespaceRequestState = null;
  return requestState(browser);
}

export function getRequestStats(browser) {
  const state = requestState(browser);
  return {
    requests: state.requests,
    rateLimits: state.rateLimits,
    retries: state.retries,
    cooldownMs: state.cooldownMs,
  };
}

function retryDelay(response, retryNumber) {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1_000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return fallbackDelayMs(retryNumber);
}

async function waitForCooldown(browser) {
  const remaining = requestState(browser).cooldownUntil - Date.now();
  if (remaining <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, remaining));
}

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
  const state = requestState(browser);
  let retryNumber = 0;

  while (true) {
    await waitForCooldown(browser);
    const response = await browser.fetch(String(value), {
      method: "GET",
      credentials: "same-origin",
      headers: { accept },
    });
    state.requests += 1;

    if (response.status === 429) {
      state.rateLimits += 1;
      if (retryNumber < MAX_RATE_LIMIT_RETRIES) {
        const delay = retryDelay(response, retryNumber);
        retryNumber += 1;
        state.retries += 1;
        state.cooldownMs += delay;
        state.cooldownUntil = Math.max(state.cooldownUntil, Date.now() + delay);
        continue;
      }
    }

    if (!response.ok) {
      const error = new Error(`Squarespace returned ${response.status} for ${value}.`);
      // @ts-ignore
      error.status = response.status;
      throw error;
    }
    return response;
  }
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

export function discoverUrls(context, origin) {
  const discovered = new Map();
  for (const entry of layoutEntries(context.siteLayout, origin)) {
    discovered.set(entry.url, entry);
  }
  return discovered;
}
