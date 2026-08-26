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

function words(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function licenseFor(title) {
  return /multi[ -]?use|business license|template license/i.test(title)
    ? "multi-use"
    : "single-site";
}

export function normalizeCatalog(response, siteOrigin) {
  if (!response || !Array.isArray(response.items)) {
    throw new Error("The public product catalog did not contain an item list.");
  }

  return response.items
    .filter((item) => item && item.id && item.title && item.fullUrl)
    .map((item) => ({
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
      license: licenseFor(String(item.title)),
      searchText: [item.title, htmlToText(item.excerpt || ""), ...(item.tags || [])]
        .join(" ")
        .toLocaleLowerCase("en-US"),
    }));
}

export function searchProducts(products, query, maxResults = 5) {
  const queryWords = words(String(query || ""));
  if (queryWords.length === 0) return [];

  const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10);
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
      const titlePhrase = words(product.title).join(" ");
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
  const query = String(input?.query || "").trim();
  if (!query) throw new Error("A product search query is required.");
  if (query.length > 200) throw new Error("The product search query is too long.");

  const maxResults = Math.min(Math.max(Number(input?.max_results) || 5, 1), 10);
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
