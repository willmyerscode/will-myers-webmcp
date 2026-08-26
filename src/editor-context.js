const COLOR_VARIABLES = Object.freeze([
  ["white", "--white-hsl"],
  ["black", "--black-hsl"],
  ["lightAccent", "--lightAccent-hsl"],
  ["accent", "--accent-hsl"],
  ["darkAccent", "--darkAccent-hsl"],
]);

const FONT_VARIABLES = Object.freeze([
  ["heading", "--heading-font-font-family"],
  ["body", "--body-font-font-family"],
  ["meta", "--meta-font-font-family"],
]);

function readSquarespaceContext(document) {
  const scripts = document.querySelectorAll?.("script") || [];
  for (const script of scripts) {
    const text = script.textContent || "";
    const marker = "Static.SQUARESPACE_CONTEXT = ";
    const start = text.indexOf(marker);
    if (start < 0) continue;

    const json = text.slice(start + marker.length).trim().replace(/;\s*$/, "");
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}

function readDesign(document) {
  const getComputedStyle = document.defaultView?.getComputedStyle;
  if (!getComputedStyle || !document.documentElement) {
    return { colors: [], fonts: [] };
  }

  const styles = getComputedStyle(document.documentElement);
  const colors = COLOR_VARIABLES.flatMap(([name, variable]) => {
    const hsl = styles.getPropertyValue(variable).trim();
    return hsl ? [{ name, hsl }] : [];
  });
  const fonts = FONT_VARIABLES.flatMap(([role, variable]) => {
    const value = styles.getPropertyValue(variable).trim();
    if (!value) return [];
    const family = value.replace(/^["']([^"']+)["']$/, "$1");
    return [{ role, family }];
  });

  return { colors, fonts };
}

function blockType(block) {
  let fallback = null;
  for (const className of block.classList || []) {
    if (className.startsWith("sqs-block-") && className !== "sqs-block-content") {
      const type = className.slice("sqs-block-".length);
      if (type !== "website-component") return type;
      fallback = type;
    }
  }
  return fallback || block.getAttribute?.("data-block-type") || "unknown";
}

function blockText(block) {
  const copy = block.cloneNode(true);
  for (const element of copy.querySelectorAll?.("script, style, noscript") || []) {
    element.remove();
  }
  return (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function readStructure(document) {
  const root =
    document.querySelector?.("main article") ||
    document.querySelector?.("main") ||
    document.body;
  const allSections = [
    ...(root?.querySelectorAll?.("section[data-section-id], section.page-section") || []),
  ];

  const sections = allSections.slice(0, 50).map((section) => ({
    id: section.getAttribute("data-section-id") || section.id || null,
    theme: section.getAttribute("data-section-theme") || null,
    blocks: [...section.querySelectorAll(".sqs-block[id], [data-block-type][id]")]
      .slice(0, 100)
      .map((block) => ({
        id: block.id || null,
        type: blockType(block),
        text: blockText(block),
      })),
  }));

  return { sectionCount: allSections.length, sections };
}

export function getPreviewDocument(browser) {
  const frame = browser.document?.querySelector?.("#sqs-site-frame");
  return frame?.contentDocument || browser.document;
}

/** @param {any} browser */
export function getEditorContext(browser = window) {
  const document = getPreviewDocument(browser);
  if (!document) throw new Error("The Squarespace page preview is not available.");

  const context = readSquarespaceContext(document) || {};
  const website = context.website || {};
  const collection = context.collection || {};
  const bodyCollectionId = document.body?.id?.startsWith("collection-")
    ? document.body.id.slice("collection-".length)
    : null;
  const frame = browser.document?.querySelector?.("#sqs-site-frame");

  return {
    editor: {
      active: Boolean(frame),
      url: String(browser.location?.href || ""),
    },
    site: {
      id: website.id || null,
      title: website.siteTitle || website.fullSiteTitle || null,
      baseUrl: website.baseUrl || null,
      internalUrl: website.internalUrl || null,
    },
    page: {
      id: collection.id || bodyCollectionId,
      title: collection.title || document.title || null,
      type: collection.type ?? null,
      url: String(document.location?.href || collection.fullUrl || ""),
    },
    template: {
      id: context.templateId || website.templateId || null,
      version: context.templateVersion || null,
    },
    design: readDesign(document),
    structure: readStructure(document),
  };
}
