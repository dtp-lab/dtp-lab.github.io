import fs from "node:fs/promises";
import path from "node:path";
import ejs from "ejs";

const rootDir = path.resolve(".");
const assetDir = path.join(rootDir, "site");
const templateDir = path.join(rootDir, "templates", "pages");
const outputDir = path.join(rootDir, "_site");
const distDir = path.join(rootDir, "dist");
const clientDir = path.join(distDir, "client");
const serverDir = path.join(distDir, "server");
const workerEntry = path.join(rootDir, "worker", "index.js");

for (const directory of [outputDir, distDir]) {
  if (path.dirname(directory) !== rootDir) throw new Error("Refusing to build outside the repository root");
}

await fs.rm(distDir, { recursive: true, force: true });
await Promise.all([
  fs.mkdir(outputDir, { recursive: true }),
  fs.mkdir(clientDir, { recursive: true }),
  fs.mkdir(serverDir, { recursive: true }),
]);
await Promise.all(
  [outputDir, clientDir].map((destination) => fs.cp(assetDir, destination, {
    recursive: true,
    filter: (source) => path.extname(source).toLowerCase() !== ".html",
  })),
);

const pages = ["index", "people", "projects", "publications", "seminars", "gallery", "archive"];
for (const page of pages) {
  const template = path.join(templateDir, `${page}.ejs`);
  const html = await ejs.renderFile(template, {});
  await Promise.all([
    fs.writeFile(path.join(outputDir, `${page}.html`), html, "utf8"),
    fs.writeFile(path.join(clientDir, `${page}.html`), html, "utf8"),
  ]);
}
await fs.copyFile(workerEntry, path.join(serverDir, "index.js"));

console.log(`Built ${pages.length} pages in ${path.relative(rootDir, outputDir)} and ${path.relative(rootDir, distDir)}.`);
