import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { contentContract, normalizePublicationMetrics, validateContent } from "./content-model.mjs";

const siteDir = path.resolve("site");

test("content contract is serializable and exposes only known files", () => {
  const serialized = JSON.parse(JSON.stringify(contentContract));
  assert.equal(serialized.version, 2);
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
    "Publications",
    "Seminars",
    "Gallery",
  ]);
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
  assert.deepEqual(conference.fields.find((field) => field.name === "bk21").enabledWhen, {
    path: ["conferenceMetrics", "conferenceType"],
    equals: "국제",
  });
  assert.deepEqual(patent.visibleWhen, { path: ["type"], equals: "patent" });
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
    [{ label: "SCIE-Top-5%", className: "evaluation evaluation-scie-top5" }],
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
    JSON.parse(JSON.stringify(tags({ type: "patent", patentMetrics: { jurisdiction: "PCT", status: "출원" } }))),
    [{ label: "PCT 출원", className: "patent-status patent-pct" }],
  );
});
