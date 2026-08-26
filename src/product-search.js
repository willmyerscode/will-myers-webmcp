import { LIMITS } from "./contracts.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function htmlToText(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchText(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function normalizeCatalog(response, siteOrigin) {
  if (!response || !Array.isArray(response.items)) {
    throw new Error("The public product catalog did not contain an item list.");
  }
  if (response.items.length === 0) {
    throw new Error("The public product catalog did not contain any items.");
  }

  const changedItemIndex = response.items.findIndex(
    (item) => !item || !item.id || !item.title || !item.fullUrl,
  );
  if (changedItemIndex >= 0) {
    throw new Error(
      `Product item ${changedItemIndex + 1} is missing required public fields.`,
    );
  }

  return response.items.map((item) => ({
      id: String(item.id),
      title: String(item.title).trim(),
      summary: htmlToText(item.excerpt || ""),
      price:
        item.priceMoney?.currency && item.priceMoney?.value
          ? {
              currency: String(item.priceMoney.currency),
              value: String(item.priceMoney.value),
            }
          : null,
      onSale: Boolean(item.onSale),
      url: new URL(String(item.fullUrl), siteOrigin).href,
      searchText: [item.title, htmlToText(item.excerpt || ""), ...(item.tags || [])]
        .join(" ")
        .toLocaleLowerCase("en-US"),
    }));
}

export function searchProducts(products, query, maxResults = 5) {
  const queryWords = tokenizeSearchText(String(query || ""));
  if (queryWords.length === 0) return [];

  const limit = validateMaxResults(maxResults);
  const queryPhrase = queryWords.join(" ");
  const wordWeights = new Map(
    queryWords.map((word) => {
      const documentFrequency = products.filter((product) =>
        product.searchText.includes(word),
      ).length;
      const inverseFrequency =
        1 + Math.log2((products.length + 1) / (documentFrequency + 1));
      return [word, inverseFrequency ** 2];
    }),
  );

  return products
    .map((product, index) => {
      const title = product.title.toLocaleLowerCase("en-US");
      const titlePhrase = tokenizeSearchText(product.title).join(" ");
      const wordScore = queryWords.reduce((total, word) => {
        const weight = wordWeights.get(word) || 1;
        if (title === word) return total + 12 * weight;
        if (title.includes(word)) return total + 6 * weight;
        if (product.searchText.includes(word)) return total + 2 * weight;
        return total;
      }, 0);
      const score = wordScore + (titlePhrase.includes(queryPhrase) ? 50 : 0);

      return { product, score, index };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ product: { searchText: _, ...result } }) => result);
}

function validateMaxResults(value) {
  if (
    !Number.isInteger(value) ||
    value < LIMITS.maxResultsMin ||
    value > LIMITS.maxResultsMax
  ) {
    throw new Error(
      `max_results must be an integer from ${LIMITS.maxResultsMin} through ${LIMITS.maxResultsMax}.`,
    );
  }
  return value;
}

/**
 * @param {{ query?: unknown, max_results?: unknown }} input
 * @param {{
 *   fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
 *   signal?: AbortSignal,
 *   siteOrigin?: string
 * }} options
 */
export async function findProducts(
  input,
  { fetch: fetchCatalog = fetch, signal, siteOrigin = "https://www.will-myers.com" } = {},
) {
  if (input?.query === undefined || input?.query === null) {
    throw new Error("A product search query is required.");
  }
  if (typeof input.query !== "string") {
    throw new Error("The product search query must be text.");
  }

  const query = input.query.trim();
  if (!query) throw new Error("A product search query is required.");
  if (query.length > LIMITS.productQuery) {
    throw new Error(`The product search query must be ${LIMITS.productQuery} characters or fewer.`);
  }

  const maxResults = validateMaxResults(input?.max_results ?? 5);
  const catalogUrl = new URL("/products?format=json", siteOrigin);
  const response = await fetchCatalog(catalogUrl.href, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`The public product catalog returned HTTP ${response.status || "error"}.`);
  }

  const products = normalizeCatalog(await response.json(), siteOrigin);
  const matches = searchProducts(products, query, maxResults);

  return {
    query,
    count: matches.length,
    products: matches,
    note:
      matches.length > 0
        ? "Open a product URL to review its current details before purchase."
        : "No close match was found. Try the product name, page feature, or design goal.",
  };
}
