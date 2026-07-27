import assert from "node:assert/strict";
import { queryId, refresh } from "./refresh-citations.mjs";

assert.equal(queryId({ doi: "10.1000/test" }), "DOI:10.1000/test");
assert.equal(queryId({}), "");

const items = [{ id: "a", doi: "10.1000/a" }, { id: "b", doi: "10.1000/b" }];
const okFetch = async () => ({ ok: true, json: async () => [{ citationCount: 7, url: "https://www.semanticscholar.org/paper/S2-A" }, null] });
const result = await refresh(items, { papers: { b: { citationCount: 2, url: "" } } }, okFetch);
assert.equal(result.papers.a.citationCount, 7);
assert.equal(result.papers.b, undefined);
assert.deepEqual(Object.keys(result), ["papers"]);

const rateLimitFetch = async () => ({ ok: false, status: 429, text: async () => "rate limited" });
await assert.rejects(() => refresh(items, {}, rateLimitFetch), /429/);
const networkFetch = async () => { throw new Error("network down"); };
await assert.rejects(() => refresh(items, {}, networkFetch), /network down/);
console.log("Citation refresh tests passed: DOI mapping, minimal cache, batch, null, rate-limit, and network failure.");
