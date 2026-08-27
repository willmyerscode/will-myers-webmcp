import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

test("the host serves assets and has no public product API", async () => {
  const requests = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        requests.push(request.url);
        return new Response("asset response", { status: 404 });
      },
    },
  };

  const response = await worker.fetch(
    new Request("https://will-myers-webmcp.otis.solutions/api/products"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "asset response");
  assert.deepEqual(requests, [
    "https://will-myers-webmcp.otis.solutions/api/products",
  ]);
});
