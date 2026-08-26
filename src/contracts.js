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
      maxLength: 500,
      description:
        "CSS selector for one section, block, or element in the active Squarespace preview.",
    },
  },
  required: ["selector"],
  additionalProperties: false,
};

export const PREVIEW_CSS_SCHEMA = {
  type: "object",
  properties: {
    css: {
      type: "string",
      minLength: 1,
      maxLength: 50_000,
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

// Keep the retired pilot service valid while its Worker endpoint remains deployed.
export const LIMITS = Object.freeze({
  productQuery: 200,
  maxResultsMin: 1,
  maxResultsMax: 10,
});
