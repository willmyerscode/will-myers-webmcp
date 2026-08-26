import assert from "node:assert/strict";
import test from "node:test";

import {
  handleRequest,
  normalizeSquarespaceProduct,
} from "../src/worker.js";

const endpoint = "https://will-myers-webmcp.otis.solutions/api/products";

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
          url: "https://www.will-myers.com/products/p/step-flow-timeline",
          tags: ["Plugin"],
          pricing: {
            basePrice: { currency: { currencyCode: "USD" }, value: 25 },
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
                basePrice: { currency: { currencyCode: "USD" }, value: 30 },
                onSale: true,
                salePrice: { currency: { currencyCode: "USD" }, value: 20 },
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

test("Squarespace products without safe public fields are not published", () => {
  assert.equal(normalizeSquarespaceProduct({ id: "missing-url", name: "No URL" }), null);
});
