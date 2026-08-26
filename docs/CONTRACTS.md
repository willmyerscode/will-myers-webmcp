# Tool contracts

## `get_editor_context`

Purpose: give ChatGPT a small, current map of the active Squarespace Editor page before it designs or changes a component.

Inputs: none.

Success output:

- `editor`: editor status and URL.
- `site`: site ID, title, base URL, and internal URL.
- `page`: page ID, title, Squarespace type, and preview URL.
- `template`: template ID and version.
- `design.colors`: available Squarespace palette names and HSL values.
- `design.fonts`: heading, body, and metadata font families.
- `structure`: page-section IDs, themes, block IDs, block types, and short visible text.

The structure excludes the site footer. It returns at most 50 sections, 100 blocks per section, and 240 text characters per block.

Side effects: none. The tool reads the active `#sqs-site-frame` document. It does not fetch the Squarespace API, save content, or change page styles.

Failures use a short JavaScript error. The expected failure is that the active Squarespace preview is not available.

## `inspect_target`

Purpose: give ChatGPT the exact page details it needs before it writes CSS.

Input:

- `selector: string` — required CSS selector, 1–500 characters.

Success output includes the match count and the first matching element’s tag, ID, classes, section ID, block ID, visible text, clean HTML, box size, and important computed styles.

The clean HTML removes scripts and styles and is limited to 20,000 characters. Visible text is limited to 2,000 characters.

Side effects: none.

## `preview_css`

Purpose: let ChatGPT show a proposed design inside the active Squarespace preview before the user saves any code.

Input:

- `css: string` — required, 1–50,000 characters.

The tool rejects `@import` and `url()` so preview CSS cannot load an external file.

Success output:

- `applied: true`
- `bytes`: UTF-8 size of the CSS.
- `pageId`: active Squarespace page ID.
- `note`: confirms that Squarespace was not saved.

Side effect: replaces one temporary `<style>` element in the preview frame. Reloading the page removes it.

## `clear_preview`

Purpose: remove the CSS added by `preview_css`.

Inputs: none.

Success output: `cleared` is true when a preview existed and false when there was nothing to remove.

Side effect: removes only the temporary preview style. It does not change saved Squarespace CSS.
