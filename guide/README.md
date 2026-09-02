# User guide

This folder contains the public documentation for Squarespace WebMCP. The project is an early alpha. It is for testing read-only tools with Codex, not for production infrastructure.

Start with the [Custom CSS walkthrough in the main README](../README.md#try-a-custom-css-review).

Use these pages when you need more detail:

- [Tool reference](tools.md) explains each WebMCP tool, its inputs, and its result.
- [How it works](how-it-works.md) explains the editor bridge, local site index, network requests, and unsupported Squarespace interfaces.
- [Risks and limitations](risks-and-limitations.md) explains browser support, storage, performance, privacy, and removal.

## What the project does

The current tools can:

- build a local index of the current Squarespace site;
- search that index;
- refresh one indexed record;
- read Custom CSS;
- read site-wide Code Injection.

Every tool is read-only. The tools do not edit pages, CSS, code, settings, or metadata.

## What the agent does

The tools return site data. Codex interprets that data when you ask a question. For example, `read_site_custom_css` returns CSS text. It does not decide which rules are safe to remove.

Treat each answer as a suggestion. Check the site yourself before you remove code or content.
