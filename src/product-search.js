import { LIMITS } from "./contracts.js";
import { htmlToText } from "./text.js";

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

function tokenizeSearchText(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function normalizeCatalog(response, siteOrigin) {
  if (!response || !Array.isArray(response.products)) {
    throw new Error("The product service did not contain a product list.");
  }
  if (response.products.length === 0) {
    throw new Error("The product service did not contain any products.");
  }

  const changedItemIndex = response.products.findIndex(
    (item) => !item || !item.id || !item.title || !item.url,
  );
  if (changedItemIndex >= 0) {
    throw new Error(
      `Product item ${changedItemIndex + 1} is missing required public fields.`,
    );
  }

  return response.products.map((item) => ({
      id: String(item.id),
      title: String(item.title).trim(),
      summary: htmlToText(item.summary || ""),
      price:
        item.price?.currency && item.price?.value !== undefined
          ? {
              currency: String(item.price.currency),
              value: String(item.price.value),
            }
          : null,
      onSale: Boolean(item.onSale),
      url: new URL(String(item.url), siteOrigin).href,
      searchText: [item.title, htmlToText(item.summary || ""), ...(item.tags || [])]
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
 *   siteOrigin?: string,
 *   apiUrl?: string
 * }} options
 */
export async function findProducts(
  input,
  {
    fetch: fetchCatalog = fetch,
    signal,
    siteOrigin = "https://www.will-myers.com",
    apiUrl = "https://will-myers-webmcp.otis.solutions/api/products",
  } = {},
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
  const response = await fetchCatalog(apiUrl, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`The product service returned HTTP ${response.status || "error"}.`);
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
