import assert from "node:assert/strict";
import test from "node:test";

import { registerWebMCPTools } from "../src/index.js";

test("a supported browser receives the two pilot tools", async () => {
  const registrations = [];
  const browser = {
    document: {
      modelContext: {
        async registerTool(tool, options) {
          registrations.push({ tool, options });
        },
      },
    },
    fetch: async () => ({
      ok: true,
      async json() {
        return {
          items: [
            {
              id: "mega-menu",
              title: "Mega Menu for Squarespace 7.1",
              fullUrl: "/products/p/mega-menu-for-squarespace-71",
              excerpt: "<p>Add more content to your site navigation.</p>",
              priceMoney: { currency: "USD", value: "25.00" },
              onSale: false,
              tags: ["Plugin"],
            },
          ],
        };
      },
    }),
    location: {
      href: "https://www.will-myers.com/products",
      pathname: "/products",
      assign() {},
    },
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  };

  await registerWebMCPTools(browser);

  assert.deepEqual(
    registrations.map(({ tool }) => tool.name),
    ["find_products", "start_support_request"],
  );
  assert.equal(registrations[0].tool.annotations.readOnlyHint, true);
  assert.equal(registrations[1].tool.annotations.readOnlyHint, false);

  const result = await registrations[0].tool.execute(
    { query: "navigation menu", max_results: 3 },
    { signal: new AbortController().signal },
  );

  assert.equal(result.count, 1);
  assert.equal(result.products[0].title, "Mega Menu for Squarespace 7.1");
  assert.equal(
    result.products[0].url,
    "https://www.will-myers.com/products/p/mega-menu-for-squarespace-71",
  );
});
