import {
  CLEAR_PREVIEW_SCHEMA,
  GET_EDITOR_CONTEXT_SCHEMA,
  INSPECT_TARGET_SCHEMA,
  PREVIEW_CSS_SCHEMA,
} from "./contracts.js";
import { getEditorContext } from "./editor-context.js";
import { clearPreview, previewCss } from "./style-preview.js";
import { inspectTarget } from "./target-inspection.js";

export const VERSION = "0.2.0";

/** @param {any} browser @param {string} message @param {unknown} error */
function logWarning(browser, message, error) {
  browser.console?.warn?.(`[Will’s Toolkit MCP] ${message}`, error);
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
    if (parentDocument.querySelector?.("script[data-will-toolkit-editor-bootstrap]")) {
      return true;
    }

    const script = parentDocument.createElement("script");
    script.src = source;
    script.async = true;
    script.dataset.willToolkitEditorBootstrap = "true";
    parentDocument.head.append(script);
    return true;
  } catch {
    return false;
  }
}

/** @param {any} browser */
export async function registerWebMCPTools(browser = window) {
  const modelContext = browser.document?.modelContext;
  if (!modelContext?.registerTool) return false;

  browser.__willsToolkitMCPController?.abort();
  const Controller = browser.AbortController || AbortController;
  const controller = new Controller();
  browser.__willsToolkitMCPController = controller;

  await modelContext.registerTool(
    {
      name: "get_editor_context",
      title: "Get Squarespace Editor context",
      description:
        "Read the current Squarespace Editor page, site identity, design colors, fonts, sections, and blocks. Use this before you design or change a Squarespace page. This tool does not save or change anything.",
      inputSchema: GET_EDITOR_CONTEXT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      async execute() {
        return getEditorContext(browser);
      },
    },
    { signal: controller.signal },
  );

  await modelContext.registerTool(
    {
      name: "inspect_target",
      title: "Inspect a Squarespace element",
      description:
        "Read the HTML, visible text, size, and important computed styles for one element in the current Squarespace preview. Use a section or block ID from get_editor_context. This tool does not change the page.",
      inputSchema: INSPECT_TARGET_SCHEMA,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      async execute(input) {
        return inspectTarget(browser, input);
      },
    },
    { signal: controller.signal },
  );

  await modelContext.registerTool(
    {
      name: "preview_css",
      title: "Preview CSS in Squarespace",
      description:
        "Apply temporary CSS to the current Squarespace page preview. Use this to show a design before it is saved. The preview disappears when the page reloads, and it cannot load external files.",
      inputSchema: PREVIEW_CSS_SCHEMA,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      async execute(input) {
        return previewCss(browser, input);
      },
    },
    { signal: controller.signal },
  );

  await modelContext.registerTool(
    {
      name: "clear_preview",
      title: "Clear the Squarespace CSS preview",
      description:
        "Remove the temporary CSS added by preview_css. This does not change saved Squarespace styles.",
      inputSchema: CLEAR_PREVIEW_SCHEMA,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      async execute() {
        return clearPreview(browser);
      },
    },
    { signal: controller.signal },
  );

  return true;
}

/** @param {any} browser */
export async function boot(browser = window) {
  try {
    if (installEditorBootstrap(browser)) return true;
    return await registerWebMCPTools(browser);
  } catch (error) {
    logWarning(browser, "Tool registration failed. Squarespace still works normally.", error);
    return false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void boot(window);
}
