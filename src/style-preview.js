import { getEditorContext, getPreviewDocument } from "./editor-context.js";

const STYLE_ID = "wills-toolkit-mcp-preview";
const MAX_CSS_LENGTH = 50_000;

function validateCss(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("CSS is required.");
  }
  if (input.length > MAX_CSS_LENGTH) {
    throw new Error("CSS must contain 50,000 characters or fewer.");
  }
  if (/@import\b|url\s*\(/i.test(input)) {
    throw new Error("Temporary CSS cannot load external files.");
  }
  return input.trim();
}

/** @param {any} browser @param {{ css?: unknown }} input */
export function previewCss(browser, input) {
  const css = validateCss(input?.css);
  const document = getPreviewDocument(browser);
  if (!document?.head) throw new Error("The Squarespace page preview is not available.");

  let style = document.querySelector(`#${STYLE_ID}`);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.dataset.willsToolkitPreview = "true";
    document.head.append(style);
  }
  style.textContent = css;

  return {
    applied: true,
    bytes: new TextEncoder().encode(css).byteLength,
    pageId: getEditorContext(browser).page.id,
    note: "Temporary CSS preview applied. Squarespace was not saved.",
  };
}

/** @param {any} browser */
export function clearPreview(browser) {
  const document = getPreviewDocument(browser);
  const style = document?.querySelector?.(`#${STYLE_ID}`);
  if (!style) return { cleared: false };
  style.remove();
  return { cleared: true };
}
