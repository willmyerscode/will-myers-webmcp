import { findProducts } from "./product-search.js";
import {
  applyPendingSupportRequest,
  startSupportRequest,
} from "./support-request.js";

export const VERSION = "0.1.0";

const FIND_PRODUCTS_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description:
        "Product name, website feature, or design goal. Examples: mega menu, image slider, timeline.",
    },
    max_results: {
      type: "integer",
      minimum: 1,
      maximum: 10,
      default: 5,
      description: "Maximum number of matching products to return.",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

const START_SUPPORT_SCHEMA = {
  type: "object",
  properties: {
    first_name: { type: "string", minLength: 1, maxLength: 100 },
    last_name: { type: "string", minLength: 1, maxLength: 100 },
    email: {
      type: "string",
      format: "email",
      maxLength: 254,
      description: "Reply address for the support request.",
    },
    is_code_curious_member: {
      type: "boolean",
      description: "Whether the visitor is a Code Curious member.",
    },
    product_or_tutorial_url: {
      type: "string",
      format: "uri",
      maxLength: 2048,
      description: "Public Will Myers product, tutorial, article, or code-snippet URL.",
    },
    website_url: {
      type: "string",
      format: "uri",
      maxLength: 2048,
      description: "Optional public or password-protected page that shows the problem.",
    },
    message: {
      type: "string",
      minLength: 1,
      maxLength: 5000,
      description: "A clear description of the problem and the expected result.",
    },
  },
  required: [
    "first_name",
    "last_name",
    "email",
    "is_code_curious_member",
    "product_or_tutorial_url",
    "message",
  ],
  additionalProperties: false,
};

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
