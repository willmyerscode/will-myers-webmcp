# Pilot checks

## Automated

Run:

```sh
npm test
npm run check
npm run build
```

## Browser prompts

Use a WebMCP-capable ChatGPT desktop browser on will-myers.com.

1. "Find a plugin that turns a list section into a timeline."
2. "Find a plugin for a large navigation menu. Show three options at most."
3. "Find a product for an unrelated need." Confirm that the response says no close match.
4. "Prepare a support request for the Step Flow Timeline." Supply the required contact details.
5. Confirm that `/contact` opens and the safe fields are filled.
6. Confirm that the admin-access box is empty and the form is not sent.
7. Try an invalid email and a `javascript:` URL. Confirm that the tool rejects both.

## Normal-site fallback

1. Open the site in a browser without WebMCP support.
2. Confirm that the console has no uncaught WebMCP error.
3. Confirm that products, navigation, and the contact form still work normally.

## Rollback

Remove the one `webmcp.js` script tag from Squarespace footer code injection. The pilot has no database, account state, or server-side cleanup.
