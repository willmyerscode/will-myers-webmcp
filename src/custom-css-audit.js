import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

import { allSiteRecords, loadSite } from "./browser-index-storage.js";
import { fetchJson, siteOrigin } from "./squarespace-source.js";

const CUSTOM_CSS_PATH = "/api/template/GetTemplateCustomCss";
const DYNAMIC_PSEUDOS = new Set([":has", ":is", ":not", ":where"]);

function inspectSelector(selectorNode) {
  const references = new Map();
  const add = (kind, id) => references.set(`${kind}:${id}`, { kind, id });
  let dynamic = false;

  selectorNode.walkPseudos((node) => {
    if (DYNAMIC_PSEUDOS.has(node.value.toLowerCase())) dynamic = true;
  });
  selectorNode.walkIds((node) => {
    if (node.value.startsWith("block-")) add("block", node.value);
    if (node.value.startsWith("page-section-")) {
      add("section", node.value.slice("page-section-".length));
    }
  });
  selectorNode.walkAttributes((node) => {
    if (node.operator !== "=" || node.insensitive || !node.value) return;
    if (node.attribute.toLowerCase() === "data-block-id") add("block", node.value);
    if (node.attribute.toLowerCase() === "data-section-id") add("section", node.value);
  });

  return { references: [...references.values()], dynamic };
}

function reasonFor(missing) {
  const kinds = new Set(missing.map(({ kind }) => kind));
  if (kinds.size > 1) return "The indexed site has none of these block or section IDs.";
  if (kinds.has("block")) {
    return missing.length === 1
      ? "The indexed site has no block with this ID."
      : "The indexed site has none of these block IDs.";
  }
  return missing.length === 1
    ? "The indexed site has no section with this ID."
    : "The indexed site has none of these section IDs.";
}

function parseCustomCss(css) {
  try {
    return postcss.parse(css);
  } catch (error) {
    const line = error?.line ? ` at line ${error.line}` : "";
    throw new Error(`Squarespace Custom CSS could not be parsed${line}. ${error.message}`);
  }
}

/** @param {any} browser */
export async function auditCustomCss(browser) {
  if (browser.__squarespaceSiteIndexJob?.status === "running") {
    throw new Error("Wait for index_site to finish before you audit Custom CSS.");
  }
  if (browser.__squarespaceSiteIndexJob?.status === "failed") {
    throw new Error("The last site index failed. Run index_site again before you audit Custom CSS.");
  }

  const origin = siteOrigin(browser);
  const site = await loadSite(browser, origin);
  if (site.indexErrorCount !== 0) {
    throw new Error(
      "The last site index had read errors or is too old to check. Run index_site again before you audit Custom CSS.",
    );
  }
  const records = await allSiteRecords(browser, site.siteId);
  const response = await fetchJson(browser, new URL(CUSTOM_CSS_PATH, origin));
  if (typeof response?.css !== "string") {
    throw new Error("Squarespace did not return Custom CSS text.");
  }

  const blockIds = new Set(
    records.filter(({ kind, blockId }) => kind === "block" && blockId).map(({ blockId }) => blockId),
  );
  const sectionIds = new Set(
    records
      .filter(({ kind, sectionId }) => kind === "section" && sectionId)
      .map(({ sectionId }) => sectionId),
  );
  const candidates = [];
  let dynamicSelectorsSkipped = 0;
  const root = parseCustomCss(response.css);

  root.walkRules((rule) => {
    let selectorRoot;
    try {
      selectorRoot = selectorParser().astSync(rule.selector);
    } catch (error) {
      const line = rule.source?.start?.line;
      throw new Error(
        `A Custom CSS selector could not be parsed${line ? ` at line ${line}` : ""}. ${error.message}`,
      );
    }
    const assessments = selectorRoot.nodes.map((selectorNode) => {
      const value = selectorNode.toString().trim();
      const { references, dynamic } = inspectSelector(selectorNode);
      if (references.length === 0) return { selector: value, candidate: false };
      if (dynamic) {
        dynamicSelectorsSkipped += 1;
        return { selector: value, candidate: false };
      }

      const missing = references.filter(({ kind, id }) =>
        kind === "block" ? !blockIds.has(id) : !sectionIds.has(id),
      );
      return { selector: value, candidate: missing.length > 0, missing };
    });
    const ruleCanBeRemoved = assessments.length > 0 && assessments.every(({ candidate }) => candidate);

    for (const assessment of assessments) {
      if (!assessment.candidate) continue;
      candidates.push({
        selector: assessment.selector,
        line: rule.source?.start?.line || null,
        action: ruleCanBeRemoved ? "remove_rule" : "remove_selector",
        missing: assessment.missing,
        reason: reasonFor(assessment.missing),
      });
    }
  });

  return {
    siteId: site.siteId,
    source: CUSTOM_CSS_PATH,
    cssCharacters: response.css.length,
    candidateCount: candidates.length,
    dynamicSelectorsSkipped,
    candidates,
    warning:
      "This check only finds static Squarespace block and section IDs that are absent from the local index. It does not prove that other selectors are unused. Review every candidate before you change Custom CSS.",
  };
}
