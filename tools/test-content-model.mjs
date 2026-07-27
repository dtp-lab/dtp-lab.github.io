import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { contentContract, validateContent } from "./content-model.mjs";

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
