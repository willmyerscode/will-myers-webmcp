# Squarespace WebMCP

Squarespace WebMCP gives Codex read-only tools for the Squarespace site open in your editor. It uses [WebMCP](https://learn.chatgpt.com/docs/webmcp), so you can work through your ChatGPT account without an OpenAI API key.

> [!CAUTION]
> This project is an early alpha for testing. It uses unsupported Squarespace endpoints that can change without notice. Do not use it as production infrastructure. Review every answer before you change your site.

## Try a Custom CSS review

This is the first use case for the project. Codex reads your Custom CSS and your local site index, then helps you find CSS that may no longer be needed. The WebMCP tools only read data. Codex makes the judgment.

### 1. Install the script

You need a Squarespace site and a WebMCP agent. This project is tested with Codex in its built-in browser.

Open the Squarespace Code Injection panel. Paste this line into **Footer**, then save:

```html
<script defer src="https://cdn.jsdelivr.net/gh/willmyerscode/will-myers-webmcp@0.6.0-alpha.4/dist/webmcp.js"></script>
```

This link is pinned to alpha.4. Later changes to `main` will not change the installed file.

### 2. Open the site tools

1. Open your signed-in Squarespace editor in the Codex built-in browser.
2. Open the site you want to review.
3. Open **Site tools** in the browser address bar.

### 3. Ask Codex

Try this prompt:

> Index this Squarespace site and wait for the index to finish. Read my Custom CSS. Use the site index to find CSS that may no longer be needed. Explain the evidence and possible mistakes. Do not change anything.

The review can have false positives. CSS may appear only in a mobile menu, hover state, pop-up, store page, member area, or another temporary state.

## Learn more

- [User guide](guide/README.md)
- [Tool reference](guide/tools.md)
- [How the index and WebMCP bridge work](guide/how-it-works.md)
- [Risks, browser support, and local storage](guide/risks-and-limitations.md)

Squarespace explains [how to use Footer Code Injection](https://support.squarespace.com/hc/en-us/articles/205815908-Using-code-injection). Squarespace does not support custom code installed this way.

## License

[MIT](LICENSE) © Will Myers
