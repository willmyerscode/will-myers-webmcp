import { FIND_PRODUCTS_SCHEMA } from "./contracts.js";
import { findProducts } from "./product-search.js";

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
        });
      },
    },
    { signal: controller.signal },
  );

  return true;
}

/** @param {any} browser */
export async function boot(browser = window) {
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
