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
