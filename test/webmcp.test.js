import assert from "node:assert/strict";
import test from "node:test";

import { parseHTML } from "linkedom";

import { boot, registerWebMCPTools } from "../src/index.js";

function makePreviewDocument() {
  const squarespaceContext = {
    website: {
      id: "site-123",
      siteTitle: "Everything Testing",
      baseUrl: "https://everything-testing.squarespace.com",
      internalUrl: "https://example.squarespace.com",
    },
    collection: {
      id: "page-456",
      title: "Blank Test Page",
      type: 10,
      fullUrl: "/blank-test-page",
    },
    templateId: "template-789",
    templateVersion: "7.1",
  };
  const { document, window } = parseHTML(`
    <html>
      <head>
        <title>Blank Test Page</title>
        <script data-name="static-context">
          Static = window.Static || {};
          Static.SQUARESPACE_CONTEXT = ${JSON.stringify(squarespaceContext)};
        </script>
      </head>
      <body id="collection-page-456" class="sqs-seven-one sqs-edit-mode">
        <section class="page-section" data-section-id="section-1" data-section-theme="light">
          <div class="sqs-block sqs-block-website-component html-block sqs-block-html" id="block-heading">
            <style>.hidden { display: none; }</style>
            <div class="sqs-block-content"><h2>Our process</h2></div>
          </div>
          <div class="sqs-block image-block sqs-block-image" id="block-image"></div>
        </section>
      </body>
    </html>
  `);

  Object.defineProperty(document, "location", {
    value: new URL("https://everything-testing.squarespace.com/blank-test-page"),
  });

  const values = {
    "--white-hsl": "0, 0%, 100%",
    "--black-hsl": "0, 0%, 0%",
    "--accent-hsl": "210, 80%, 45%",
    "--heading-font-font-family": '"Fraunces"',
    "--body-font-font-family": '"Inter"',
    display: "block",
    color: "rgb(20, 20, 20)",
    "font-family": '"Inter"',
  };
  window.getComputedStyle = () => ({
    getPropertyValue(name) {
      return values[name] || "";
    },
  });

  return document;
}

test("the Squarespace Editor registers a read-only editor context tool", async () => {
  const registrations = [];
  const previewDocument = makePreviewDocument();
  const browser = {
    AbortController,
    console,
    location: { href: "https://everything-testing.squarespace.com/config/" },
    document: {
      title: "Blank Test Page — Everything Testing",
      modelContext: {
        async registerTool(tool, options) {
          registrations.push({ tool, options });
        },
      },
      querySelector(selector) {
        if (selector === "#sqs-site-frame") {
          return { contentDocument: previewDocument };
        }
        return null;
      },
    },
  };

  await registerWebMCPTools(browser);

  assert.deepEqual(
    registrations.map(({ tool }) => tool.name),
    ["get_editor_context", "inspect_target", "preview_css", "clear_preview"],
  );
  assert.equal(registrations[0].tool.annotations.readOnlyHint, true);
  assert.equal(registrations[1].tool.annotations.readOnlyHint, true);
  assert.equal(registrations[2].tool.annotations.readOnlyHint, false);

  const result = await registrations[0].tool.execute({});

  assert.deepEqual(result, {
    editor: {
      active: true,
      url: "https://everything-testing.squarespace.com/config/",
    },
    site: {
      id: "site-123",
      title: "Everything Testing",
      baseUrl: "https://everything-testing.squarespace.com",
      internalUrl: "https://example.squarespace.com",
    },
    page: {
      id: "page-456",
      title: "Blank Test Page",
      type: 10,
      url: "https://everything-testing.squarespace.com/blank-test-page",
    },
    template: {
      id: "template-789",
      version: "7.1",
    },
    design: {
      colors: [
        { name: "white", hsl: "0, 0%, 100%" },
        { name: "black", hsl: "0, 0%, 0%" },
        { name: "accent", hsl: "210, 80%, 45%" },
      ],
      fonts: [
        { role: "heading", family: "Fraunces" },
        { role: "body", family: "Inter" },
      ],
    },
    structure: {
      sectionCount: 1,
      sections: [
        {
          id: "section-1",
          theme: "light",
          blocks: [
            {
              id: "block-heading",
              type: "html",
              text: "Our process",
            },
            {
              id: "block-image",
              type: "image",
              text: "",
            },
          ],
        },
      ],
    },
  });

  const inspection = await registrations[1].tool.execute({
    selector: "#block-heading",
  });
  assert.equal(inspection.matchCount, 1);
  assert.equal(inspection.target.id, "block-heading");
  assert.equal(inspection.target.blockId, "block-heading");
  assert.equal(inspection.target.sectionId, "section-1");
  assert.equal(inspection.target.text, "Our process");
  assert.equal(inspection.target.styles.display, "block");
  assert.equal(inspection.target.styles.color, "rgb(20, 20, 20)");
  assert.match(inspection.target.html, /<h2>Our process<\/h2>/);
  assert.doesNotMatch(inspection.target.html, /\.hidden/);

  const previewResult = await registrations[2].tool.execute({
    css: "#block-heading { color: rebeccapurple; }",
  });
  assert.deepEqual(previewResult, {
    applied: true,
    bytes: 40,
    pageId: "page-456",
    note: "Temporary CSS preview applied. Squarespace was not saved.",
  });
  assert.equal(
    previewDocument.querySelector("#wills-toolkit-mcp-preview")?.textContent,
    "#block-heading { color: rebeccapurple; }",
  );

  const clearResult = await registrations[3].tool.execute({});
  assert.deepEqual(clearResult, { cleared: true });
  assert.equal(previewDocument.querySelector("#wills-toolkit-mcp-preview"), null);
});

test("temporary CSS rejects empty and network-loading styles", async () => {
  const registrations = [];
  const previewDocument = makePreviewDocument();
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
        return selector === "#sqs-site-frame"
          ? { contentDocument: previewDocument }
          : null;
      },
    },
  };

  await registerWebMCPTools(browser);
  const previewCss = registrations.find((tool) => tool.name === "preview_css");

  await assert.rejects(() => previewCss.execute({ css: "   " }), /CSS is required/);
  await assert.rejects(
    () => previewCss.execute({ css: '@import "https://example.com/style.css";' }),
    /cannot load external files/,
  );
  await assert.rejects(
    () => previewCss.execute({ css: ".hero { background: url(https://example.com/a.png); }" }),
    /cannot load external files/,
  );
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
  assert.equal(appended[0].dataset.willToolkitEditorBootstrap, "true");
});
