const SQUARESPACE_PRODUCTS_URL = "https://api.squarespace.com/v2/commerce/products";
const USER_AGENT = "Will Myers WebMCP (https://will-myers-webmcp.otis.solutions)";
const ALLOWED_ORIGINS = new Set([
  "https://www.will-myers.com",
  "https://will-myers.com",
]);
const MAX_PAGES = 25;

function htmlToText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPricing(product) {
  return product.pricing || product.variants?.[0]?.pricing || null;
}

function normalizePrice(pricing) {
  if (!pricing) return null;
  const money = pricing.onSale && pricing.salePrice
    ? pricing.salePrice
    : pricing.basePrice;
  const currency = money?.currency?.currencyCode;
  if (!currency || money?.value === undefined || money?.value === null) return null;
  return { currency: String(currency), value: String(money.value) };
}

function isPublicWillMyersUrl(value) {
  try {
    const url = new URL(String(value));
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.will-myers.com" || url.hostname === "will-myers.com")
    );
  } catch {
    return false;
  }
}

/** @param {any} product */
export function normalizeSquarespaceProduct(product) {
  if (
    !product ||
    !product.id ||
    !product.name ||
    product.isVisible !== true ||
    !isPublicWillMyersUrl(product.url)
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
    url: String(product.url),
    tags: Array.isArray(product.tags) ? product.tags.map(String) : [],
  };
}

async function readSquarespaceProducts(apiKey, fetchSquarespace) {
  const products = [];
  let cursor = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(SQUARESPACE_PRODUCTS_URL);
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetchSquarespace(url.href, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": USER_AGENT,
      },
    });
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
 * @param {{ SQUARESPACE_API_KEY?: string }} env
 * @param {typeof fetch} fetchSquarespace
 */
export async function handleRequest(request, env, fetchSquarespace = fetch) {
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

  try {
    const sourceProducts = await readSquarespaceProducts(
      env.SQUARESPACE_API_KEY,
      fetchSquarespace,
    );
    const products = sourceProducts
      .map(normalizeSquarespaceProduct)
      .filter(Boolean);
    return json(request, { products }, 200, true);
  } catch (error) {
    console.error("The Squarespace product request failed.", error);
    return json(request, { error: "The product service is temporarily unavailable." }, 502);
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return handleRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
