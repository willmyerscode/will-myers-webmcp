import { copyFile, mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";

const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "SquarespaceWebMCP",
  outfile: "dist/webmcp.js",
  minify: true,
  sourcemap: true,
  target: ["es2022"],
  legalComments: "none",
  banner: {
    js: `/* Squarespace WebMCP v${version} | https://github.com/willmyerscode/will-myers-webmcp */`,
  },
});

await Promise.all(
  ["index.html", "robots.txt", "_headers"].map((file) =>
    copyFile(`public/${file}`, `dist/${file}`),
  ),
);
