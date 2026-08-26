import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCatalog, searchProducts } from "../src/product-search.js";

const catalogResponse = {
  items: [
    {
      id: "collection-sync",
      title: "Collection to List Section Sync",
      fullUrl: "/products/p/collection-to-list-section-sync",
      excerpt: "<p>Sync collections into list sections and simple lists.</p>",
      priceMoney: { currency: "USD", value: "25.00" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "timeline",
      title: "Step Flow Timeline",
      fullUrl: "/products/p/step-flow-timeline",
      excerpt: "<p>Transform List Sections into elegant timelines.</p>",
      priceMoney: { currency: "USD", value: "25.00" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "hamburger",
      title: "Mega Hamburger Menu",
      fullUrl: "/products/p/hamburger-menu",
      excerpt: "<p>Import a page as hamburger menu content.</p>",
      priceMoney: { currency: "USD", value: "25.00" },
      onSale: false,
      tags: ["Plugin"],
    },
    {
      id: "menu",
      title: "Mega Menu for Squarespace 7.1",
      fullUrl: "/products/p/mega-menu-for-squarespace-71",
      excerpt: "<p>Add more content to your site navigation.</p>",
      priceMoney: { currency: "USD", value: "25.00" },
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
      price: { currency: "USD", value: "25.00" },
      onSale: false,
      url: "https://www.will-myers.com/products/p/step-flow-timeline",
      license: "single-site",
    },
  ]);
});

test("find_products prefers an exact title phrase", () => {
  const products = normalizeCatalog(catalogResponse, "https://www.will-myers.com");

  const [result] = searchProducts(products, "mega menu", 1);

  assert.equal(result.title, "Mega Menu for Squarespace 7.1");
});
