import { getEditorContext } from "./editor-context.js";
import { TOOL_LIMITS } from "./limits.js";
import { getPageModel, savePageModel } from "./squarespace-page-api.js";

const FLUID_ENGINE_COMPONENT_TYPE = 1337;
const TEXT_BLOCK_ROWS = 2;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function randomHex(browser, length = 24) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  browser.crypto?.getRandomValues?.(bytes);
  if (bytes.every((byte) => byte === 0)) {
    throw new Error("This browser cannot create a safe block ID.");
  }
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

function stickyScroll() {
  return {
    enabled: false,
    position: "top",
    offset: { unit: "px", value: 0 },
  };
}

function containerStyles() {
  const zero = { unit: "px", value: 0 };
  return {
    backgroundEnabled: false,
    borderRadii: {
      topLeft: { ...zero },
      topRight: { ...zero },
      bottomLeft: { ...zero },
      bottomRight: { ...zero },
    },
    padding: {
      top: { unit: "%", value: 6 },
      right: { unit: "%", value: 6 },
      bottom: { unit: "%", value: 6 },
      left: { unit: "%", value: 6 },
    },
    stretchedToFill: false,
    backgroundColor: { type: "THEME_COLOR" },
    stroke: {
      style: "none",
      color: { type: "THEME_COLOR" },
      thickness: { unit: "px", value: 6 },
      dashLength: { unit: "px", value: 5 },
      gapLength: { unit: "px", value: 15 },
      linecap: "square",
    },
    blendMode: "normal",
    blur: {
      enabled: false,
      filterType: "backdrop",
      blurRadius: { unit: "px", value: 15 },
    },
  };
}

function maxZIndex(gridContents) {
  return gridContents.reduce(
    (highest, item) => Math.max(highest, item?.layout?.desktop?.zIndex || 0),
    0,
  );
}

function findFluidSection(pageModel, sectionId) {
  const sections = (pageModel?.regions || []).flatMap((region) => region.sections || []);
  if (sectionId) {
    const section = sections.find((candidate) => candidate.id === sectionId);
    if (!section) throw new Error(`Section ${sectionId} was not found on this page.`);
    if (section.sectionName !== "FLUID_ENGINE") {
      throw new Error(`Section ${sectionId} is not a Fluid Engine section.`);
    }
    return section;
  }

  const section = sections.findLast(
    (candidate) => candidate.sectionName === "FLUID_ENGINE",
  );
  if (!section) throw new Error("This page has no Fluid Engine section.");
  return section;
}

function assertEditorIsClean(browser) {
  const saveButton = browser.document?.querySelector?.(
    '[data-test="frameToolbarSave"]',
  );
  if (!saveButton) {
    throw new Error(
      "The page editor is not ready. Click Edit, wait for the Save button, then retry.",
    );
  }
  if (!saveButton.disabled) {
    throw new Error(
      "The Squarespace editor has unsaved manual changes. Save or discard them before this tool runs.",
    );
  }
}

/** @param {any} browser @param {{ text?: unknown, section_id?: unknown }} input */
export async function addTextBlock(browser, input) {
  const text = String(input?.text || "").trim();
  if (!text) throw new Error("Text is required.");
  if (text.length > TOOL_LIMITS.textBlockCharacters) {
    throw new Error(`Text must be ${TOOL_LIMITS.textBlockCharacters} characters or fewer.`);
  }
  assertEditorIsClean(browser);

  const pageId = getEditorContext(browser).page.id;
  if (!pageId) throw new Error("The current Squarespace page ID is not available.");

  const pageModel = await getPageModel(browser, pageId);
  const sectionId = input?.section_id ? String(input.section_id) : null;
  const section = findFluidSection(pageModel, sectionId);
  const context = section.fluidEngineContext;
  if (!context?.gridSettings?.breakpointSettings) {
    throw new Error(`Section ${section.id} has no Fluid Engine grid.`);
  }

  const gridContents = context.gridContents || (context.gridContents = []);
  const desktop = context.gridSettings.breakpointSettings.desktop;
  const mobile = context.gridSettings.breakpointSettings.mobile;
  const desktopStartY = Number(desktop.rows) || 0;
  const mobileStartY = Number(mobile.rows) || 0;
  const desktopEndY = desktopStartY + TEXT_BLOCK_ROWS;
  const mobileEndY = mobileStartY + TEXT_BLOCK_ROWS;
  const blockId = randomHex(browser);
  const zIndex = maxZIndex(gridContents) + 1;
  const html = `<p style="white-space:pre-wrap;">${escapeHtml(text)}</p>`;

  gridContents.push({
    layout: {
      desktop: {
        start: { x: 2, y: desktopStartY },
        end: { x: 23, y: desktopEndY },
        verticalAlignment: "top",
        visible: true,
        stickyScroll: stickyScroll(),
        zIndex,
      },
      mobile: {
        start: { x: 1, y: mobileStartY },
        end: { x: 8, y: mobileEndY },
        verticalAlignment: "top",
        visible: true,
        stickyScroll: stickyScroll(),
        zIndex,
      },
    },
    content: {
      value: {
        id: blockId,
        type: FLUID_ENGINE_COMPONENT_TYPE,
        value: {
          html,
          source: html,
          engine: "wysiwyg",
          textAttributes: [],
          containerStyles: containerStyles(),
        },
        definitionName: "website.components.html",
      },
    },
  });

  desktop.rows = desktopEndY + 1;
  mobile.rows = mobileEndY + 1;
  const estimated = section.childrenEstimatedLayouts || (section.childrenEstimatedLayouts = []);
  estimated.push({
    refId: blockId,
    breakpointLayouts: [
      { breakpointId: "system_desktop", width: { unit: "vw", value: 87.5 } },
      { breakpointId: "system_mobile", width: { unit: "vw", value: 100 } },
    ],
  });

  assertEditorIsClean(browser);
  let saveResponse = null;
  let saveError = null;
  try {
    saveResponse = await savePageModel(browser, pageId, pageModel);
  } catch (error) {
    saveError = error;
  }

  let savedModel;
  try {
    savedModel = await getPageModel(browser, pageId);
  } catch (error) {
    const status = saveResponse?.status ?? "no response";
    throw new Error(
      `Squarespace returned ${status} for the save, and the result could not be checked. Reload the editor and check the page before retrying. ${error.message}`,
    );
  }
  const savedSection = findFluidSection(savedModel, section.id);
  const savedBlock = savedSection.fluidEngineContext?.gridContents?.find(
    (item) => item?.content?.value?.id === blockId,
  );
  const savedValue = savedBlock?.content?.value;
  if (
    savedValue?.type !== FLUID_ENGINE_COMPONENT_TYPE ||
    savedValue?.definitionName !== "website.components.html" ||
    savedValue?.value?.html !== html ||
    savedValue?.value?.source !== html
  ) {
    const status = saveResponse?.status ?? "no response";
    throw new Error(
      `Squarespace returned ${status}, but the exact text block was not found. Reload the editor and check the page before retrying.${saveError ? " The save request also lost its response." : ""}`,
    );
  }

  return {
    saved: true,
    pageId,
    sectionId: section.id,
    blockId,
    text,
    saveStatus: saveResponse?.status ?? null,
    note: "The block is saved. Reload the Squarespace editor before another manual page edit.",
  };
}
