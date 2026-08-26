import { FIND_PRODUCTS_SCHEMA, START_SUPPORT_SCHEMA } from "./contracts.js";
import { findProducts } from "./product-search.js";
import {
  applyPendingSupportRequest,
  startSupportRequest,
} from "./support-request.js";

export const VERSION = "0.1.0";

/** @param {any} browser @param {string} message @param {unknown} error */
function logWarning(browser, message, error) {
  browser.console?.warn?.(`[Will Myers WebMCP] ${message}`, error);
}

/** @param {any} browser */
export async function registerWebMCPTools(browser = window) {
  const modelContext = browser.document?.modelContext;
  if (!modelContext?.registerTool) return false;

  browser.__willMyersWebMCPController?.abort();
  const Controller = browser.AbortController || AbortController;
  const controller = new Controller();
  browser.__willMyersWebMCPController = controller;

  const siteOrigin = new URL(browser.location.href).origin;

  await modelContext.registerTool(
    {
      name: "find_products",
      title: "Find Will Myers products",
      description:
        "Search the current public Will Myers product catalog and return matching product pages. Use this for Squarespace plugins, components, and license options. This tool does not buy anything or change the page.",
      inputSchema: FIND_PRODUCTS_SCHEMA,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      async execute(input, options = {}) {
        return findProducts(input, {
          fetch: browser.fetch.bind(browser),
          signal: options.signal,
          siteOrigin,
        });
      },
    },
    { signal: controller.signal },
  );

  await modelContext.registerTool(
    {
      name: "start_support_request",
      title: "Prepare a Will Myers support request",
      description:
        "Open the Will Myers contact page and fill a support-request draft for the visitor to review. This tool never confirms admin access and never submits the form.",
      inputSchema: START_SUPPORT_SCHEMA,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      async execute(input) {
        return startSupportRequest(input, browser);
      },
    },
    { signal: controller.signal },
  );

  return true;
}

/** @param {any} browser */
export function applyPendingDraft(browser = window) {
  if (browser.location.pathname !== "/contact") return null;
  return applyPendingSupportRequest(browser.document, browser.sessionStorage);
}

/** @param {any} browser */
export async function boot(browser = window) {
  try {
    applyPendingDraft(browser);
  } catch (error) {
    logWarning(browser, "The saved support draft could not be filled.", error);
  }

  try {
    return await registerWebMCPTools(browser);
  } catch (error) {
    logWarning(browser, "Tool registration failed. The normal website still works.", error);
    return false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void boot(window);
}
