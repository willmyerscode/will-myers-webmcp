import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import {
  applyPendingSupportRequest,
  fillSupportForm,
  PENDING_SUPPORT_KEY,
  startSupportRequest,
  validateSupportRequest,
} from "../src/support-request.js";

const validRequest = {
  first_name: "Jamie",
  last_name: "Rivera",
  email: "jamie@example.com",
  is_code_curious_member: false,
  product_or_tutorial_url:
    "https://www.will-myers.com/products/p/step-flow-timeline",
  website_url: "https://example.com/problem-page",
  message: "The timeline stops after the second item.",
};

test("start_support_request saves a safe draft and opens the contact page", () => {
  const saved = new Map();
  const navigations = [];
  const browser = {
    location: {
      href: "https://www.will-myers.com/products/p/step-flow-timeline",
      pathname: "/products/p/step-flow-timeline",
      assign(url) {
        navigations.push(url);
      },
    },
    sessionStorage: {
      setItem(key, value) {
        saved.set(key, value);
      },
    },
  };

  const result = startSupportRequest(validRequest, browser);

  assert.equal(navigations.length, 1);
  assert.equal(navigations[0], "https://www.will-myers.com/contact");
  assert.deepEqual(JSON.parse(saved.get(PENDING_SUPPORT_KEY)), validRequest);
  assert.equal(result.status, "opening-contact-form");
  assert.match(result.next_step, /review/i);
  assert.equal("submit" in result, false);
});

test("start_support_request rejects unsafe or incomplete input", () => {
  assert.throws(
    () => validateSupportRequest({ ...validRequest, email: "not-an-email" }),
    /valid email/i,
  );
  assert.throws(
    () =>
      validateSupportRequest({
        ...validRequest,
        product_or_tutorial_url: "javascript:alert(1)",
      }),
    /http or https/i,
  );
  assert.throws(
    () => validateSupportRequest({ ...validRequest, message: "" }),
    /message/i,
  );
});

test("the contact-page draft fills safe fields but never confirms or submits", () => {
  const { document } = parseHTML(`
    <form class="react-form-contents">
      <div class="form-item name">
        <div class="title">Name</div>
        <input name="fname"><input name="lname">
      </div>
      <div class="form-item email"><div class="title">Email (required)</div><input type="email"></div>
      <div class="form-item radio">
        <div class="title">Are you a Code Curious member? (required)</div>
        <input type="radio" value="Yes"><input type="radio" value="No">
      </div>
      <div class="form-item product"><div class="title">Plugin or Tutorial Link (required)</div><input type="text"></div>
      <div class="form-item website"><div class="title">Share a link to your page</div><input type="text"></div>
      <div class="form-item admin">
        <div class="title">IMPORTANT - Admin access may be needed (required)</div>
        <input type="checkbox" value="I confirm">
      </div>
      <div class="form-item message"><div class="title">How can I help? (required)</div><textarea></textarea></div>
      <button type="submit">Submit</button>
    </form>
  `);
  let submitted = false;
  document.querySelector("form").addEventListener("submit", () => {
    submitted = true;
  });

  const result = fillSupportForm(document, validRequest);

  assert.equal(document.querySelector('[name="fname"]').value, "Jamie");
  assert.equal(document.querySelector('[name="lname"]').value, "Rivera");
  assert.equal(document.querySelector('input[type="email"]').value, "jamie@example.com");
  assert.equal(document.querySelector('input[value="No"]').checked, true);
  assert.equal(document.querySelector(".product input").value, validRequest.product_or_tutorial_url);
  assert.equal(document.querySelector(".website input").value, validRequest.website_url);
  assert.equal(document.querySelector("textarea").value, validRequest.message);
  assert.equal(Boolean(document.querySelector('.admin input[type="checkbox"]').checked), false);
  assert.equal(submitted, false);
  assert.equal(result.status, "ready-for-review");
});

test("a failed contact-page fill deletes the saved personal draft", () => {
  const { document } = parseHTML("<main>No support form</main>");
  const saved = new Map([[PENDING_SUPPORT_KEY, JSON.stringify(validRequest)]]);
  const storage = {
    getItem(key) {
      return saved.get(key) || null;
    },
    removeItem(key) {
      saved.delete(key);
    },
  };

  assert.throws(
    () => applyPendingSupportRequest(document, storage),
    /support form was not found/i,
  );
  assert.equal(saved.has(PENDING_SUPPORT_KEY), false);
});
