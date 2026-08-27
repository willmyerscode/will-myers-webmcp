import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { parseHTML } from "linkedom";

import { boot, startWebMCPBridge } from "../src/index.js";

function makeEditorBrowser({ database = new IDBFactory(), fetch = globalThis.fetch } = {}) {
  const registrations = [];
  const { window } = parseHTML("<html></html>");
  const browser = {
    AbortController,
    DOMParser: window.DOMParser,
    console,
    fetch,
    indexedDB: database,
    location: { href: "https://everything-testing.squarespace.com/config/pages" },
    document: {
      modelContext: {
        async registerTool(tool) {
          registrations.push(tool);
        },
      },
      querySelector(selector) {
        return selector === "#sqs-site-frame" ? { contentDocument: {} } : null;
      },
    },
  };

  return { browser, registrations };
}

async function runIndex(indexTool) {
  let result = await indexTool.execute({ action: "start" });
  for (let attempt = 0; attempt < 10_000 && result.status === "running"; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    result = await indexTool.execute({ action: "status" });
  }
  assert.notEqual(result.status, "running", "The index job did not finish.");
  assert.notEqual(result.status, "failed", result.error);
  return result;
}

test("the signed-in Squarespace Editor registers only the read-only site tools", async () => {
  const registrations = [];
  const browser = {
    AbortController,
    console,
    location: { href: "https://everything-testing.squarespace.com/config/" },
    document: {
      modelContext: {
        async registerTool(tool) {
          registrations.push(tool);
        },
      },
      querySelector(selector) {
        return selector === "#sqs-site-frame" ? { contentDocument: {} } : null;
      },
    },
  };

  assert.equal(await startWebMCPBridge(browser), true);
  assert.deepEqual(
    registrations.map((tool) => tool.name),
    ["index_site", "find_site", "read_site"],
  );
  assert.ok(registrations.every((tool) => tool.annotations.readOnlyHint));
});

test("index_site starts a long crawl in the background and reports its status", async () => {
  const database = new IDBFactory();
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-job", siteTitle: "Job Test" },
        siteLayout: [],
      });
    }
    if (url.pathname === "/sitemap.xml") return new Response("<urlset></urlset>");
    return new Response("Not found", { status: 404 });
  };
  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexTool = load.registrations.find((tool) => tool.name === "index_site");

  const started = await indexTool.execute({ action: "start" });
  assert.equal(started.status, "running");

  let complete = started;
  for (let attempt = 0; attempt < 100 && complete.status === "running"; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    complete = await indexTool.execute({ action: "status" });
  }
  assert.equal(complete.status, "complete");
  assert.equal(complete.siteId, "site-job");
  assert.deepEqual(complete.errors, []);
});

test("index_site and read_site cannot run at the same time", async () => {
  const database = new IDBFactory();
  let holdContext = false;
  let releaseContext;
  const contextGate = new Promise((resolve) => {
    releaseContext = resolve;
  });
  let holdRead = false;
  let releaseRead;
  let markReadStarted;
  const readGate = new Promise((resolve) => {
    releaseRead = resolve;
  });
  const readStarted = new Promise((resolve) => {
    markReadStarted = resolve;
  });
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      if (holdContext) await contextGate;
      return Response.json({
        website: { id: "site-read-lock", siteTitle: "Read Lock Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "page-lock",
                title: "Locked page",
                fullUrl: "/locked-page",
                typeName: "page",
                updatedOn: 1,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://example.com/locked-page</loc></url></urlset>",
      );
    }
    if (url.pathname === "/locked-page" && url.searchParams.has("format")) {
      if (holdRead) {
        markReadStarted();
        await readGate;
      }
      return Response.json({
        collection: {
          id: "page-lock",
          title: "Locked page",
          fullUrl: "/locked-page",
          typeName: "page",
          updatedOn: 1,
        },
      });
    }
    if (url.pathname === "/locked-page") {
      return new Response('<main id="page"></main>');
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexTool = load.registrations.find((tool) => tool.name === "index_site");
  const readTool = load.registrations.find((tool) => tool.name === "read_site");
  await runIndex(indexTool);

  holdContext = true;
  assert.equal((await indexTool.execute({ action: "start" })).status, "running");
  await assert.rejects(
    () => readTool.execute({ record_id: "site-read-lock:page:page-lock" }),
    /while index_site is running/,
  );

  releaseContext();
  const finished = await runIndex(indexTool);
  assert.equal(finished.status, "complete");

  holdRead = true;
  const pendingRead = readTool.execute({ record_id: "site-read-lock:page:page-lock" });
  await readStarted;
  try {
    await assert.rejects(
      () => indexTool.execute({ action: "start" }),
      /while read_site is running/,
    );
  } finally {
    releaseRead();
  }
  assert.equal((await pendingRead).found, true);
});

test("a public Squarespace page does not start the editor tool shell", async () => {
  const registrations = [];
  const browser = {
    AbortController,
    console,
    location: { href: "https://everything-testing.squarespace.com/team" },
    document: {
      modelContext: {
        async registerTool(tool) {
          registrations.push(tool);
        },
      },
      querySelector() {
        return null;
      },
    },
  };

  assert.equal(await startWebMCPBridge(browser), false);
  assert.deepEqual(registrations, []);
});

test("the browser index keeps paginated collection items after the bridge reloads", async () => {
  const database = new IDBFactory();
  const requests = [];
  let includeItemInSitemap = true;
  let includeSecondInCollection = true;
  let collectionUpdatedOn = 100;
  let secondItemReturnsHtml = false;
  let secondItemSitemapUpdatedOn = "2026-08-21";
  const fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, method: options.method || "GET" });

    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-123", siteTitle: "Everything Testing" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "blog-123",
                title: "Technical Blog",
                fullUrl: "/technical-blog",
                typeName: "blog-basic-grid",
                updatedOn: collectionUpdatedOn,
              },
            ],
          },
        ],
      });
    }

    if (url.pathname === "/sitemap.xml") {
      return new Response(
        `<urlset><url><loc>https://example.com/technical-blog</loc><lastmod>2026-08-20</lastmod></url>${includeItemInSitemap ? `<url><loc>https://example.com/technical-blog/second-post</loc><lastmod>${secondItemSitemapUpdatedOn}</lastmod></url>` : ""}</urlset>`,
        { headers: { "content-type": "application/xml" } },
      );
    }

    if (url.pathname === "/technical-blog/first-post") {
      return Response.json({
        collection: {
          id: "blog-123",
          title: "Technical Blog",
          fullUrl: "/technical-blog",
          typeName: "blog-basic-grid",
          updatedOn: 100,
        },
        item: {
          id: "post-1",
          collectionId: "blog-123",
          title: "First post",
          fullUrl: "/technical-blog/first-post",
          body: "<p>Full first body</p>",
          updatedOn: 101,
        },
      });
    }

    if (url.pathname === "/technical-blog/second-post") {
      if (secondItemReturnsHtml) {
        return new Response(`
          <html><head><title>Second post</title></head><body>
            <main id="page"><section data-section-id="item-section"></section></main>
          </body></html>
        `, { headers: { "content-type": "text/html" } });
      }
      return Response.json({
        collection: {
          id: "blog-123",
          title: "Technical Blog",
          fullUrl: "/technical-blog",
          typeName: "blog-basic-grid",
          updatedOn: 100,
        },
        item: {
          id: "post-2",
          collectionId: "blog-123",
          title: "Second post",
          fullUrl: "/technical-blog/second-post",
          body: "<p>A deeply technical answer from the full post</p>",
          updatedOn: 102,
        },
      });
    }

    if (url.pathname === "/technical-blog/third-post") {
      return Response.json({
        collection: {
          id: "blog-123",
          title: "Technical Blog",
          fullUrl: "/technical-blog",
          typeName: "blog-basic-grid",
          updatedOn: 100,
        },
        item: {
          id: "post-3",
          collectionId: "blog-123",
          title: "Third post",
          fullUrl: "/technical-blog/third-post",
          body: "<p>Full text found only on the third item URL</p>",
          updatedOn: 103,
        },
      });
    }

    if (url.pathname === "/technical-blog" && !url.searchParams.has("offset")) {
      return Response.json({
        collection: {
          id: "blog-123",
          title: "Technical Blog",
          fullUrl: "/technical-blog",
          typeName: "blog-basic-grid",
          updatedOn: 100,
        },
        items: [
          {
            id: "post-1",
            collectionId: "blog-123",
            title: "First post",
            fullUrl: "/technical-blog/first-post",
            body: "<p>First body</p>",
            updatedOn: 101,
          },
        ],
        pagination: {
          nextPage: true,
          nextPageUrl: "/technical-blog?offset=2",
        },
      });
    }

    if (url.pathname === "/technical-blog" && url.searchParams.get("offset") === "2") {
      return Response.json({
        collection: {
          id: "blog-123",
          title: "Technical Blog",
          fullUrl: "/technical-blog",
          typeName: "blog-basic-grid",
          updatedOn: 100,
        },
        items: [
          ...(includeSecondInCollection
            ? [
                {
                  id: "post-2",
                  collectionId: "blog-123",
                  title: "Second post",
                  fullUrl: "/technical-blog/second-post",
                  body: "<p>Short summary</p>",
                  updatedOn: 102,
                },
              ]
            : []),
          {
            id: "post-3",
            collectionId: "blog-123",
            title: "Third post",
            fullUrl: "/technical-blog/third-post",
            body: "<p>Short third summary</p>",
            updatedOn: 103,
          },
        ],
        pagination: { nextPage: false },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  const firstLoad = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(firstLoad.browser);
  const indexTool = firstLoad.registrations.find((tool) => tool.name === "index_site");
  const indexResult = await runIndex(indexTool);

  assert.equal(indexResult.siteId, "site-123");
  assert.equal(indexResult.collectionItems, 3);
  assert.equal(indexResult.errors.length, 0);

  const secondLoad = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(secondLoad.browser);
  const findTool = secondLoad.registrations.find((tool) => tool.name === "find_site");
  const found = await findTool.execute({ query: "deeply technical" });

  assert.equal(found.total, 1);
  assert.deepEqual(found.results[0], {
    recordId: "site-123:item:post-2",
    kind: "item",
    url: "/technical-blog/second-post",
    title: "Second post",
    pageId: "blog-123",
    sectionId: null,
    blockId: null,
    blockType: null,
    updatedOn: 102,
    snippet: "A deeply technical answer from the full post",
  });
  assert.ok(requests.some(({ url }) => url.includes("offset=2") && url.includes("format=json")));
  assert.ok(requests.some(({ url }) => url.includes("second-post?format=json")));
  assert.ok(requests.every(({ method }) => method === "GET"));

  const third = await findTool.execute({ query: "found only on the third item URL" });
  assert.equal(third.total, 1);
  assert.equal(third.results[0].recordId, "site-123:item:post-3");

  secondItemReturnsHtml = true;
  await assert.rejects(
    () =>
      secondLoad.registrations
        .find((tool) => tool.name === "read_site")
        .execute({ record_id: "site-123:item:post-2" }),
    /HTML instead of JSON/,
  );
  assert.equal((await findTool.execute({ query: "deeply technical" })).total, 1);

  collectionUpdatedOn = 101;
  secondItemSitemapUpdatedOn = "2026-08-22";
  const itemHtmlIndex = await runIndex(indexTool);
  assert.ok(itemHtmlIndex.errors.some(({ url }) => url === "/technical-blog/second-post"));
  const secondPostResults = await findTool.execute({ query: "Second post" });
  assert.equal(
    secondPostResults.results.filter(
      ({ kind, url }) => kind === "page" && url === "/technical-blog/second-post",
    ).length,
    0,
  );
  await assert.rejects(
    () =>
      secondLoad.registrations
        .find((tool) => tool.name === "read_site")
        .execute({ record_id: "site-123:item:post-2" }),
    /HTML instead of JSON/,
  );
  assert.equal((await findTool.execute({ query: "deeply technical" })).total, 1);
  secondItemReturnsHtml = false;

  includeItemInSitemap = false;
  await runIndex(indexTool);
  const parent = await findTool.execute({ query: "Technical Blog" });
  assert.equal(parent.results.filter((result) => result.kind === "page").length, 1);
  assert.equal((await findTool.execute({ query: "deeply technical" })).total, 1);

  includeItemInSitemap = true;
  includeSecondInCollection = false;
  collectionUpdatedOn = 102;
  await runIndex(indexTool);
  assert.equal((await findTool.execute({ query: "deeply technical" })).total, 1);

  includeItemInSitemap = false;
  await runIndex(indexTool);
  assert.equal((await findTool.execute({ query: "deeply technical" })).total, 0);
});

test("index_site retries a failed full collection-item read", async () => {
  const database = new IDBFactory();
  let detailFails = true;
  let detailRequests = 0;
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-retry", siteTitle: "Retry Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "blog-retry",
                title: "Retry Blog",
                fullUrl: "/retry-blog",
                typeName: "blog-basic-grid",
                updatedOn: 500,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://example.com/retry-blog</loc></url></urlset>",
      );
    }
    if (url.pathname === "/retry-blog/item") {
      detailRequests += 1;
      if (detailFails) return new Response("Temporary error", { status: 503 });
      return Response.json({
        collection: {
          id: "blog-retry",
          title: "Retry Blog",
          fullUrl: "/retry-blog",
          typeName: "blog-basic-grid",
          updatedOn: 500,
        },
        item: {
          id: "retry-item",
          collectionId: "blog-retry",
          title: "Retry item",
          fullUrl: "/retry-blog/item",
          body: "<p>Full content after retry</p>",
          updatedOn: 501,
        },
      });
    }
    if (url.pathname === "/retry-blog") {
      return Response.json({
        collection: {
          id: "blog-retry",
          title: "Retry Blog",
          fullUrl: "/retry-blog",
          typeName: "blog-basic-grid",
          updatedOn: 500,
        },
        items: [
          {
            id: "retry-item",
            collectionId: "blog-retry",
            title: "Retry item",
            fullUrl: "/retry-blog/item",
            body: "<p>Short summary</p>",
            updatedOn: 501,
          },
        ],
      });
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexTool = load.registrations.find((tool) => tool.name === "index_site");
  const findTool = load.registrations.find((tool) => tool.name === "find_site");

  const first = await runIndex(indexTool);
  assert.equal(first.errors.length, 1);
  assert.equal(detailRequests, 1);

  detailFails = false;
  const second = await runIndex(indexTool);
  assert.equal(second.errors.length, 0);
  assert.equal(detailRequests, 2);
  assert.equal((await findTool.execute({ query: "Full content after retry" })).total, 1);
});

test("the browser index finds text at an exact page, section, and block location", async () => {
  const database = new IDBFactory();
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-456", siteTitle: "Agency Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "page-about",
                title: "About the agency",
                fullUrl: "/about",
                typeName: "page",
                updatedOn: 200,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://agency.example/about</loc><lastmod>2026-08-21</lastmod></url></urlset>",
      );
    }
    if (url.pathname === "/about" && url.searchParams.get("format") === "json") {
      return Response.json({
        collection: {
          id: "page-about",
          title: "About the agency",
          fullUrl: "/about",
          typeName: "page",
          updatedOn: 200,
          seoData: { seoTitle: "Migration experts" },
        },
        mainContent: '<div class="sqs-layout empty"></div>',
      });
    }
    if (url.pathname === "/about") {
      return new Response(`
        <html><body><main id="page">
          <section data-section-id="section-intro">
            <div id="block-copy" class="sqs-block sqs-block-html">
              <div class="sqs-block-content"><p>Migration planning for large teams.</p></div>
            </div>
          </section>
        </main></body></html>
      `);
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  await runIndex(load.registrations.find((tool) => tool.name === "index_site"));
  const found = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "migration planning" });

  assert.equal(found.total, 1);
  assert.deepEqual(found.results[0], {
    recordId: "site-456:block:block-copy",
    kind: "block",
    url: "/about",
    title: "About the agency",
    pageId: "page-about",
    sectionId: "section-intro",
    blockId: "block-copy",
    blockType: "html",
    updatedOn: 200,
    snippet: "Migration planning for large teams.",
  });

  const metadataMatch = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "Migration experts" });
  assert.equal(metadataMatch.total, 1);
  assert.equal(metadataMatch.results[0].kind, "page");

  const blockTypeMatch = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "html" });
  assert.equal(blockTypeMatch.total, 1);
  assert.equal(blockTypeMatch.results[0].blockId, "block-copy");
});

test("index_site uses rendered HTML when a normal page does not return JSON", async () => {
  const database = new IDBFactory();
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-html", siteTitle: "HTML Test" },
        siteLayout: [],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://example.com/html-page</loc></url></urlset>",
      );
    }
    if (url.pathname === "/html-page") {
      return new Response(`
        <html><head><title>HTML document title</title></head><body>
        <main id="page"><section data-section-id="section-html">
          <div id="block-html" class="sqs-block sqs-block-html">
            <div class="sqs-block-content"><p>Content from rendered HTML.</p></div>
          </div>
        </section></main></body></html>
      `, { headers: { "content-type": "text/html" } });
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexed = await runIndex(
    load.registrations.find((tool) => tool.name === "index_site"),
  );
  assert.deepEqual(indexed.errors, []);

  const found = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "Content from rendered HTML" });
  assert.equal(found.total, 1);
  assert.equal(found.results[0].recordId, "site-html:block:block-html");
  assert.equal(found.results[0].title, "HTML document title");

  const read = await load.registrations
    .find((tool) => tool.name === "read_site")
    .execute({ record_id: "site-html:block:block-html" });
  assert.equal(read.found, true);
  assert.equal(read.record.content, "Content from rendered HTML.");
});

test("index_site ignores Squarespace navigation folders", async () => {
  const database = new IDBFactory();
  let folderRequests = 0;
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-folders", siteTitle: "Folder Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "folder-services",
                title: "Services",
                fullUrl: "/services",
                typeName: "folders",
                updatedOn: 1,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") return new Response("<urlset></urlset>");
    if (url.pathname === "/services") folderRequests += 1;
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexed = await runIndex(
    load.registrations.find((tool) => tool.name === "index_site"),
  );
  assert.equal(indexed.ignored, 1);
  assert.equal(indexed.records, 0);
  assert.deepEqual(indexed.errors, []);
  assert.equal(folderRequests, 0);
});

test("read_site returns fresh block content and updates the browser index", async () => {
  const database = new IDBFactory();
  let pageText = "Old migration plan";
  let invalidResponse = null;
  const requests = [];
  const fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, method: options.method || "GET" });
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-read", siteTitle: "Read Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "page-services",
                title: "Services",
                fullUrl: "/services",
                typeName: "page",
                updatedOn: 300,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://example.com/services</loc></url></urlset>",
      );
    }
    if (url.pathname === "/services" && url.searchParams.get("format") === "json") {
      if (invalidResponse === "structure") return Response.json({ empty: true });
      if (invalidResponse === "malformed") {
        return new Response("{broken", {
          headers: { "content-type": "application/json" },
        });
      }
      if (invalidResponse === "sign-in") {
        return new Response("<html><head><title>Sign In</title></head><body><form></form></body></html>", {
          headers: { "content-type": "text/html" },
        });
      }
      return Response.json({
        collection: {
          id: "page-services",
          title: "Services",
          fullUrl: "/services",
          typeName: "page",
          updatedOn: pageText.startsWith("Old") ? 300 : 301,
        },
      });
    }
    if (url.pathname === "/services") {
      if (invalidResponse === "sign-in") {
        return new Response("<html><head><title>Sign In</title></head><body><form></form></body></html>");
      }
      return new Response(`
        <main id="page"><section data-section-id="section-services">
          <div id="block-services" class="sqs-block sqs-block-html">
            <div class="sqs-block-content"><p>${pageText}</p></div>
          </div>
        </section></main>
      `);
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  await runIndex(load.registrations.find((tool) => tool.name === "index_site"));

  pageText = "Fresh migration plan for 1,000 pages";
  const read = await load.registrations
    .find((tool) => tool.name === "read_site")
    .execute({ record_id: "site-read:block:block-services" });

  assert.equal(read.found, true);
  assert.equal(read.refreshed, true);
  assert.equal(read.record.content, "Fresh migration plan for 1,000 pages");
  assert.equal(read.record.updatedOn, 301);

  const found = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "1,000 pages" });
  assert.equal(found.total, 1);
  assert.equal(found.results[0].blockId, "block-services");

  invalidResponse = "structure";
  await assert.rejects(
    () =>
      load.registrations
        .find((tool) => tool.name === "read_site")
        .execute({ record_id: "site-read:block:block-services" }),
    /valid page or item data/,
  );
  invalidResponse = "malformed";
  await assert.rejects(
    () =>
      load.registrations
        .find((tool) => tool.name === "read_site")
        .execute({ record_id: "site-read:block:block-services" }),
    /valid JSON/,
  );
  invalidResponse = "sign-in";
  await assert.rejects(
    () =>
      load.registrations
        .find((tool) => tool.name === "read_site")
        .execute({ record_id: "site-read:block:block-services" }),
    /valid Squarespace page HTML/,
  );
  assert.equal(
    (await load.registrations
      .find((tool) => tool.name === "find_site")
      .execute({ query: "1,000 pages" })).total,
    1,
  );
  assert.ok(requests.every(({ method }) => method === "GET"));
});

test("index_site skips unchanged pages, keeps failed pages, and removes missing pages", async () => {
  const database = new IDBFactory();
  let phase = 1;
  let pageFetches = 0;
  const fetch = async (input) => {
    const url = new URL(String(input));
    const links = [
      {
        collectionId: "page-alpha",
        title: "Alpha page",
        fullUrl: "/alpha",
        typeName: "page",
        updatedOn: phase < 3 ? 10 : 11,
      },
      ...(phase < 3
        ? [
            {
              collectionId: "page-beta",
              title: "Beta page",
              fullUrl: "/beta",
              typeName: "page",
              updatedOn: 20,
            },
          ]
        : []),
    ];

    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-refresh", siteTitle: "Refresh Test" },
        siteLayout: [{ identifier: "mainNav", links }],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        `<urlset>${links
          .map((link) => `<url><loc>https://example.com${link.fullUrl}</loc></url>`)
          .join("")}</urlset>`,
      );
    }
    if (["/alpha", "/beta"].includes(url.pathname) && url.searchParams.has("format")) {
      pageFetches += 1;
      if (phase === 3 && url.pathname === "/alpha") {
        return new Response("Temporary error", { status: 503 });
      }
      const link = links.find((candidate) => candidate.fullUrl === url.pathname);
      return Response.json({ collection: { id: link.collectionId, ...link } });
    }
    if (["/alpha", "/beta"].includes(url.pathname)) {
      return new Response(
        `<main id="page"><section data-section-id="section-${url.pathname.slice(1)}"></section></main>`,
      );
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexTool = load.registrations.find((tool) => tool.name === "index_site");
  const findTool = load.registrations.find((tool) => tool.name === "find_site");

  await runIndex(indexTool);
  assert.equal(pageFetches, 2);

  phase = 2;
  const unchanged = await runIndex(indexTool);
  assert.equal(unchanged.skipped, 2);
  assert.equal(pageFetches, 2);

  phase = 3;
  const partial = await runIndex(indexTool);
  assert.deepEqual(partial.errors, [
    { url: "/alpha", message: "Squarespace returned 503 for https://everything-testing.squarespace.com/alpha?format=json." },
  ]);
  assert.equal((await findTool.execute({ query: "Alpha page" })).total, 1);
  assert.equal((await findTool.execute({ query: "Beta page" })).total, 0);
});

test("find_site searches a 1,000-item site index in less than one second", async () => {
  const database = new IDBFactory();
  const items = Array.from({ length: 1_000 }, (_, index) => ({
    id: `item-${index}`,
    collectionId: "library-1",
    title: `Migration entry ${index}`,
    fullUrl: `/library/entry-${index}`,
    body: `<p>Agency content ${index}</p>`,
    tags: [index === 999 ? "final-needle" : "standard"],
    updatedOn: index,
  }));
  const fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/context/website") {
      return Response.json({
        website: { id: "site-scale", siteTitle: "Scale Test" },
        siteLayout: [
          {
            identifier: "mainNav",
            links: [
              {
                collectionId: "library-1",
                title: "Library",
                fullUrl: "/library",
                typeName: "blog-basic-grid",
                updatedOn: 1,
              },
            ],
          },
        ],
      });
    }
    if (url.pathname === "/sitemap.xml") {
      return new Response(
        "<urlset><url><loc>https://example.com/library</loc></url></urlset>",
      );
    }
    if (url.pathname.startsWith("/library/entry-")) {
      const index = Number(url.pathname.split("-").at(-1));
      return Response.json({
        collection: {
          id: "library-1",
          title: "Library",
          fullUrl: "/library",
          typeName: "blog-basic-grid",
          updatedOn: 1,
        },
        item: items[index],
      });
    }
    if (url.pathname === "/library") {
      return Response.json({
        collection: {
          id: "library-1",
          title: "Library",
          fullUrl: "/library",
          typeName: "blog-basic-grid",
          updatedOn: 1,
        },
        items,
        pagination: { nextPage: false },
      });
    }
    return new Response("Not found", { status: 404 });
  };

  const load = makeEditorBrowser({ database, fetch });
  await startWebMCPBridge(load.browser);
  const indexed = await runIndex(
    load.registrations.find((tool) => tool.name === "index_site"),
  );
  assert.deepEqual(indexed.errors, []);

  const started = performance.now();
  const found = await load.registrations
    .find((tool) => tool.name === "find_site")
    .execute({ query: "final-needle" });
  const duration = performance.now() - started;

  assert.equal(found.total, 1);
  assert.equal(found.results[0].recordId, "site-scale:item:item-999");
  assert.ok(duration < 1_000, `Search took ${duration.toFixed(1)} ms.`);
});

test("the preview copy loads one bootstrap script into its editor parent", async () => {
  const appended = [];
  const parentDocument = {
    head: { append(node) { appended.push(node); } },
    createElement() {
      return { dataset: {} };
    },
    querySelector() {
      return null;
    },
  };
  const parent = {
    document: parentDocument,
    location: { href: "https://everything-testing.squarespace.com/config/" },
  };
  const preview = {
    console,
    document: {
      currentScript: {
        src: "https://will-myers-webmcp.otis.solutions/webmcp.js",
      },
    },
    location: { href: "https://everything-testing.squarespace.com/blank-test-page" },
    parent,
    top: parent,
  };

  assert.equal(await boot(preview), true);
  assert.equal(appended.length, 1);
  assert.equal(
    appended[0].src,
    "https://will-myers-webmcp.otis.solutions/webmcp.js",
  );
  assert.equal(appended[0].dataset.squarespaceWebmcpEditorBootstrap, "true");
});
