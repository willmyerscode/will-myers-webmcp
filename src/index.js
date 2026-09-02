import { readSiteRecord, runIndexSiteTool, searchSite } from "./site-index.js";
import { readSiteCodeInjection, readSiteCustomCss } from "./site-code.js";

/** @param {any} browser @param {string} message @param {unknown} error */
function logWarning(browser, message, error) {
  browser.console?.warn?.(`[Squarespace WebMCP] ${message}`, error);
}

/** @param {any} browser */
function installEditorBootstrap(browser) {
  try {
    if (!browser.parent || browser.parent === browser) return false;
    const parentUrl = new URL(browser.parent.location.href);
    if (!parentUrl.pathname.startsWith("/config")) return false;

    const source = browser.document?.currentScript?.src;
    const parentDocument = browser.parent.document;
    if (!source || !parentDocument?.head) return false;
    if (parentDocument.querySelector?.("script[data-squarespace-webmcp-editor-bootstrap]")) {
      return true;
    }

    const script = parentDocument.createElement("script");
    script.src = source;
    script.async = true;
    script.dataset.squarespaceWebmcpEditorBootstrap = "true";
    parentDocument.head.append(script);
    return true;
  } catch {
    return false;
  }
}

/** @param {any} browser */
export async function startWebMCPBridge(browser = window) {
  const modelContext = browser.document?.modelContext;
  const editorUrl = new URL(browser.location?.href || "about:blank");
  const previewFrame = browser.document?.querySelector?.("#sqs-site-frame");
  if (
    !modelContext?.registerTool ||
    !editorUrl.pathname.startsWith("/config") ||
    !previewFrame?.contentDocument
  ) {
    return false;
  }

  browser.__squarespaceWebMCPController?.abort();
  const Controller = browser.AbortController || AbortController;
  const controller = new Controller();
  browser.__squarespaceWebMCPController = controller;

  const tools = [
    {
      name: "index_site",
      title: "Index this Squarespace site",
      description:
        "Build or refresh a private, read-only site index in this browser. Call with action=start, then call with action=status until the status is complete. The complete result includes all record counts. Use these counts; do not browse the site, read a sitemap, search the web, or run a command to count again. It does not change Squarespace.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["start", "status"] },
        },
        additionalProperties: false,
      },
    },
    {
      name: "search_site",
      title: "Search this Squarespace site",
      description:
        "Search the private browser index for page text, titles, URLs, block types, and metadata. It does not fetch or change Squarespace.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "read_site_record",
      title: "Read one current Squarespace record",
      description:
        "Fetch current Squarespace data for one indexed page, section, block, or collection item, then refresh its private browser record. It does not change Squarespace.",
      inputSchema: {
        type: "object",
        properties: {
          record_id: { type: "string" },
          url: { type: "string" },
          section_id: { type: "string" },
          block_id: { type: "string" },
        },
        anyOf: [{ required: ["record_id"] }, { required: ["url"] }],
        additionalProperties: false,
      },
    },
    {
      name: "read_site_custom_css",
      title: "Read this site's Custom CSS",
      description:
        "Return the current Custom CSS text from Squarespace. It does not analyze or change the CSS.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "read_site_code_injection",
      title: "Read this site's Code Injection",
      description:
        "Return the current site-wide Code Injection settings from Squarespace. It does not analyze or change the code.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];

  for (const tool of tools) {
    await modelContext.registerTool(
      {
        ...tool,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          untrustedContentHint: true,
        },
        async execute(input) {
          if (tool.name === "index_site") return runIndexSiteTool(browser, input);
          if (tool.name === "search_site") return searchSite(browser, input);
          if (tool.name === "read_site_record") return readSiteRecord(browser, input);
          if (tool.name === "read_site_custom_css") return readSiteCustomCss(browser);
          if (tool.name === "read_site_code_injection") {
            return readSiteCodeInjection(browser);
          }
          throw new Error(`Unknown tool: ${tool.name}`);
        },
      },
      { signal: controller.signal },
    );
  }

  return true;
}

/** @param {any} browser */
export async function boot(browser = window) {
  try {
    if (installEditorBootstrap(browser)) return true;
    return await startWebMCPBridge(browser);
  } catch (error) {
    logWarning(browser, "Tool registration failed. Squarespace still works normally.", error);
    return false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void boot(window);
}
