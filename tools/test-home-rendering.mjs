import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const siteDir = path.resolve("site");
const sharedSource = fs.readFileSync(path.join(siteDir, "shared.js"), "utf8");
const homeSource = fs.readFileSync(path.join(siteDir, "home.js"), "utf8");

const renderResearchDescription = async (description) => {
  const elements = new Map();
  const document = {
    addEventListener: () => {},
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, { hidden: false, innerHTML: "", textContent: "" });
      return elements.get(selector);
    },
    querySelectorAll: () => [],
  };
  const data = {
    "home.json": {
      hero: { kicker: "", title: "", subtitle: "" },
      recruitment: { summaryKicker: "", summaryTitle: "", intro: "", sections: [] },
    },
    "research.json": {
      section: { kicker: "Research", title: "Research" },
      overviewImage: "",
      research: [{ label: "Direction 01", title: "Topic", subtitle: "", description, focus: [], image: "" }],
    },
    "news.json": { section: { kicker: "News", title: "News" }, news: [] },
  };
  const context = vm.createContext({ console, document });
  context.window = context;
  vm.runInContext(sharedSource, context);
  context.DTPLab.loadJson = async (name) => data[name];
  await vm.runInContext(homeSource, context);

  const article = elements.get("#research-grid").innerHTML;
  return article.match(/<div class="research-thrust-copy">([\s\S]*?)<\/div>\s*<\/article>/)?.[1].trim();
};

test("research descriptions render blank-line-separated text as paragraphs without empty paragraphs", async () => {
  const html = await renderResearchDescription("\n\nFirst paragraph.\n \t\n\nSecond paragraph.\n\n");
  assert.equal(html, "<p>First paragraph.</p>\n      <p>Second paragraph.</p>");
});

test("research descriptions render a single line break as br within one paragraph", async () => {
  const html = await renderResearchDescription("First line.\nSecond line.");
  assert.equal(html, "<p>First line.<br>Second line.</p>");
});

test("research descriptions normalize CRLF before rendering paragraphs and line breaks", async () => {
  const html = await renderResearchDescription("First line.\r\nSecond line.\r\n\r\nThird line.");
  assert.equal(html, "<p>First line.<br>Second line.</p>\n      <p>Third line.</p>");
});

test("research descriptions escape HTML special characters before adding allowed markup", async () => {
  const html = await renderResearchDescription("Tom & <script>\"x\" and 'y'</script>\nnext <b>line</b>");
  assert.equal(
    html,
    "<p>Tom &amp; &lt;script&gt;&quot;x&quot; and &#39;y&#39;&lt;/script&gt;<br>next &lt;b&gt;line&lt;/b&gt;</p>",
  );
  assert.doesNotMatch(html, /<script>|<b>/);
});

test("research descriptions preserve the existing single-paragraph markup", async () => {
  const html = await renderResearchDescription("Existing one-line description.");
  assert.equal(html, "<p>Existing one-line description.</p>");
});
