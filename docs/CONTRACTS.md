# Pilot tool contracts

## `find_products`

Purpose: help a visitor find a relevant Will Myers product without buying it.

Inputs:

- `query: string` — required after trimming, 1–200 characters.
- `max_results?: integer` — optional, 1–10, default 5. Strings, fractions, zero, and values above 10 are errors.

Success output:

- `query: string` — the trimmed query.
- `count: number` — the number of returned matches.
- `products: Product[]` — up to `max_results` matches.
- `note: string` — the next step or a no-match message.

Each `Product` has:

- `id: string`
- `title: string`
- `summary: string` — plain text made from the public HTML excerpt.
- `price: { currency: string, value: string } | null`
- `onSale: boolean`
- `url: string` — an absolute public product URL.

Side effects: none. The tool reads `/products?format=json` from the current site.

Mapped public source fields are `items[].id`, `title`, `excerpt`, `priceMoney.currency`, `priceMoney.value`, `onSale`, `fullUrl`, and `tags`. These were present in the live public response on August 26, 2026. The tool does not infer a license field. License words remain visible in the public product title.

Failures throw a JavaScript `Error` with a short public message. Failure cases are a non-text, empty, or long query; an invalid `max_results`; a failed catalog HTTP response; an empty item list; a response without `items`; or an item without `id`, `title`, or `fullUrl`. No close match is a successful result with `count: 0` and an empty `products` list.

## `start_support_request`

Purpose: prepare the current public Squarespace support form for human review.

Required inputs:

- `first_name: string` — 1–100 characters after trimming.
- `last_name: string` — 1–100 characters after trimming.
- `email: string` — 1–254 characters and a basic valid email shape.
- `is_code_curious_member: boolean`
- `product_or_tutorial_url: string` — an HTTP or HTTPS URL, up to 2,048 characters.
- `message: string` — 1–5,000 characters after trimming.

Optional input:

- `website_url?: string` — an HTTP or HTTPS URL, up to 2,048 characters.

Live Squarespace form map, recorded on August 26, 2026:

| Visible field | Live state | Tool behavior |
| --- | --- | --- |
| First Name | Required text | Fill from `first_name`. |
| Last Name | Required text | Fill from `last_name`. |
| Email | Required email | Fill from `email`. |
| Sign up to the newsletter | Optional checkbox | Leave unchanged. |
| Are you a Code Curious member? | Required Yes/No radio | Select from `is_code_curious_member`. |
| Plugin or Tutorial Link | Required text/URL | Fill from `product_or_tutorial_url`. |
| Share a link to your page | Optional text/URL | Fill only when `website_url` is present. |
| Site password | Optional text | Never fill. The tool does not accept a password. |
| Admin access confirmation | Required checkbox | Never check. The visitor must make this statement. |
| How can I help? | Required long text | Fill from `message`. |
| Invisible reCAPTCHA | Squarespace-managed validation | Leave to the normal form flow. |
| Submit | User action | Never press or call programmatically. |

Squarespace also renders a hidden bot-trap text field. The tool never fills it. The visible required state is stored in Squarespace form wrappers; the rendered controls do not use the native HTML `required` attribute.

Success output before navigation:

- `status: "opening-contact-form"`
- `contact_url: string`
- `next_step: string`

Success output on `/contact`:

- `status: "ready-for-review"`
- `contact_url: string`
- `filled_fields: string[]`
- `next_step: string`

Side effects:

- On another page, stores the validated draft in the current tab's `sessionStorage` and opens `/contact`.
- On `/contact`, fills the matching safe fields and scrolls the form into view.
- Does not fill the site password.
- Does not check the admin-access confirmation.
- Does not submit the form.

Failures throw a JavaScript `Error` with a short public message. Failure cases are missing fields, wrong types, invalid email or URL values, long input, a missing form, or a changed required form field. When `/contact` reads a saved draft, it deletes the `sessionStorage` copy before it tries to fill the form. A fill failure therefore does not keep the visitor's personal draft. The normal form remains available for manual use.
