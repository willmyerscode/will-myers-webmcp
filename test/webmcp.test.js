import assert from "node:assert/strict";
import test from "node:test";

import { boot, startWebMCPBridge } from "../src/index.js";

test("the signed-in Squarespace Editor starts with no registered tools", async () => {
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
  assert.deepEqual(registrations, []);
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
