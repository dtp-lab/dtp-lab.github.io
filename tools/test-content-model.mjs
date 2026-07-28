import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { contentContract, normalizePublicationMetrics, validateContent } from "./content-model.mjs";

const siteDir = path.resolve("site");

test("content contract is serializable and exposes only known files", () => {
  const serialized = JSON.parse(JSON.stringify(contentContract));
  assert.equal(serialized.version, 4);
  assert.deepEqual(
    Object.values(serialized.files).map((entry) => entry.file).sort(),
    fs.readdirSync(path.join(siteDir, "data")).filter((name) => name.endsWith(".json")).sort(),
  );
  assert.equal(serialized.files.citations.editable, false);
  assert.deepEqual(serialized.views.map((view) => view.label), [
    "Home-Title",
    "Home-Recruit",
    "Home-Research",
    "Home-News",
    "People",
    "Projects",
    "Publications-Title",
    "Publications-Journal",
    "Publications-Conference",
    "Publications-Patent",
    "Seminars",
    "Gallery",
  ]);
  const publicationViews = serialized.views.filter((view) => view.key.startsWith("pub-"));
  assert.deepEqual(publicationViews.map((view) => view.route), [
    "/publications/",
    "/publications/#journal",
    "/publications/#conference",
    "/publications/#patent",
  ]);
  assert.deepEqual(
    publicationViews.slice(1).map((view) => view.records[0].defaults.type),
    ["journal", "conference", "patent"],
  );
});

test("technical IDs and generated Gallery thumbnails stay out of the Studio form", () => {
  const projectFields = contentContract.files.projects.fields
    .find((field) => field.name === "projects").item.fields;
  const publicationFields = contentContract.files.publications.fields
    .find((field) => field.name === "items").item.fields;
  const galleryFields = contentContract.files.gallery.fields
    .find((field) => field.name === "events").item.fields;
  const galleryImageFields = galleryFields.find((field) => field.name === "images").item.fields;

  assert.equal(projectFields.find((field) => field.name === "id").formHidden, true);
  assert.equal(publicationFields.find((field) => field.name === "id").formHidden, true);
  assert.equal(galleryImageFields.find((field) => field.name === "thumbnail").formHidden, true);
  assert.equal(galleryImageFields.find((field) => field.name === "src").label, "원본 이미지 (썸네일 자동 생성)");
  assert.equal(galleryFields.some((field) => field.name === "isSample"), false);
});

test("Gallery contains only actual events and no sample asset references", () => {
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  assert.equal(gallery.events.length, 9);
  assert.equal(gallery.events.some((event) => event.isSample || /샘플/.test(event.title)), false);
  assert.equal(JSON.stringify(gallery).includes("sample-"), false);
});

test("People contract and migrated data use structured member categories without losing records", () => {
  const people = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "people.json"), "utf8"));
  assert.equal(people.professor.name, "Won-Suk Kim, Ph.D.");
  assert.equal(people.professor.career.length, 3);
  assert.equal(people.members.length, 19);
  assert.deepEqual(
    Object.fromEntries(["phd", "master", "undergraduate", "alumni", "staff"].map((category) => [
      category,
      people.members.filter((person) => person.category === category).length,
    ])),
    { phd: 4, master: 5, undergraduate: 7, alumni: 3, staff: 0 },
  );
  assert.equal("groups" in people, false);
  assert.ok(people.members.every((person) => !("fields" in person)));

  const fields = contentContract.files.people.fields;
  const members = fields.find((field) => field.name === "members");
  assert.deepEqual(
    members.item.fields.map((field) => field.name),
    ["image", "name", "category", "affiliation", "email", "researchTopic"],
  );
  assert.deepEqual(
    members.item.fields.find((field) => field.name === "category").options,
    ["phd", "master", "undergraduate", "alumni", "staff"],
  );
});

test("current repository content passes the reusable validator", () => {
  const result = validateContent({ siteDir });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("draft overrides are validated without changing disk files", () => {
  const file = path.join(siteDir, "data", "projects.json");
  const original = fs.readFileSync(file, "utf8");
  const draft = JSON.parse(original);
  draft.projects[1].id = draft.projects[0].id;
  const result = validateContent({ siteDir, overrides: { "projects.json": draft } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate")));
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

test("custom keywords are accepted and removed private metadata is rejected", () => {
  const projects = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "projects.json"), "utf8"));
  projects.projects[0].keywords = ["새 연구 키워드"];
  assert.equal(validateContent({ siteDir, overrides: { "projects.json": projects } }).ok, true);
  projects.projects[0].budget = { amount: "1", unit: "원" };
  const result = validateContent({ siteDir, overrides: { "projects.json": projects } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("budget")));
});

test("publication contract exposes type-specific conditional metrics", () => {
  const fields = contentContract.files.publications.fields.find((field) => field.name === "items").item.fields;
  const journal = fields.find((field) => field.name === "journalMetrics");
  const conference = fields.find((field) => field.name === "conferenceMetrics");
  const patent = fields.find((field) => field.name === "patentMetrics");
  assert.deepEqual(journal.visibleWhen, { path: ["type"], equals: "journal" });
  assert.deepEqual(journal.fields.find((field) => field.name === "quartile").enabledWhen, {
    path: ["journalMetrics", "indexing"],
    equals: "SCIE",
  });
  assert.deepEqual(conference.visibleWhen, { path: ["type"], equals: "conference" });
  assert.deepEqual(conference.fields.find((field) => field.name === "conferenceType").options, ["국제", "국내"]);
  assert.deepEqual(conference.fields.find((field) => field.name === "bk21").enabledWhen, {
    path: ["conferenceMetrics", "conferenceType"],
    equals: "국제",
  });
  assert.deepEqual(patent.visibleWhen, { path: ["type"], equals: "patent" });
  assert.deepEqual(fields.slice(0, 7).map((field) => field.name), [
    "id",
    "type",
    "journalMetrics",
    "conferenceMetrics",
    "patentMetrics",
    "publishedAt",
    "title",
  ]);
  assert.equal(fields.find((field) => field.name === "publishedAt").label, "발표연월");
});

test("publication metric normalization removes stale groups and resets disabled values", () => {
  const journal = normalizePublicationMetrics({
    type: "journal",
    metrics: { indexing: "SCIE" },
    conferenceMetrics: { conferenceType: "국제", bk21: "IF4", kiise: "최우수" },
    journalMetrics: { indexing: "KCI", quartile: "Q1", award: "" },
  });
  assert.deepEqual(journal.journalMetrics, { indexing: "KCI", quartile: "해당없음", award: "" });
  assert.equal("conferenceMetrics" in journal, false);
  assert.equal("metrics" in journal, false);

  const conference = normalizePublicationMetrics({
    type: "conference",
    conferenceMetrics: { conferenceType: "국내", bk21: "IF4", kiise: "최우수" },
  });
  assert.deepEqual(conference.conferenceMetrics, { conferenceType: "국내", bk21: "해당없음", kiise: "해당없음" });
});

test("publication validator rejects retired and mismatched metric fields", () => {
  const publications = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "publications.json"), "utf8"));
  publications.items[0].metrics = { indexing: "SCIE" };
  let result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".metrics")));

  delete publications.items[0].metrics;
  publications.items[0].conferenceMetrics = { conferenceType: "국제", bk21: "IF4", kiise: "해당없음" };
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("do not match publication type")));
});

test("publication public badges apply precedence, labels, and color classes", () => {
  const source = fs.readFileSync(path.join(siteDir, "record-renderers.js"), "utf8");
  const context = {
    DTPLab: {
      escapeHtml: (value) => String(value),
      imageMarkup: () => "",
      renderKeywords: () => "",
    },
  };
  vm.runInNewContext(source, context);
  const tags = context.DTPLab.recordRenderers.publicationTagDescriptors;

  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "journal", journalMetrics: { indexing: "SCIE", quartile: "Top-5%", award: "" } }))),
    [{ label: "SCIE-Top 5%", className: "evaluation evaluation-scie-top5" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "journal", journalMetrics: { indexing: "SCIE", quartile: "Top-10%", award: "" } }))),
    [{ label: "SCIE-Top 10%", className: "evaluation evaluation-scie-top10" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "journal", journalMetrics: { indexing: "SCIE", quartile: "Q1", award: "" } }))),
    [{ label: "SCIE-Q1", className: "evaluation evaluation-scie-q1" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "conference", conferenceMetrics: { conferenceType: "국제", bk21: "IF4", kiise: "최우수" } }))),
    [{ label: "BK IF4", className: "evaluation evaluation-scie-top5" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "conference", conferenceMetrics: { conferenceType: "국제", bk21: "해당없음", kiise: "우수" } }))),
    [{ label: "정보과학회 우수", className: "evaluation evaluation-scie-q1" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "conference", conferenceMetrics: { conferenceType: "국내", bk21: "해당없음", kiise: "해당없음" } }))),
    [{ label: "국내", className: "evaluation evaluation-kci" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "conference", conferenceMetrics: { conferenceType: "국제", bk21: "해당없음", kiise: "해당없음" } }))),
    [{ label: "국제", className: "evaluation evaluation-esci" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "patent", patentMetrics: { jurisdiction: "국내", status: "등록" } }))),
    [{ label: "국내 등록", className: "evaluation evaluation-scie-q2" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "patent", patentMetrics: { jurisdiction: "국내", status: "출원" } }))),
    [{ label: "국내 출원", className: "evaluation evaluation-scie" }],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(tags({ type: "patent", patentMetrics: { jurisdiction: "PCT", status: "출원" } }))),
    [{ label: "PCT 출원", className: "patent-status patent-pct" }],
  );
});

test("Conference migration is explicit and the public project icon contract stays unchanged", () => {
  const publications = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "publications.json"), "utf8"));
  const conference = publications.items.filter((item) => item.type === "conference");
  assert.equal(conference.filter((item) => item.conferenceMetrics.conferenceType === "국제").length, 21);
  assert.equal(conference.filter((item) => item.conferenceMetrics.conferenceType === "국내").length, 13);
  assert.equal(conference.some((item) => item.conferenceMetrics.conferenceType === "미분류"), false);

  const renderer = fs.readFileSync(path.join(siteDir, "record-renderers.js"), "utf8");
  assert.match(renderer, /projectMetaPart\("program", "사업명 및 과제유형", project\.program\)/);
  assert.match(renderer, /project-meta-icon record-meta-icon/);
});

test("public ordering keeps project JSON order and exposes publication anchors", () => {
  const projects = fs.readFileSync(path.join(siteDir, "projects.js"), "utf8");
  const publications = fs.readFileSync(path.join(siteDir, "publications.js"), "utf8");
  assert.match(projects, /filtered\.filter\(\(project\) => project\.status === "current"\);/);
  assert.match(projects, /filtered\.filter\(\(project\) => project\.status === "completed"\);/);
  assert.doesNotMatch(projects, /\.period\?\.(?:start|end)\) - dateValue/);
  assert.match(publications, /id="\$\{type\}"/);
  assert.match(publications, /type === "patent"[\s\S]*dateValue\(b\.publishedAt\) - dateValue\(a\.publishedAt\)/);
});

test("shared metadata icons are fixed at 16px and SCIE Q1 uses white text", () => {
  const styles = fs.readFileSync(path.join(siteDir, "styles.css"), "utf8");
  assert.match(styles, /--record-meta-icon-size:\s*16px/);
  assert.match(styles, /\(var\(--record-meta-icon-size\) - 1em\) \/ 2/);
  assert.match(styles, /\.evaluation-scie-q1\s*\{\s*color:\s*white;/);
});
