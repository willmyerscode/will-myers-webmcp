function readCookie(document, name) {
  const prefix = `${name}=`;
  const part = String(document?.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return part.slice(prefix.length);
  }
}

function pageUrl(browser, pageId) {
  const origin = new URL(browser.location.href).origin;
  return new URL(
    `/api/pages/by-collection-id/${encodeURIComponent(pageId)}`,
    origin,
  );
}

function requestHeaders(browser, additional = {}) {
  const crumb = readCookie(browser.document, "crumb");
  if (!crumb) {
    throw new Error("Squarespace did not provide a save token. Sign in again, then retry.");
  }
  return {
    Accept: "application/json",
    "X-CSRF-Token": crumb,
    ...additional,
  };
}

/** @param {any} browser @param {string} pageId */
export async function getPageModel(browser, pageId) {
  const response = await browser.fetch(pageUrl(browser, pageId), {
    credentials: "same-origin",
    headers: requestHeaders(browser),
  });
  if (!response.ok) {
    throw new Error(`Squarespace returned HTTP ${response.status}. The page could not be read.`);
  }
  return response.json();
}

/** @param {any} browser @param {string} pageId @param {unknown} pageModel */
export async function savePageModel(browser, pageId, pageModel) {
  return browser.fetch(pageUrl(browser, pageId), {
    method: "PUT",
    credentials: "same-origin",
    headers: requestHeaders(browser, { "Content-Type": "application/json" }),
    body: JSON.stringify(pageModel),
  });
}
