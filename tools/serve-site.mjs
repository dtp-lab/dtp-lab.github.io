import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const rootDir = path.resolve(process.argv[2] || "_site");
const port = Number(process.argv[3] || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  else if (pathname.endsWith("/")) pathname = `${pathname}index.html`;
  const filePath = path.resolve(rootDir, `.${pathname}`);
  const rootPrefix = `${rootDir}${path.sep}`;
  if (filePath !== rootDir && !filePath.startsWith(rootPrefix)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  if (!path.extname(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    response.writeHead(308, { Location: `${url.pathname}/${url.search}` });
    response.end();
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code || "Error");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    if (request.method === "HEAD") response.end();
    else response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${rootDir} at http://127.0.0.1:${port}`);
});
