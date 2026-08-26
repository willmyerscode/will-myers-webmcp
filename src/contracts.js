import { TOOL_LIMITS } from "./limits.js";
import { CODE_INJECTION_LOCATION_NAMES } from "./code-locations.js";

export const GET_EDITOR_CONTEXT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const INSPECT_TARGET_SCHEMA = {
  type: "object",
  properties: {
    selector: {
      type: "string",
      minLength: 1,
      maxLength: TOOL_LIMITS.selectorCharacters,
      description:
        "CSS selector for one section, block, or element in the active Squarespace preview.",
    },
  },
  required: ["selector"],
  additionalProperties: false,
};

export const READ_CUSTOM_CSS_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const READ_CODE_INJECTION_SCHEMA = {
  type: "object",
  properties: {
    location: {
      type: "string",
      enum: CODE_INJECTION_LOCATION_NAMES,
      description: "Squarespace code area to read.",
    },
  },
  required: ["location"],
  additionalProperties: false,
};

export const ADD_TEXT_BLOCK_SCHEMA = {
  type: "object",
  properties: {
    text: {
      type: "string",
      minLength: 1,
      maxLength: TOOL_LIMITS.textBlockCharacters,
      description: "Plain text for the new paragraph block.",
    },
    section_id: {
      type: "string",
      minLength: 1,
      maxLength: 200,
      description:
        "Optional Fluid Engine section ID from get_editor_context. If omitted, the last Fluid Engine section is used.",
    },
  },
  required: ["text"],
  additionalProperties: false,
};

export const PREVIEW_CSS_SCHEMA = {
  type: "object",
  properties: {
    css: {
      type: "string",
      minLength: 1,
      maxLength: TOOL_LIMITS.cssCharacters,
      description:
        "CSS to apply only to the current Squarespace preview. Use section and block IDs from get_editor_context.",
    },
  },
  required: ["css"],
  additionalProperties: false,
};

export const CLEAR_PREVIEW_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
