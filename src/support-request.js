import { LIMITS } from "./contracts.js";

export const PENDING_SUPPORT_KEY = "will-myers:webmcp:pending-support-request";

function requiredText(value, field, maxLength) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${field} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function optionalText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length > maxLength) {
    throw new Error(`Optional text must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function webUrl(value, field, required = true) {
  const text = required
    ? requiredText(value, field, LIMITS.url)
    : optionalText(value, LIMITS.url);
  if (!text) return "";

  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${field} must be a valid HTTP or HTTPS URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${field} must be a valid HTTP or HTTPS URL.`);
  }
  return url.href;
}

export function validateSupportRequest(input) {
  const email = requiredText(input?.email, "Email", LIMITS.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be a valid email address.");
  }
  if (typeof input?.is_code_curious_member !== "boolean") {
    throw new Error("Code Curious membership must be true or false.");
  }

  return {
    first_name: requiredText(input.first_name, "First name", LIMITS.firstName),
    last_name: requiredText(input.last_name, "Last name", LIMITS.lastName),
    email,
    is_code_curious_member: input.is_code_curious_member,
    product_or_tutorial_url: webUrl(
      input.product_or_tutorial_url,
      "Product or tutorial URL",
    ),
    website_url: webUrl(input.website_url, "Website URL", false),
    message: requiredText(input.message, "Message", LIMITS.message),
  };
}

export function startSupportRequest(input, browser = window) {
  const request = validateSupportRequest(input);

  if (browser.location.pathname === "/contact" && browser.document) {
    return fillSupportForm(browser.document, request);
  }

  browser.sessionStorage.setItem(PENDING_SUPPORT_KEY, JSON.stringify(request));

  const contactUrl = new URL("/contact", browser.location.href).href;
  browser.location.assign(contactUrl);

  return {
    status: "opening-contact-form",
    contact_url: contactUrl,
    next_step:
      "Review the prepared form, confirm the admin-access statement yourself, and submit only when it is correct.",
  };
}

function normalizeLabel(value) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findFormItem(form, labelText) {
  const wanted = normalizeLabel(labelText);
  return [...form.querySelectorAll(".form-item")].find((item) => {
    const title = item.querySelector(".title")?.textContent || "";
    return normalizeLabel(title).includes(wanted);
  });
}

function setValue(field, value) {
  const view = field.ownerDocument?.defaultView;
  const prototype =
    field.tagName === "TEXTAREA"
      ? view?.HTMLTextAreaElement?.prototype
      : view?.HTMLInputElement?.prototype;
  const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;

  dispatchFieldEvents(field);
}

function dispatchFieldEvents(field) {
  const EventType = field.ownerDocument?.defaultView?.Event || Event;
  field.dispatchEvent(new EventType("input", { bubbles: true }));
  field.dispatchEvent(new EventType("change", { bubbles: true }));
}

function chooseRadio(field) {
  if (field.checked) return;
  if (typeof field.click === "function") field.click();
  if (!field.checked) {
    field.checked = true;
    dispatchFieldEvents(field);
  }
}

function requiredField(field, label) {
  if (!field) throw new Error(`The contact form field '${label}' was not found.`);
  return field;
}

export function fillSupportForm(document, input) {
  const request = validateSupportRequest(input);
  const form = document.querySelector("form.react-form-contents");
  if (!form) throw new Error("The Squarespace support form was not found.");

  const nameItem = findFormItem(form, "name");
  const emailItem = findFormItem(form, "email");
  const memberItem = findFormItem(form, "are you a code curious member");
  const productItem = findFormItem(form, "plugin or tutorial link");
  const websiteItem = findFormItem(form, "share a link to your page");
  const messageItem = findFormItem(form, "how can i help");

  setValue(
    requiredField(nameItem?.querySelector('[name="fname"]'), "First name"),
    request.first_name,
  );
  setValue(
    requiredField(nameItem?.querySelector('[name="lname"]'), "Last name"),
    request.last_name,
  );
  setValue(
    requiredField(emailItem?.querySelector('input[type="email"]'), "Email"),
    request.email,
  );

  const membershipValue = request.is_code_curious_member ? "Yes" : "No";
  const membershipField = [...(memberItem?.querySelectorAll('input[type="radio"]') || [])].find(
    (field) => field.value === membershipValue,
  );
  chooseRadio(requiredField(membershipField, "Code Curious membership"));

  setValue(
    requiredField(productItem?.querySelector('input[type="text"]'), "Plugin or tutorial link"),
    request.product_or_tutorial_url,
  );

  const websiteField = websiteItem?.querySelector('input[type="text"]');
  if (websiteField && request.website_url) setValue(websiteField, request.website_url);

  setValue(
    requiredField(messageItem?.querySelector("textarea"), "How can I help"),
    request.message,
  );

  form.dataset.webmcpPrepared = "true";
  if (typeof form.scrollIntoView === "function") {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return {
    status: "ready-for-review",
    contact_url: document.location?.href || "https://www.will-myers.com/contact",
    filled_fields: [
      "first_name",
      "last_name",
      "email",
      "is_code_curious_member",
      "product_or_tutorial_url",
      ...(request.website_url ? ["website_url"] : []),
      "message",
    ],
    next_step:
      "Review every field, confirm the admin-access statement yourself, and submit only when the form is correct.",
  };
}

export function applyPendingSupportRequest(document, storage) {
  const pending = storage.getItem(PENDING_SUPPORT_KEY);
  if (!pending) return null;

  storage.removeItem(PENDING_SUPPORT_KEY);
  return fillSupportForm(document, JSON.parse(pending));
}
