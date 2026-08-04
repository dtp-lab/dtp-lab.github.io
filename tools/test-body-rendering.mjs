import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const siteDir = path.resolve("site");
const sharedSource = fs.readFileSync(path.join(siteDir, "shared.js"), "utf8");
const homeSource = fs.readFileSync(path.join(siteDir, "home.js"), "utf8");
const recordRenderersSource = fs.readFileSync(path.join(siteDir, "record-renderers.js"), "utf8");
const gallerySource = fs.readFileSync(path.join(siteDir, "gallery.js"), "utf8");

const bodyInput = "First & <tag>\nSecond line\n\nThird \"quoted\"";
const bodyOutput = "<p>First &amp; &lt;tag&gt;<br>Second line</p><p>Third &quot;quoted&quot;</p>";

const element = () => ({
  addEventListener: () => {},
  classList: { add: () => {}, remove: () => {}, toggle: () => false },
  dataset: {},
  focus: () => {},
  hidden: false,
  innerHTML: "",
  querySelectorAll: () => [],
  setAttribute: () => {},
  textContent: "",
});

const createHarness = () => {
  const elements = new Map();
  const document = {
    addEventListener: () => {},
    body: element(),
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
  };
  const context = vm.createContext({ console, document });
  context.window = context;
  vm.runInContext(sharedSource, context);
  return { context, elements };
};

const extractBody = (html, classNames) => {
  const escapedClassNames = classNames.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<div class="${escapedClassNames}">([\\s\\S]*?)</div>`));
  assert.ok(match, `Expected <div class="${classNames}"> wrapper in ${html}`);
  assert.doesNotMatch(match[1], /<p[^>]*>\s*<p(?:\s|>)/, "body wrapper must not contain nested paragraphs");
  return match[1].trim();
};

const renderHome = async ({ intro = "", researchDescription = "", newsText = "" }) => {
  const { context, elements } = createHarness();
  const data = {
    "home.json": {
      hero: { kicker: "", title: "", subtitle: "" },
      recruitment: {
        summaryKicker: "",
        summaryTitle: "",
        eyebrow: "Recruitment",
        intro,
        contactEmail: "lab@example.com",
        sections: [],
      },
    },
    "research.json": {
      section: { kicker: "Research", title: "Research" },
      overviewImage: "",
      research: [{ label: "Direction 01", title: "Topic", subtitle: "", description: researchDescription, focus: [], image: "" }],
    },
    "news.json": {
      section: { kicker: "News", title: "News" },
      news: newsText ? [{ date: "2026-08-04", category: "project", text: newsText }] : [],
    },
  };
  context.DTPLab.loadJson = async (name) => data[name];
  await vm.runInContext(homeSource, context);
  return elements;
};

const renderRecord = (renderer, record) => {
  const { context } = createHarness();
  vm.runInContext(recordRenderersSource, context);
  return context.DTPLab.recordRenderers[renderer](record);
};

const renderGalleryDescription = async (description) => {
  const { context, elements } = createHarness();
  const dialog = {
    ...element(),
    close: () => {},
    querySelector: () => element(),
    showModal: () => {},
  };
  elements.set("#gallery-lightbox", dialog);
  context.DTPLab.loadJson = async () => ({
    page: {},
    events: [{ date: "2026-08-04", title: "Event", description, images: [] }],
  });
  await vm.runInContext(gallerySource, context);
  return elements.get("#gallery-content").innerHTML;
};

test("shared body renderer separates LF paragraphs and keeps single LF as br", () => {
  const { context } = createHarness();
  assert.equal(context.DTPLab.renderBodyText("First line\nSecond line\n\nThird line"), "<p>First line<br>Second line</p><p>Third line</p>");
});

test("shared body renderer normalizes CRLF, trims outer whitespace, and drops empty paragraphs", () => {
  const { context } = createHarness();
  assert.equal(
    context.DTPLab.renderBodyText("\r\n \r\nFirst line\r\nSecond line\r\n \t\r\n\r\nThird line\r\n\r\n"),
    "<p>First line<br>Second line</p><p>Third line</p>",
  );
});

test("shared body renderer escapes HTML before adding paragraph markup", () => {
  const { context } = createHarness();
  const html = context.DTPLab.renderBodyText("Tom & <script>\"x\" and 'y'</script>\nnext <b>line</b>");
  assert.equal(html, "<p>Tom &amp; &lt;script&gt;&quot;x&quot; and &#39;y&#39;&lt;/script&gt;<br>next &lt;b&gt;line&lt;/b&gt;</p>");
  assert.doesNotMatch(html, /<script>|<b>/);
});

test("shared body renderer preserves the existing single-paragraph markup", () => {
  const { context } = createHarness();
  assert.equal(context.DTPLab.renderBodyText("  Existing one-line description.  "), "<p>Existing one-line description.</p>");
});

test("Home recruitment intro uses the shared body renderer", async () => {
  const elements = await renderHome({ intro: bodyInput });
  assert.equal(extractBody(elements.get("#recruitment-content").innerHTML, "recruitment-intro body-text"), bodyOutput);
});

test("Home research description uses the shared body renderer", async () => {
  const elements = await renderHome({ researchDescription: bodyInput });
  assert.equal(extractBody(elements.get("#research-grid").innerHTML, "research-thrust-copy body-text"), bodyOutput);
});

test("Home news text uses the shared body renderer", async () => {
  const elements = await renderHome({ newsText: bodyInput });
  assert.equal(extractBody(elements.get("#news-groups").innerHTML, "news-timeline-copy body-text"), bodyOutput);
});

test("Projects description uses the shared body renderer", () => {
  const html = renderRecord("renderProjectCard", {
    category: "ongoing",
    title: "Project",
    description: bodyInput,
    details: [],
    images: [],
  });
  assert.equal(extractBody(html, "project-description body-text"), bodyOutput);
});

test("Seminars summary uses the shared body renderer", () => {
  const html = renderRecord("renderSeminarCard", {
    date: "2026-08-04",
    title: "Seminar",
    speaker: "Speaker",
    keywords: [],
    summary: bodyInput,
  });
  assert.equal(extractBody(html, "seminar-summary body-text"), bodyOutput);
});

test("Gallery event description uses the shared body renderer", async () => {
  const html = await renderGalleryDescription(bodyInput);
  assert.equal(extractBody(html, "gallery-event-description body-text"), bodyOutput);
});
