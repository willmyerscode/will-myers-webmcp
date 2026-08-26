import { htmlToText } from "./text.js";

const SQUARESPACE_PRODUCTS_URL = "https://api.squarespace.com/v2/commerce/products";
const USER_AGENT = "Will Myers WebMCP (https://will-myers-webmcp.otis.solutions)";
const ALLOWED_ORIGINS = new Set([
  "https://www.will-myers.com",
  "https://will-myers.com",
]);
const MAX_PAGES = 25;
const SITE_ORIGIN = "https://www.will-myers.com";
const CACHE_KEY = new Request("https://will-myers-webmcp.internal/products-v1");
const CACHE_FRESH_MS = 5 * 60 * 1000;
const CACHE_RETENTION_SECONDS = 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 8_000;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

function getPricing(product) {
  return product.pricing || product.variants?.[0]?.pricing || null;
}

function normalizePrice(pricing) {
  if (!pricing) return null;
  const money = pricing.onSale && pricing.salePrice
    ? pricing.salePrice
    : pricing.basePrice;
  const currency =
    typeof money?.currency === "string"
      ? money.currency
      : money?.currency?.currencyCode;
  if (!currency || money?.value === undefined || money?.value === null) return null;
  return { currency: String(currency), value: String(money.value) };
}

function publicWillMyersUrl(value) {
  try {
    const url = new URL(String(value), SITE_ORIGIN);
    const isPublic =
      url.protocol === "https:" &&
      (url.hostname === "www.will-myers.com" || url.hostname === "will-myers.com");
    return isPublic ? url.href : null;
  } catch {
    return null;
  }
}

/** @param {any} product */
export function normalizeSquarespaceProduct(product) {
  const publicUrl = publicWillMyersUrl(product?.url);
  if (
    !product ||
    !product.id ||
    !product.name ||
    product.isVisible !== true ||
    !publicUrl
  ) {
    return null;
  }

  const pricing = getPricing(product);
  return {
    id: String(product.id),
    title: String(product.name).trim(),
    summary: htmlToText(product.description || product.seoOptions?.description || ""),
    price: normalizePrice(pricing),
    onSale: Boolean(pricing?.onSale),
    url: publicUrl,
    tags: Array.isArray(product.tags) ? product.tags.map(String) : [],
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, 1_000);
  }
  return 250 * (attempt + 1);
}

async function fetchSquarespacePage(url, init, fetchSquarespace, wait) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetchSquarespace(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (attempt === 1) throw error;
      await wait(250 * (attempt + 1));
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (!TRANSIENT_STATUSES.has(response.status) || attempt === 1) return response;
    await wait(retryDelay(response, attempt));
  }
  throw new Error("Squarespace did not return a response.");
}

async function readSquarespaceProducts(apiKey, fetchSquarespace, wait) {
  const products = [];
  let cursor = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(SQUARESPACE_PRODUCTS_URL);
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetchSquarespacePage(url.href, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": USER_AGENT,
      },
    }, fetchSquarespace, wait);
    if (!response.ok) {
      throw new Error(`Squarespace returned HTTP ${response.status || "error"}.`);
    }

    const body = await response.json();
    if (!Array.isArray(body?.products)) {
      throw new Error("Squarespace did not return a product list.");
    }
    products.push(...body.products);

    if (!body.pagination?.hasNextPage) return products;
    if (!body.pagination.nextPageCursor) {
      throw new Error("Squarespace did not return the next page cursor.");
    }
    cursor = String(body.pagination.nextPageCursor);
  }

  throw new Error("Squarespace returned too many product pages.");
}

async function readCache(cache) {
  if (!cache) return null;
  try {
    const response = await cache.match(CACHE_KEY);
    if (!response) return null;
    const record = await response.json();
    if (!Number.isFinite(record?.cachedAt) || !Array.isArray(record?.products)) {
      return null;
    }
    return record;
  } catch (error) {
    console.warn("The product cache could not be read.", error);
    return null;
  }
}

async function writeCache(cache, record) {
  if (!cache) return;
  try {
    await cache.put(
      CACHE_KEY,
      Response.json(record, {
        headers: { "Cache-Control": `public, max-age=${CACHE_RETENTION_SECONDS}` },
      }),
    );
  } catch (error) {
    console.warn("The product cache could not be written.", error);
  }
}

function responseHeaders(request, cache = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  if (cache) headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  return headers;
}

function json(request, body, status, cache = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, cache),
  });
}

/**
 * @param {Request} request
 * @param {{
 *   SQUARESPACE_API_KEY?: string,
 *   PRODUCT_REFRESH_LIMITER?: { limit: (options: { key: string }) => Promise<{ success: boolean }> }
 * }} env
 * @param {typeof fetch} fetchSquarespace
 * @param {{
 *   cache?: { match: (key: Request) => Promise<Response | undefined>, put: (key: Request, response: Response) => Promise<void> } | null,
 *   now?: () => number,
 *   sleep?: (milliseconds: number) => Promise<void>
 * }} options
 */
export async function handleRequest(
  request,
  env,
  fetchSquarespace = fetch,
  { cache = null, now = Date.now, sleep: wait = sleep } = {},
) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/products") {
    return json(request, { error: "Not found." }, 404);
  }

  if (request.method === "OPTIONS") {
    const headers = responseHeaders(request);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Accept");
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET") {
    return json(request, { error: "Method not allowed." }, 405);
  }
  if (!env.SQUARESPACE_API_KEY) {
    return json(request, { error: "Product search is not configured yet." }, 503);
  }

  const cached = await readCache(cache);
  if (cached && now() - cached.cachedAt < CACHE_FRESH_MS) {
    return json(request, { products: cached.products }, 200, true);
  }

  if (env.PRODUCT_REFRESH_LIMITER) {
    const limit = await env.PRODUCT_REFRESH_LIMITER.limit({ key: "products" });
    if (!limit.success) {
      if (cached) return json(request, { products: cached.products }, 200, true);
      const response = json(request, { error: "Product data is refreshing. Try again soon." }, 429);
      response.headers.set("Retry-After", "60");
      return response;
    }
  }

  try {
    const sourceProducts = await readSquarespaceProducts(
      env.SQUARESPACE_API_KEY,
      fetchSquarespace,
      wait,
    );
    const products = sourceProducts
      .map(normalizeSquarespaceProduct)
      .filter(Boolean);
    await writeCache(cache, { cachedAt: now(), products });
    return json(request, { products }, 200, true);
  } catch (error) {
    console.error("The Squarespace product request failed.", error);
    if (cached) return json(request, { products: cached.products }, 200, true);
    return json(request, { error: "The product service is temporarily unavailable." }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      const cache =
        typeof caches === "undefined"
          ? null
          : /** @type {any} */ (caches).default;
      return handleRequest(request, env, fetch, { cache });
    }
    return env.ASSETS.fetch(request);
  },
};
