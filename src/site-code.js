import { fetchJson, siteOrigin } from "./squarespace-source.js";

const CUSTOM_CSS_PATH = "/api/template/GetTemplateCustomCss";
const CODE_INJECTION_PATH = "/api/config/GetInjectionSettings";

/** @param {any} browser */
export async function readSiteCustomCss(browser) {
  const response = await fetchJson(browser, new URL(CUSTOM_CSS_PATH, siteOrigin(browser)));
  if (typeof response?.css !== "string") {
    throw new Error("Squarespace did not return Custom CSS text.");
  }
  return { source: CUSTOM_CSS_PATH, css: response.css };
}

/** @param {any} browser */
export async function readSiteCodeInjection(browser) {
  const response = await fetchJson(browser, new URL(CODE_INJECTION_PATH, siteOrigin(browser)));
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Squarespace did not return Code Injection settings.");
  }
  return { source: CODE_INJECTION_PATH, ...response };
}
