# Pilot tool contracts

## `find_products`

Purpose: help a visitor find a relevant Will Myers product without buying it.

Inputs:

- `query` — required text, 1–200 characters.
- `max_results` — optional integer, 1–10, default 5.

Output:

- The original query.
- Match count.
- Product ID, title, summary, current public price, sale state, license type, and public URL.
- A short next-step note.

Side effects: none. The tool reads `/products?format=json` from the current site.

Failure messages cover an empty or long query, a bad catalog response, a missing item list, and no close matches.

## `start_support_request`

Purpose: prepare the current public Squarespace support form for human review.

Required inputs:

- `first_name`
- `last_name`
- `email`
- `is_code_curious_member`
- `product_or_tutorial_url`
- `message`

Optional input:

- `website_url`

Side effects:

- On another page, stores the validated draft in the current tab's `sessionStorage` and opens `/contact`.
- On `/contact`, fills the matching safe fields and scrolls the form into view.
- Does not fill the site password.
- Does not check the admin-access confirmation.
- Does not submit the form.

Failure messages cover missing fields, invalid email or URL values, long input, and a changed or missing form field.
