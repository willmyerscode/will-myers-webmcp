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

## `read_custom_css`

Purpose: let ChatGPT see existing CSS before it proposes new CSS.

Inputs: none.

When the Custom CSS editor is open, the tool returns the current textarea value, including unsaved text. On other editor pages, it reads the saved CSS from Squarespace’s internal `GetTemplateCustomCss` endpoint.

Success output includes `source`, `css`, and the visible Squarespace CSS error when one exists. CSS is limited to 100,000 characters.

Side effects: none. This tool can return private site code.

## `read_code_injection`

Purpose: let ChatGPT see existing injected code before it proposes a component or style.

Input:

- `location`: `header`, `footer`, `page`, `lock-page`, or `post-item`.

The `page` option reads code blocks from the active preview. Other options read Squarespace’s internal `GetInjectionSettings` endpoint.

Success output includes the location, code, and detected `html`, `script`, or `mixed` type. Code is limited to 100,000 characters.

Side effects: none. This tool can return private site code.

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

## `add_text_block`

Purpose: add a plain paragraph to an existing Fluid Engine section.

Inputs:

- `text: string` — required plain text, 1–5,000 characters.
- `section_id: string` — optional Fluid Engine section ID. When omitted, the tool uses the last Fluid Engine section on the page.

The tool refuses to run when the editor has unsaved manual changes. It reads the current page model, puts the new block after the existing section rows on desktop and mobile, and saves the full model through Squarespace’s authenticated page API. It then reads the page again and confirms the new block ID, type, definition, and exact escaped text. The fresh read is the proof that Squarespace kept the block, even when the save response has an error status.

Success output includes `saved`, `pageId`, `sectionId`, `blockId`, `text`, and a note that the editor must reload before a later manual page edit.

Side effect: saves a live page-content change. The tool is not read-only and is not idempotent. ChatGPT must show the exact page, section, and text and get user approval before each call.

Expected failures include a missing sign-in token, a missing page or section, a section that is not Fluid Engine, a rejected Squarespace save, or a fresh read that does not contain the new block.

## `clear_preview`

Purpose: remove the CSS added by `preview_css`.

Inputs: none.

Success output: `cleared` is true when a preview existed and false when there was nothing to remove.

Side effect: removes only the temporary preview style. It does not change saved Squarespace CSS.
