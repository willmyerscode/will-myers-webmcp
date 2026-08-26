import { getPreviewDocument } from "./editor-context.js";

const STYLE_PROPERTIES = Object.freeze([
  "display",
  "position",
  "width",
  "height",
  "grid-template-columns",
  "grid-template-rows",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "gap",
  "color",
  "background-color",
  "font-family",
  "font-size",
  "line-height",
  "margin",
  "padding",
  "border",
  "border-radius",
]);

function camelCase(property) {
  return property.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function cleanHtml(element) {
  const copy = element.cloneNode(true);
  for (const child of copy.querySelectorAll("script, style, noscript")) {
    child.remove();
  }
  return copy.outerHTML.slice(0, 20_000);
}

function textContent(element) {
  const copy = element.cloneNode(true);
  for (const child of copy.querySelectorAll("script, style, noscript")) {
    child.remove();
  }
  return (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 2_000);
}

/** @param {any} browser @param {{ selector?: unknown }} input */
export function inspectTarget(browser, input) {
  if (typeof input?.selector !== "string" || !input.selector.trim()) {
    throw new Error("A CSS selector is required.");
  }
  const selector = input.selector.trim();
  if (selector.length > 500) {
    throw new Error("The CSS selector must contain 500 characters or fewer.");
  }

  const document = getPreviewDocument(browser);
  let matches;
  try {
    matches = [...document.querySelectorAll(selector)];
  } catch {
    throw new Error("The CSS selector is not valid.");
  }
  if (matches.length === 0) {
    throw new Error("No element matches that CSS selector.");
  }

  const element = matches[0];
  const styles = document.defaultView?.getComputedStyle?.(element);
  const selectedStyles = Object.fromEntries(
    STYLE_PROPERTIES.flatMap((property) => {
      const value = styles?.getPropertyValue(property)?.trim();
      return value ? [[camelCase(property), value]] : [];
    }),
  );
  const section = element.closest?.("section[data-section-id], section.page-section");
  const block = element.closest?.(".sqs-block[id]");
  const box = element.getBoundingClientRect?.() || {};

  return {
    selector,
    matchCount: matches.length,
    target: {
      tagName: element.tagName?.toLowerCase() || null,
      id: element.id || null,
      classes: [...(element.classList || [])],
      sectionId: section?.getAttribute("data-section-id") || section?.id || null,
      blockId: block?.id || null,
      text: textContent(element),
      html: cleanHtml(element),
      box: {
        x: Number(box.x || 0),
        y: Number(box.y || 0),
        width: Number(box.width || 0),
        height: Number(box.height || 0),
      },
      styles: selectedStyles,
    },
  };
}
