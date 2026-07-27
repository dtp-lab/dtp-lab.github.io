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

const pages = new Map([
  ["index", "index.html"],
  ["people", "people/index.html"],
  ["projects", "projects/index.html"],
  ["publications", "publications/index.html"],
  ["seminars", "seminars/index.html"],
  ["gallery", "gallery/index.html"],
  ["archive", "archive.html"],
  ["alignment-lab", "alignment-lab.html"],
]);
for (const [page, outputPath] of pages) {
  const template = path.join(templateDir, `${page}.ejs`);
  const output = path.join(outputDir, outputPath);
  const html = await ejs.renderFile(template, {});
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html, "utf8");
}

const expectedHtml = new Set(pages.values());
const pruneStaleHtml = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await pruneStaleHtml(absolute);
    else if (entry.isFile() && entry.name.endsWith(".html")) {
      const relative = path.relative(outputDir, absolute).replaceAll("\\", "/");
      if (!expectedHtml.has(relative)) await fs.rm(absolute, { force: true });
    }
  }
};
await pruneStaleHtml(outputDir);

console.log(`Built ${pages.size} pages in ${path.relative(rootDir, outputDir)}.`);
