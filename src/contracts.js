export const LIMITS = Object.freeze({
  productQuery: 200,
  maxResultsMin: 1,
  maxResultsMax: 10,
  firstName: 100,
  lastName: 100,
  email: 254,
  url: 2048,
  message: 5000,
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

export const START_SUPPORT_SCHEMA = {
  type: "object",
  properties: {
    first_name: { type: "string", minLength: 1, maxLength: LIMITS.firstName },
    last_name: { type: "string", minLength: 1, maxLength: LIMITS.lastName },
    email: {
      type: "string",
      format: "email",
      maxLength: LIMITS.email,
      description: "Reply address for the support request.",
    },
    is_code_curious_member: {
      type: "boolean",
      description: "Whether the visitor is a Code Curious member.",
    },
    product_or_tutorial_url: {
      type: "string",
      format: "uri",
      maxLength: LIMITS.url,
      description: "Public Will Myers product, tutorial, article, or code-snippet URL.",
    },
    website_url: {
      type: "string",
      format: "uri",
      maxLength: LIMITS.url,
      description: "Optional public or password-protected page that shows the problem.",
    },
    message: {
      type: "string",
      minLength: 1,
      maxLength: LIMITS.message,
      description: "A clear description of the problem and the expected result.",
    },
  },
  required: [
    "first_name",
    "last_name",
    "email",
    "is_code_curious_member",
    "product_or_tutorial_url",
    "message",
  ],
  additionalProperties: false,
};
