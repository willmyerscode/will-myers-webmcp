import { copyFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "WillMyersWebMCP",
  outfile: "dist/webmcp.js",
  minify: true,
  sourcemap: true,
  target: ["es2022"],
  legalComments: "none",
  banner: {
    js: "/* Will Myers WebMCP v0.1.0 | https://github.com/willmyerscode/will-myers-webmcp */",
  },
});

await Promise.all(
  ["index.html", "robots.txt", "_headers"].map((file) =>
    copyFile(`public/${file}`, `dist/${file}`),
  ),
);
