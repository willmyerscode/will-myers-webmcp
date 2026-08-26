export const LIMITS = Object.freeze({
  productQuery: 200,
  maxResultsMin: 1,
  maxResultsMax: 10,
});

export const FIND_PRODUCTS_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: LIMITS.productQuery,
      description:
        "Product name, website feature, or design goal. Examples: mega menu, image slider, timeline.",
    },
    max_results: {
      type: "integer",
      minimum: LIMITS.maxResultsMin,
      maximum: LIMITS.maxResultsMax,
      default: 5,
      description: "Maximum number of matching products to return.",
    },
  },
  required: ["query"],
  additionalProperties: false,
};
