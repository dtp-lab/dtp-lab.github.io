import fs from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";

const rootDir = path.resolve(".");
const assetDir = path.join(rootDir, "site");
const templateDir = path.join(rootDir, "templates", "pages");
const outputDir = path.join(rootDir, "_site");

if (path.dirname(outputDir) !== rootDir) throw new Error("Refusing to build outside the repository root");

await fs.mkdir(outputDir, { recursive: true });
await fs.cp(assetDir, outputDir, {
  recursive: true,
  filter: (source) => path.extname(source).toLowerCase() !== ".html",
});

const pages = ["index", "people", "projects", "publications", "seminars", "gallery", "archive"];
for (const page of pages) {
  const template = path.join(templateDir, `${page}.ejs`);
  const output = path.join(outputDir, `${page}.html`);
  const html = await ejs.renderFile(template, {});
  await fs.writeFile(output, html, "utf8");
}

console.log(`Built ${pages.length} pages in ${path.relative(rootDir, outputDir)}.`);
