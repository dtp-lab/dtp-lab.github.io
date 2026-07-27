import fs from "node:fs";
import path from "node:path";

const requestedDir = process.argv[2] || "_site";
const siteDir = path.resolve(requestedDir);
if (!fs.existsSync(siteDir)) {
  console.error(`Link and markup check failed: directory does not exist (${requestedDir})`);
  process.exit(1);
}
const pages = [];
const collectPages = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectPages(absolute);
    else if (entry.isFile() && entry.name.endsWith(".html")) pages.push(path.relative(siteDir, absolute));
  }
};
collectPages(siteDir);
const errors = [];
for (const page of pages) {
  const html = fs.readFileSync(path.join(siteDir, page), "utf8");
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:|javascript:)/i.test(value)) continue;
    const file = value.split(/[?#]/)[0];
    if (!file) continue;
    const resolved = value.startsWith("/")
      ? path.resolve(siteDir, `.${file}`)
      : path.resolve(path.dirname(path.join(siteDir, page)), file);
    const candidate = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
      ? path.join(resolved, "index.html")
      : resolved;
    const sitePrefix = `${siteDir}${path.sep}`;
    if ((candidate !== siteDir && !candidate.startsWith(sitePrefix)) || !fs.existsSync(candidate)) errors.push(`${page}: missing ${value}`);
  }
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const isArchive = page === "archive.html";
  if (!isArchive && h1Count !== 1) errors.push(`${page}: expected one H1, found ${h1Count}`);
  if (!isArchive && !/<head>[\s\S]*<\/head>/i.test(html)) errors.push(`${page}: missing rendered head`);
  if (!isArchive && !/<header class="site-header"/i.test(html)) errors.push(`${page}: missing rendered header`);
  if (!isArchive && !/<footer class="site-footer"/i.test(html)) errors.push(`${page}: missing rendered footer`);
  if (html.includes("[object Promise]")) errors.push(`${page}: unresolved EJS include promise`);
}
if (errors.length) { console.error(`Link and markup check failed (${errors.length})`); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1); }
console.log(`Link and markup check passed for ${pages.length} HTML pages.`);
