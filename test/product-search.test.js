import assert from "node:assert/strict";
import test from "node:test";

import {
  findProducts,
  normalizeCatalog,
  searchProducts,
} from "../src/product-search.js";

const catalogResponse = {
  products: [
    {
      id: "collection-sync",
      title: "Collection to List Section Sync",
      url: "https://www.will-myers.com/products/p/collection-to-list-section-sync",
      summary: "Sync collections into list sections and simple lists.",
      price: { currency: "USD", value: "25" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "timeline",
      title: "Step Flow Timeline",
      url: "https://www.will-myers.com/products/p/step-flow-timeline",
      summary: "Transform List Sections into elegant timelines.",
      price: { currency: "USD", value: "25" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "hamburger",
      title: "Mega Hamburger Menu",
      url: "https://www.will-myers.com/products/p/hamburger-menu",
      summary: "Import a page as hamburger menu content.",
      price: { currency: "USD", value: "25" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "menu",
      title: "Mega Menu for Squarespace 7.1",
      url: "https://www.will-myers.com/products/p/mega-menu-for-squarespace-71",
      summary: "Add more content to your site navigation.",
      price: { currency: "USD", value: "25" },
      onSale: false,
      tags: ["Plugin"],
    },
  ],
};

test("find_products ranks the product that best matches the visitor's words", () => {
  const products = normalizeCatalog(catalogResponse, "https://www.will-myers.com");

  const results = searchProducts(products, "timeline from a list section", 1);

  assert.deepEqual(results, [
    {
      id: "timeline",
      title: "Step Flow Timeline",
      summary: "Transform List Sections into elegant timelines.",
      price: { currency: "USD", value: "25" },
      onSale: false,
      url: "https://www.will-myers.com/products/p/step-flow-timeline",
    },
  ]);
});

test("find_products prefers an exact title phrase", () => {
  const products = normalizeCatalog(catalogResponse, "https://www.will-myers.com");

  const [result] = searchProducts(products, "mega menu", 1);

  assert.equal(result.title, "Mega Menu for Squarespace 7.1");
});

test("find_products rejects max_results values outside its contract", async () => {
  for (const max_results of [0, 11, 2.5, "3"]) {
    let fetched = false;

    await assert.rejects(
      () =>
        findProducts(
          { query: "menu", max_results },
          {
            fetch: async () => {
              fetched = true;
              throw new Error("fetch must not run");
            },
          },
        ),
      /integer from 1 through 10/i,
    );
    assert.equal(fetched, false);
  }
});

test("find_products rejects non-text queries before catalog access", async () => {
  for (const query of [42, true, {}, []]) {
    let fetched = false;

    await assert.rejects(
      () =>
        findProducts(
          { query },
          {
            fetch: async () => {
              fetched = true;
              throw new Error("fetch must not run");
            },
          },
        ),
      /query must be text/i,
    );
    assert.equal(fetched, false);
  }
});

test("find_products reports a changed required catalog field", () => {
  assert.throws(
    () =>
      normalizeCatalog(
        { products: [{ id: "changed", title: "Changed product" }] },
        "https://www.will-myers.com",
      ),
    /required public fields/i,
  );
});

test("find_products reads the product service instead of the Squarespace page", async () => {
  let requestedUrl = "";

  await findProducts(
    { query: "menu" },
    {
      apiUrl: "https://will-myers-webmcp.otis.solutions/api/products",
      fetch: async (url) => {
        requestedUrl = String(url);
        return {
          ok: true,
          async json() {
            return catalogResponse;
          },
        };
      },
    },
  );

  assert.equal(
    requestedUrl,
    "https://will-myers-webmcp.otis.solutions/api/products",
  );
});
