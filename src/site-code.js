import { getPreviewDocument } from "./editor-context.js";
import { TOOL_LIMITS } from "./limits.js";
import {
  CODE_INJECTION_LOCATIONS,
  CODE_INJECTION_LOCATION_NAMES,
} from "./code-locations.js";

function limitCode(code) {
  return String(code || "").slice(0, TOOL_LIMITS.siteCodeCharacters);
}

function codeType(code) {
  const hasScript = /<script[\s>]/i.test(code);
  const hasStyle = /<style[\s>]/i.test(code) || /<link[\s>]/i.test(code);
  const hasHtml = /<(?!script|style|link|meta)[a-z]/i.test(code);
  const hasMeta = /<meta[\s>]/i.test(code);
  if ((hasScript && (hasStyle || hasHtml || hasMeta)) || (hasStyle && hasHtml)) {
    return "mixed";
  }
  return hasScript ? "script" : "html";
}

async function fetchJson(browser, pathname) {
  const origin = new URL(browser.location.href).origin;
  const response = await browser.fetch(new URL(pathname, origin), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Squarespace returned HTTP ${response.status}.`);
  }
  return response.json();
}

/** @param {any} browser */
export async function readCustomCss(browser) {
  const error =
    browser.document
      ?.querySelector?.('.u-field-error[data-test="error"]')
      ?.textContent?.trim() || null;
  if (new URL(browser.location.href).pathname.includes("/config/pages/custom-css")) {
    const textarea = browser.document.querySelector?.(".sqs-code textarea");
    if (textarea && typeof textarea.value === "string") {
      return { source: "editor", css: limitCode(textarea.value), error };
    }
  }

  const data = await fetchJson(browser, "/api/template/GetTemplateCustomCss");
  return { source: "saved", css: limitCode(data?.css), error };
}

function pageCode(browser) {
  const document = getPreviewDocument(browser);
  const blocks = [...document.querySelectorAll(".sqs-block-code .sqs-block-content")]
    .map((block) => block.innerHTML?.trim())
    .filter(Boolean);
  return blocks.join("\n\n---\n\n");
}

/** @param {any} browser @param {{ location?: unknown }} input */
export async function readCodeInjection(browser, input) {
  const location = String(input?.location || "");
  let code;
  if (location === "page") {
    code = pageCode(browser);
  } else if (CODE_INJECTION_LOCATIONS[location]) {
    const settings = await fetchJson(browser, "/api/config/GetInjectionSettings");
    code = settings?.[CODE_INJECTION_LOCATIONS[location]] || "";
  } else {
    throw new Error(`Choose ${CODE_INJECTION_LOCATION_NAMES.join(", ")}.`);
  }

  const limitedCode = limitCode(code).trim();
  return {
    location,
    code: limitedCode,
    type: codeType(limitedCode),
  };
}
