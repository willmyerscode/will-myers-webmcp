import assert from "node:assert/strict";
import test from "node:test";

import {
  handleRequest,
  normalizeSquarespaceProduct,
} from "../src/worker.js";

const endpoint = "https://will-myers-webmcp.otis.solutions/api/products";

class MemoryCache {
  response = null;

  async match() {
    return this.response?.clone() || undefined;
  }

  async put(_key, response) {
    this.response = response.clone();
  }
}

test("the product API stays unavailable until its Squarespace key exists", async () => {
  const response = await handleRequest(new Request(endpoint), {}, async () => {
    throw new Error("Squarespace must not be called");
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Product search is not configured yet.",
  });
});

test("the product API reads every Squarespace page and returns visible products", async () => {
  const requests = [];
  const responses = [
    {
      pagination: { hasNextPage: true, nextPageCursor: "page-two" },
      products: [
        {
          id: "visible",
          name: "Step Flow Timeline",
          description: "<p>Turn a list section into a timeline.</p>",
          isVisible: true,
          url: "/products/p/step-flow-timeline",
          tags: ["Plugin"],
          pricing: {
            basePrice: { currency: "USD", value: 25 },
            onSale: false,
          },
        },
        {
          id: "hidden",
          name: "Hidden draft",
          isVisible: false,
          url: "https://www.will-myers.com/products/p/hidden",
        },
      ],
    },
    {
      pagination: { hasNextPage: false },
      products: [
        {
          id: "sale",
          name: "Mega Menu",
          description: "Large navigation.",
          isVisible: true,
          url: "https://www.will-myers.com/products/p/mega-menu",
          variants: [
            {
              pricing: {
                basePrice: { currency: "USD", value: 30 },
                onSale: true,
                salePrice: { currency: "USD", value: 20 },
              },
            },
          ],
        },
      ],
    },
  ];

  const response = await handleRequest(
    new Request(endpoint, {
      headers: { Origin: "https://www.will-myers.com" },
    }),
    { SQUARESPACE_API_KEY: "private-test-key" },
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json(responses[requests.length - 1]);
    },
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://www.will-myers.com",
  );
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    "https://api.squarespace.com/v2/commerce/products",
  );
  assert.equal(
    requests[1].url,
    "https://api.squarespace.com/v2/commerce/products?cursor=page-two",
  );
  assert.equal(requests[0].init.headers.Authorization, "Bearer private-test-key");
  assert.match(requests[0].init.headers["User-Agent"], /Will Myers WebMCP/);

  const body = await response.json();
  assert.deepEqual(
    body.products.map(({ id }) => id),
    ["visible", "sale"],
  );
  assert.deepEqual(body.products[0].price, { currency: "USD", value: "25" });
  assert.equal(
    body.products[0].url,
    "https://www.will-myers.com/products/p/step-flow-timeline",
  );
  assert.deepEqual(body.products[1].price, { currency: "USD", value: "20" });
  assert.equal(body.products[1].onSale, true);
});

test("the product API does not send CORS access to another website", async () => {
  const response = await handleRequest(
    new Request(endpoint, { headers: { Origin: "https://example.com" } }),
    { SQUARESPACE_API_KEY: "private-test-key" },
    async () => Response.json({ pagination: { hasNextPage: false }, products: [] }),
  );

  assert.equal(response.headers.has("access-control-allow-origin"), false);
});

test("the product API uses its Cloudflare cache before Squarespace", async () => {
  const cache = new MemoryCache();
  let requests = 0;
  const fetchSquarespace = async () => {
    requests += 1;
    return Response.json({
      pagination: { hasNextPage: false },
      products: [
        {
          id: "menu",
          name: "Mega Menu",
          isVisible: true,
          url: "/products/p/mega-menu",
        },
      ],
    });
  };

  const options = { cache, now: () => 1_000 };
  const first = await handleRequest(
    new Request(endpoint),
    { SQUARESPACE_API_KEY: "private-test-key" },
    fetchSquarespace,
    options,
  );
  const second = await handleRequest(
    new Request(endpoint),
    { SQUARESPACE_API_KEY: "private-test-key" },
    fetchSquarespace,
    options,
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(requests, 1);
});

test("the product API limits a Squarespace refresh when no cache exists", async () => {
  let fetched = false;
  const response = await handleRequest(
    new Request(endpoint),
    {
      SQUARESPACE_API_KEY: "private-test-key",
      PRODUCT_REFRESH_LIMITER: {
        async limit() {
          return { success: false };
        },
      },
    },
    async () => {
      fetched = true;
      throw new Error("Squarespace must not be called");
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(fetched, false);
});

test("the product API retries one temporary Squarespace failure", async () => {
  let requests = 0;
  const response = await handleRequest(
    new Request(endpoint),
    { SQUARESPACE_API_KEY: "private-test-key" },
    async () => {
      requests += 1;
      if (requests === 1) return new Response(null, { status: 503 });
      return Response.json({ pagination: { hasNextPage: false }, products: [] });
    },
    { sleep: async () => {} },
  );

  assert.equal(response.status, 200);
  assert.equal(requests, 2);
});

test("Squarespace products without safe public fields are not published", () => {
  assert.equal(normalizeSquarespaceProduct({ id: "missing-url", name: "No URL" }), null);
});
