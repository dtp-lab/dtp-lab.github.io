import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.semanticscholar.org/graph/v1/paper/batch?fields=url,citationCount";
export const queryId = (item) => item.doi ? `DOI:${item.doi}` : "";
export async function requestBatch(ids, fetchImpl = fetch) {
  const response = await fetchImpl(API, { method: "POST", headers: { "content-type": "application/json", ...(process.env.SEMANTIC_SCHOLAR_API_KEY ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY } : {}) }, body: JSON.stringify({ ids }) });
  if (!response.ok) throw new Error(`Semantic Scholar API ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  if (!Array.isArray(payload) || payload.length !== ids.length) throw new Error("Semantic Scholar returned an invalid batch response");
  return payload;
}
export async function refresh(items, previous = { papers: {} }, fetchImpl = fetch) {
  const identified = items.map((item) => ({ item, id: queryId(item) })).filter(({ id }) => id);
  const papers = { ...(previous.papers || {}) };
  for (let start = 0; start < identified.length; start += 500) {
    const batch = identified.slice(start, start + 500);
    const results = await requestBatch(batch.map(({ id }) => id), fetchImpl);
    results.forEach((result, index) => {
      const { item } = batch[index];
      if (Number.isInteger(result?.citationCount)) papers[item.id] = { citationCount: result.citationCount, url: result.url || "" };
      else delete papers[item.id];
    });
  }
  return { papers };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const publicationsPath = path.join(root, "site", "data", "publications.json");
  const cachePath = path.join(root, "site", "data", "citations.json");
  const publications = JSON.parse(await readFile(publicationsPath, "utf8"));
  let previous = { papers: {} };
  try { previous = JSON.parse(await readFile(cachePath, "utf8")); } catch {}
  const next = await refresh(publications.items || [], previous);
  await writeFile(cachePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Citation cache updated: ${Object.keys(next.papers).length} matched of ${(publications.items || []).length} publications.`);
}
