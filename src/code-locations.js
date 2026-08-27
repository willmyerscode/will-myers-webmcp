export const CODE_INJECTION_LOCATIONS = Object.freeze({
  header: "header",
  footer: "footer",
  page: null,
  "lock-page": "lockPage",
  "post-item": "postItem",
});

export const CODE_INJECTION_LOCATION_NAMES = Object.freeze(
  Object.keys(CODE_INJECTION_LOCATIONS),
);
