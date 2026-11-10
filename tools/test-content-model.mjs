import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  contentContract,
  normalizePublicationRecord,
  validateContent,
} from "./content-model.mjs";
import {
  createGalleryFixture,
  createPeopleFixture,
  createProjectsFixture,
  validateFixture,
} from "./fixtures/content-model.mjs";

const siteDir = path.resolve("site");

test("content contract is serializable and exposes only known files", () => {
  const serialized = JSON.parse(JSON.stringify(contentContract));
  assert.equal(serialized.version, 8);
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

test("page assets and JSON data use the same cache version", () => {
  const head = fs.readFileSync(path.resolve("templates", "partials", "head.ejs"), "utf8");
  const shared = fs.readFileSync(path.join(siteDir, "shared.js"), "utf8");
  const assetVersions = [...head.matchAll(/\?v=(\d+)/g)].map((match) => match[1]);
  const dataVersion = shared.match(/\/data\/\$\{name\}\?v=(\d+)/)?.[1];
  assert.ok(assetVersions.length >= 3);
  assert.equal(new Set(assetVersions).size, 1);
  assert.equal(dataVersion, assetVersions[0]);
});

test("content contract exposes raw list subtitles without technical ID fallbacks", () => {
  const descriptor = (viewKey, index = -1) => {
    const records = contentContract.views.find((view) => view.key === viewKey).records;
    return records.at(index);
  };
  assert.deepEqual(descriptor("home-news").listSubtitle, { parts: [{ path: ["date"] }] });
  assert.deepEqual(descriptor("people", 1).listSubtitle, { literal: "professor" });
  assert.deepEqual(descriptor("people").listSubtitle, { parts: [{ path: ["category"] }] });
  assert.deepEqual(descriptor("projects").listSubtitle, { parts: [{ path: ["status"] }] });
  assert.deepEqual(descriptor("pub-journal").listSubtitle, {
    parts: [{ path: ["type"] }, { path: ["publishedAt"] }],
    separator: " · ",
  });
  assert.deepEqual(descriptor("pub-patent").listSubtitle, {
    parts: [{ path: ["type"] }, { path: ["applicationDate"] }],
    separator: " · ",
  });
  assert.deepEqual(descriptor("seminars").listSubtitle, { parts: [{ path: ["date"] }] });
  assert.deepEqual(descriptor("gallery").listSubtitle, { parts: [{ path: ["date"] }] });
});

test("technical IDs and generated Gallery thumbnails stay out of the Studio form", () => {
  const projectFields = contentContract.files.projects.fields
    .find((field) => field.name === "projects").item.fields;
  const publicationFields = contentContract.files.publications.fields
    .find((field) => field.name === "items").item.fields;
  const galleryFields = contentContract.files.gallery.fields
    .find((field) => field.name === "events").item.fields;
  const projectImageFields = projectFields.find((field) => field.name === "images").item.fields;
  const galleryImageFields = galleryFields.find((field) => field.name === "images").item.fields;

  assert.equal(projectFields.find((field) => field.name === "id").formHidden, true);
  assert.equal(publicationFields.find((field) => field.name === "id").formHidden, true);
  assert.equal(galleryFields.find((field) => field.name === "id").formHidden, true);
  assert.equal(galleryFields.find((field) => field.name === "id").generated, "gallery-event-id");
  assert.equal(galleryImageFields.find((field) => field.name === "thumbnail").formHidden, true);
  for (const imageFields of [projectImageFields, galleryImageFields]) {
    assert.deepEqual(
      imageFields.find((field) => field.name === "seq"),
      { name: "seq", label: "표시 순서", type: "integer", optional: true, minimum: 1, formHidden: true },
    );
  }
  assert.equal(galleryImageFields.find((field) => field.name === "src").label, "원본 이미지 (썸네일 자동 생성)");
  assert.equal(galleryFields.some((field) => field.name === "isSample"), false);
});

test("Gallery events use unique IDs and paired, resolvable original/thumbnail paths", () => {
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  assert.ok(gallery.events.length > 0);
  assert.equal(gallery.events.some((event) => event.isSample || /샘플/.test(event.title)), false);
  assert.equal(JSON.stringify(gallery).includes("sample-"), false);
  const eventIds = new Set();
  const assetPaths = new Set();
  for (const event of gallery.events) {
    assert.match(event.id, /^[0-9a-f]{12}$/);
    assert.equal(eventIds.has(event.id), false);
    eventIds.add(event.id);
    for (const image of event.images) {
      const original = image.src.match(new RegExp(`^assets/gallery/${event.id}/(0[1-9]|[1-9][0-9]+)\\.(jpe?g|png|webp)$`));
      const thumbnail = image.thumbnail.match(new RegExp(`^assets/gallery-thumbs/${event.id}/(0[1-9]|[1-9][0-9]+)\\.(jpe?g|png|webp)$`));
      assert.ok(original, `Invalid Gallery original path: ${image.src}`);
      assert.ok(thumbnail, `Invalid Gallery thumbnail path: ${image.thumbnail}`);
      assert.equal(original[1], thumbnail[1]);
      assert.equal(path.extname(image.src), path.extname(image.thumbnail));
      for (const reference of [image.src, image.thumbnail]) {
        assert.equal(assetPaths.has(reference), false);
        assetPaths.add(reference);
        assert.equal(fs.existsSync(path.join(siteDir, reference)), true);
      }
    }
  }
});

test("Gallery validation accepts reordered numeric stems and numbering gaps", () => {
  for (const stems of [["01", "03", "04", "02"], ["01", "03"]]) {
    const gallery = createGalleryFixture(stems);
    const snapshot = structuredClone(gallery);
    const result = validateFixture({ "gallery.json": gallery });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.deepEqual(gallery, snapshot);
    assert.deepEqual(gallery.events[0].images.map((image) => path.parse(image.src).name), stems);
  }
});

test("Gallery validation rejects mismatched stems, event folders, extensions, and duplicate paths", () => {
  const gallery = createGalleryFixture();
  const checkInvalid = (mutate, expectedError) => {
    const document = structuredClone(gallery);
    mutate(document.events[0]);
    const snapshot = structuredClone(document);
    const result = validateFixture({ "gallery.json": document });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expectedError)), result.errors.join("\n"));
    assert.deepEqual(document, snapshot);
  };
  checkInvalid((event) => {
    event.images[0].thumbnail = `assets/gallery-thumbs/${event.id}/99.jpg`;
  }, "numeric stems must match");
  checkInvalid((event) => {
    event.images[0].src = "assets/gallery/000000000000/01.jpg";
  }, "assets/gallery/<event-id>/<number>.ext");
  checkInvalid((event) => {
    event.images[0].thumbnail = `assets/gallery-thumbs/${event.id}/01.png`;
  }, "extensions must match");
  checkInvalid((event) => {
    event.images[1].src = event.images[0].src;
  }, "duplicate Gallery asset path");
  for (const stem of ["00", "1", "0001"]) {
    checkInvalid((event) => {
      event.images[0].src = `assets/gallery/${event.id}/${stem}.jpg`;
      event.images[0].thumbnail = `assets/gallery-thumbs/${event.id}/${stem}.jpg`;
    }, "<number>.ext");
  }
  checkInvalid((event) => {
    event.images[1].src = `assets/gallery/${event.id}/01.png`;
    event.images[1].thumbnail = `assets/gallery-thumbs/${event.id}/01.png`;
  }, "duplicate Gallery numeric stem");
});

const imageFixtures = [
  { file: "gallery.json", create: createGalleryFixture, images: (document) => document.events[0].images },
  { file: "projects.json", create: createProjectsFixture, images: (document) => document.projects[0].images },
];
const imagePaths = (images) => images.map(({ src, thumbnail }) => ({ src, thumbnail }));
const checkImageFixture = (fixture, document, expectedError) => {
  const snapshot = structuredClone(document);
  const paths = imagePaths(fixture.images(document));
  const result = validateFixture({ [fixture.file]: document });
  assert.equal(result.ok, !expectedError, result.errors.join("\n"));
  if (expectedError) assert.ok(result.errors.some((error) => error.includes(expectedError)), result.errors.join("\n"));
  assert.deepEqual(document, snapshot, "validation must preserve the entire input");
  assert.deepEqual(imagePaths(fixture.images(document)), paths, "validation must preserve original and thumbnail paths in order");
};

for (const fixture of imageFixtures) {
  test(`${fixture.file} accepts fallback and complete seq permutations and rejects invalid sequences without mutation`, async (t) => {
    const cases = [
      { label: "all seq absent", values: [undefined, undefined, undefined] },
      { label: "complete permutation", values: [2, 1, 3] },
      { label: "partial", values: [1, undefined, 3], error: "seq must be present on every image" },
      { label: "duplicate", values: [1, 1, 3], error: "seq values must be unique" },
      { label: "zero", values: [0, 2, 3], error: "positive integer required" },
      { label: "negative", values: [-1, 2, 3], error: "positive integer required" },
      { label: "decimal", values: [1.5, 2, 3], error: "positive integer required" },
      { label: "string", values: ["1", 2, 3], error: "positive integer required" },
      { label: "gap", values: [1, 3, 4], error: "seq must be contiguous" },
    ];
    for (const scenario of cases) {
      await t.test(scenario.label, () => {
        const document = fixture.create();
        const images = fixture.images(document);
        // Start with existing seq to catch regressions where omission leaves a stale value.
        images.forEach((image, index) => { image.seq = index + 1; });
        images.forEach((image, index) => {
          const value = scenario.values[index];
          if (value === undefined) delete image.seq;
          else image.seq = value;
          assert.equal(Object.hasOwn(image, "seq"), value !== undefined);
        });
        checkImageFixture(fixture, document, scenario.error);
      });
    }
  });

  test(`${fixture.file} validation supports different image counts and array orders`, () => {
    for (const stems of [[], ["04"], ["03", "01"], ["01", "02", "03", "04"], ["04", "03", "02", "01"]]) {
      const document = fixture.create(stems);
      const images = fixture.images(document);
      assert.ok(images.every((image) => !Object.hasOwn(image, "seq")));
      checkImageFixture(fixture, document);
      // Valid reverse sequence is independent of both array order and filename numbering.
      images.forEach((image, index) => { image.seq = images.length - index; });
      checkImageFixture(fixture, document);
      if (images.length > 1) {
        delete images[1].seq;
        assert.equal(Object.hasOwn(images[1], "seq"), false);
        checkImageFixture(fixture, document, "seq must be present on every image");
      }
    }
  });
}

test("People contract exposes structured member fields and allowed categories", () => {
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

test("People migration preserves every record and field in a fixed legacy fixture", (t) => {
  const temporaryDirectory = path.resolve(os.tmpdir());
  const migrationRoot = fs.mkdtempSync(path.join(temporaryDirectory, "website-people-migration-"));
  t.after(() => {
    assert.equal(path.dirname(migrationRoot), temporaryDirectory);
    assert.ok(path.basename(migrationRoot).startsWith("website-people-migration-"));
    fs.rmSync(migrationRoot, { recursive: true, force: true });
  });
  const dataDirectory = path.join(migrationRoot, "site", "data");
  const migrationScript = path.join(migrationRoot, "tools", "migrate-studio-content-v3.mjs");
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(path.dirname(migrationScript), { recursive: true });
  // The migration resolves its data directory from import.meta.url, not cwd.
  fs.copyFileSync(path.resolve("tools", "migrate-studio-content-v3.mjs"), migrationScript);
  const legacy = {
    page: { kicker: "Team", title: "People", subtitle: "Fixture members" },
    groups: {
      professor: [{
        name: "Fixture Professor", image: "",
        fields: {
          affiliation: "Fixture University", "e-mail": "professor@example.test",
          research_topic: "Simulation", office: "Room 101", "tel.": "000-0000",
          "2020_Present": "Professor", "2018_2019": "Researcher",
        },
      }],
      phd: [{
        name: "Fixture Doctoral Member", image: "",
        fields: { affiliation: "Doctoral Program", email: "phd@example.test", researchTopic: "Robotics" },
      }],
      ms: [
        { name: "Fixture Master A", image: "", fields: { affiliation: "Master Program", "e-mail": "master-a@example.test", research_topic: "Control" } },
        { name: "Fixture Master B", image: "", fields: { affiliation: "Master Program", email: "master-b@example.test", researchTopic: "Planning" } },
      ],
      undergrad: [{ name: "Fixture Undergraduate", image: "", fields: { affiliation: "Undergraduate Program", email: "undergraduate@example.test", researchTopic: "Sensors" } }],
      alumni: [{ name: "Fixture Alumnus", image: "", fields: {} }],
    },
  };
  const sourceSnapshot = structuredClone(legacy);
  fs.writeFileSync(path.join(dataDirectory, "people.json"), JSON.stringify(legacy));
  fs.writeFileSync(path.join(dataDirectory, "publications.json"), JSON.stringify({ items: [] }));
  const execution = spawnSync(process.execPath, [migrationScript], { cwd: migrationRoot, encoding: "utf8" });
  assert.equal(execution.status, 0, execution.error?.message || execution.stderr || execution.stdout);
  const migrated = JSON.parse(fs.readFileSync(path.join(dataDirectory, "people.json"), "utf8"));
  assert.deepEqual(migrated, {
    page: { kicker: "Team", title: "People", subtitle: "Fixture members" },
    professor: {
      name: "Fixture Professor", image: "", affiliation: "Fixture University",
      email: "professor@example.test", researchTopic: "Simulation", office: "Room 101", telephone: "000-0000",
      career: [{ period: "2020 Present", role: "Professor" }, { period: "2018 2019", role: "Researcher" }],
    },
    members: [
      { name: "Fixture Doctoral Member", image: "", affiliation: "Doctoral Program", email: "phd@example.test", researchTopic: "Robotics", category: "phd" },
      { name: "Fixture Master A", image: "", affiliation: "Master Program", email: "master-a@example.test", researchTopic: "Control", category: "master" },
      { name: "Fixture Master B", image: "", affiliation: "Master Program", email: "master-b@example.test", researchTopic: "Planning", category: "master" },
      { name: "Fixture Undergraduate", image: "", affiliation: "Undergraduate Program", email: "undergraduate@example.test", researchTopic: "Sensors", category: "undergraduate" },
      { name: "Fixture Alumnus", image: "", affiliation: "", email: "", researchTopic: "", category: "alumni" },
    ],
  });
  assert.deepEqual(legacy, sourceSnapshot);
  const result = validateFixture({ "people.json": migrated });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("People validation allows member additions, deletions, reordering, and an empty list", async (t) => {
  const variations = [
    { label: "all allowed categories", change: () => {} },
    { label: "addition", change: (people) => { people.members.push({ name: "Added Fixture Member", category: "staff", image: "", affiliation: "", email: "", researchTopic: "" }); } },
    { label: "deletion", change: (people) => { people.members.splice(1, 1); } },
    { label: "reordering", change: (people) => { people.members.reverse(); } },
    { label: "empty list", change: (people) => { people.members = []; } },
  ];
  for (const variation of variations) {
    await t.test(variation.label, () => {
      const people = createPeopleFixture();
      variation.change(people);
      const snapshot = structuredClone(people);
      const result = validateFixture({ "people.json": people });
      assert.equal(result.ok, true, result.errors.join("\n"));
      assert.deepEqual(people, snapshot);
    });
  }
});

test("People validation still rejects invalid required fields, categories, and legacy fields", async (t) => {
  const invalidCases = [
    { label: "missing professor name", change: (people) => { delete people.professor.name; }, error: "people.professor.name" },
    { label: "missing career period", change: (people) => { people.professor.career = [{ role: "Professor" }]; }, error: "people.professor.career[0].period" },
    { label: "missing members list", change: (people) => { delete people.members; }, error: "people.members: list required" },
    { label: "missing member name", change: (people) => { delete people.members[0].name; }, error: "people.members[0].name" },
    { label: "blank member name", change: (people) => { people.members[0].name = " "; }, error: "people.members[0].name" },
    { label: "missing category", change: (people) => { delete people.members[0].category; }, error: "people.members[0].category" },
    { label: "unsupported category", change: (people) => { people.members[0].category = "visitor"; }, error: "people.members[0].category" },
    { label: "invalid affiliation type", change: (people) => { people.members[0].affiliation = {}; }, error: "people.members[0].affiliation" },
    { label: "invalid email type", change: (people) => { people.members[0].email = 123; }, error: "people.members[0].email" },
    { label: "invalid research topic type", change: (people) => { people.members[0].researchTopic = []; }, error: "people.members[0].researchTopic" },
    { label: "legacy groups", change: (people) => { people.groups = {}; }, error: "people.groups" },
    ...["fields", "group", "notes"].flatMap((field) => [
      { label: `legacy member ${field}`, change: (people) => { people.members[0][field] = "legacy"; }, error: `people.members[0].${field}` },
      { label: `legacy professor ${field}`, change: (people) => { people.professor[field] = "legacy"; }, error: `people.professor.${field}` },
    ]),
  ];
  for (const invalid of invalidCases) {
    await t.test(invalid.label, () => {
      const people = createPeopleFixture();
      invalid.change(people);
      const snapshot = structuredClone(people);
      const result = validateFixture({ "people.json": people });
      assert.equal(result.ok, false, invalid.label);
      assert.ok(result.errors.some((error) => error.includes(invalid.error)), result.errors.join("\n"));
      assert.deepEqual(people, snapshot);
    });
  }
});

test("current repository content passes the reusable validator", () => {
  const result = validateContent({ siteDir });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("draft overrides are validated without changing disk files", () => {
  const file = path.join(siteDir, "data", "projects.json");
  const original = fs.readFileSync(file, "utf8");
  const draft = createProjectsFixture();
  draft.projects.push({ ...structuredClone(draft.projects[0]), id: "second-project" });
  const valid = validateFixture({ "projects.json": draft }, { siteDir });
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  draft.projects[1].id = draft.projects[0].id;
  const snapshot = structuredClone(draft);
  const result = validateFixture({ "projects.json": draft }, { siteDir });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate")));
  assert.deepEqual(draft, snapshot);
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

test("custom keywords are accepted and removed private metadata is rejected", () => {
  const projects = createProjectsFixture();
  projects.projects[0].keywords = ["새 연구 키워드"];
  const valid = validateFixture({ "projects.json": projects });
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  projects.projects[0].budget = { amount: "1", unit: "원" };
  const result = validateFixture({ "projects.json": projects });
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
  assert.deepEqual(fields.slice(0, 12).map((field) => field.name), [
    "id",
    "type",
    "journalMetrics",
    "conferenceMetrics",
    "patentMetrics",
    "publishedAt",
    "applicationDate",
    "registrationDate",
    "title",
    "applicationNumber",
    "registrationNumber",
    "authors",
  ]);
  assert.deepEqual(fields.find((field) => field.name === "authors").visibleWhen, {
    path: ["type"],
    oneOf: ["journal", "conference"],
  });
  assert.deepEqual(patent.fields.find((field) => field.name === "status").options, ["등록", "출원"]);
  assert.equal(fields.find((field) => field.name === "applicationDate").required, true);
  assert.equal(fields.find((field) => field.name === "applicationNumber").required, true);
  assert.deepEqual(fields.find((field) => field.name === "registrationDate").visibleWhen, {
    path: ["patentMetrics", "status"],
    equals: "등록",
  });
  assert.deepEqual(fields.find((field) => field.name === "registrationNumber").visibleWhen, {
    path: ["patentMetrics", "status"],
    equals: "등록",
  });
  assert.equal(fields.find((field) => field.name === "publishedAt").label, "발표연월");
});

test("publication normalization preserves only fields compatible with the target type", () => {
  const bibliographic = {
    authors: [{ name: "A", isLabMember: true, isFirstAuthor: true, isCorrespondingAuthor: false }],
    venue: "Venue",
    details: "Details",
    keywords: ["Digital Twin"],
    doi: "10.1/example",
    links: [{ label: "Paper", url: "https://example.com" }],
  };
  const journal = normalizePublicationRecord({
    type: "journal",
    metrics: { indexing: "SCIE" },
    conferenceMetrics: { conferenceType: "국제", bk21: "IF4", kiise: "최우수" },
    journalMetrics: { indexing: "KCI", quartile: "Q1", award: "" },
    ...bibliographic,
  });
  assert.deepEqual(journal.journalMetrics, { indexing: "KCI", quartile: "해당없음", award: "" });
  assert.equal("conferenceMetrics" in journal, false);
  assert.equal("metrics" in journal, false);

  const conference = normalizePublicationRecord({
    type: "conference",
    journalMetrics: { indexing: "SCIE", quartile: "Q1", award: "" },
    conferenceMetrics: { conferenceType: "국내", bk21: "IF4", kiise: "최우수" },
    ...bibliographic,
  }, { previousType: "journal" });
  assert.deepEqual(conference.conferenceMetrics, { conferenceType: "국내", bk21: "해당없음", kiise: "해당없음" });
  assert.deepEqual(
    Object.fromEntries(Object.keys(bibliographic).map((key) => [key, conference[key]])),
    bibliographic,
  );

  const patent = normalizePublicationRecord({
    id: "pub-1",
    type: "patent",
    title: "Patent",
    journalMetrics: { indexing: "SCIE", quartile: "Q1", award: "" },
    ...bibliographic,
  }, { previousType: "journal" });
  assert.deepEqual(patent, {
    id: "pub-1",
    type: "patent",
    title: "Patent",
    patentMetrics: { jurisdiction: "국내", status: "출원" },
    applicationDate: "",
    registrationDate: "",
    applicationNumber: "",
    registrationNumber: "",
  });

  const backToConference = normalizePublicationRecord({
    ...patent,
    type: "conference",
  }, { previousType: "patent" });
  assert.equal("applicationDate" in backToConference, false);
  assert.equal("applicationNumber" in backToConference, false);
  assert.equal(backToConference.publishedAt, "");
  assert.deepEqual(backToConference.conferenceMetrics, {
    conferenceType: "국제",
    bk21: "해당없음",
    kiise: "해당없음",
  });
  assert.deepEqual(
    Object.fromEntries(Object.keys(bibliographic).map((key) => [key, backToConference[key]])),
    { authors: [], venue: "", details: "", keywords: [], doi: "", links: [] },
  );

  const registeredPatent = normalizePublicationRecord({
    id: "pub-registered",
    type: "patent",
    title: "Registered patent",
    patentMetrics: { jurisdiction: "국내", status: "등록" },
    applicationDate: "2024.12.06",
    registrationDate: "2026.03.24",
    applicationNumber: "10-2024-0180306",
    registrationNumber: "10-2941109",
  });
  registeredPatent.patentMetrics.status = "출원";
  const applicationOnly = normalizePublicationRecord(registeredPatent);
  applicationOnly.patentMetrics.status = "등록";
  const registeredAgain = normalizePublicationRecord(applicationOnly);
  assert.equal(registeredAgain.registrationDate, "2026.03.24");
  assert.equal(registeredAgain.registrationNumber, "10-2941109");
});

test("publication validator rejects retired, mismatched, and type-incompatible fields", () => {
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

  delete publications.items[0].conferenceMetrics;
  publications.items[0].patentNumber = "10-1";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".patentNumber")));

  delete publications.items[0].patentNumber;
  const patent = publications.items.find((item) => item.type === "patent");
  patent.authors = [];
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".authors")));

  delete patent.authors;
  patent.patentNumber = "";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".patentNumber")));

  delete patent.patentNumber;
  patent.applicationNumber = "";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".applicationNumber")));

  patent.applicationNumber = "10-2024-0180306";
  patent.patentMetrics.status = "공개";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".patentMetrics.status")));

  patent.patentMetrics.status = "등록";
  patent.registrationDate = "";
  patent.registrationNumber = "";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".registrationDate")));
  assert.ok(result.errors.some((error) => error.includes(".registrationNumber")));

  patent.patentMetrics.status = "출원";
  patent.applicationDate = "2025.02.30";
  result = validateContent({ siteDir, overrides: { "publications.json": publications } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".applicationDate")));
});

test("migrated Patent records preserve identity and use the v6 field set", () => {
  const publications = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "publications.json"), "utf8"));
  const patents = publications.items.filter((item) => item.type === "patent");
  // assert.equal(patents.length, 16);
  assert.deepEqual(Object.keys(patents[0]).sort(), [
    "applicationDate",
    "applicationNumber",
    "id",
    "patentMetrics",
    "registrationDate",
    "registrationNumber",
    "title",
    "type",
  ]);
  assert.deepEqual(
    {
      id: patents[0].id,
      title: patents[0].title,
      applicationDate: patents[0].applicationDate,
      registrationDate: patents[0].registrationDate,
      applicationNumber: patents[0].applicationNumber,
      registrationNumber: patents[0].registrationNumber,
      patentMetrics: patents[0].patentMetrics,
    },
    {
      id: "patent-202603-01",
      title: "강화학습을 이용해 전기차 통합 열관리 시스템을 제어하기 위한 장치",
      applicationDate: "2024.12.06",
      registrationDate: "2026.03.16",
      applicationNumber: "10-2024-0180306",
      registrationNumber: "10-2941109",
      patentMetrics: { jurisdiction: "국내", status: "등록" },
    },
  );
  const pct = patents.find((item) => item.applicationNumber === "PCT/KR2017/013362");
  assert.deepEqual(pct.patentMetrics, { jurisdiction: "PCT", status: "출원" });
  assert.equal(patents.find((item) => item.id === "patent-202501-02").applicationDate, "2025.10.30");
  assert.equal(patents.find((item) => item.id === "patent-202501-03").applicationDate, "2025.10.28");
  assert.equal(patents.some((item) => "publishedAt" in item || "patentNumber" in item), false);
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
  const render = context.DTPLab.recordRenderers.renderPublicationCard;

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
  const patentHtml = render({
    id: "patent-1",
    type: "patent",
    title: "Patent",
    applicationDate: "2024.12.06",
    registrationDate: "2026.03.24",
    applicationNumber: "10-2024-0180306",
    registrationNumber: "10-2941109",
    patentMetrics: { jurisdiction: "국내", status: "등록" },
  });
  assert.match(
    patentHtml,
    /대한민국 특허, 출원번호: 10-2024-0180306, 출원일자: 2024\.12\.06, 등록번호: 10-2941109, 등록일자: 2026\.03\.24/,
  );
  assert.doesNotMatch(patentHtml, /publication-authors-row|publication-keywords-item|publication-links/);

  const applicationHtml = render({
    id: "patent-2",
    type: "patent",
    title: "Application",
    applicationDate: "2024.01.26",
    registrationDate: "2026.02.01",
    applicationNumber: "10-2024-0011983",
    registrationNumber: "10-2999999",
    patentMetrics: { jurisdiction: "국내", status: "출원" },
  });
  assert.match(applicationHtml, /대한민국 특허, 출원번호: 10-2024-0011983, 출원일자: 2024\.01\.26/);
  assert.doesNotMatch(applicationHtml, /등록번호|등록일자/);
});

test("Conference migration is explicit and the public project icon contract stays unchanged", () => {
  const publications = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "publications.json"), "utf8"));
  const conference = publications.items.filter((item) => item.type === "conference");
  // assert.equal(conference.filter((item) => item.conferenceMetrics.conferenceType === "국제").length, 21);
  // assert.equal(conference.filter((item) => item.conferenceMetrics.conferenceType === "국내").length, 13);
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
  assert.match(publications, /type === "patent"[\s\S]*dateValue\(b\.applicationDate\) - dateValue\(a\.applicationDate\)/);
  assert.match(publications, /item\.applicationNumber/);
  assert.match(publications, /item\.registrationNumber/);
});

test("shared metadata icons are fixed at 16px and SCIE Q1 uses white text", () => {
  const styles = fs.readFileSync(path.join(siteDir, "styles.css"), "utf8");
  assert.match(styles, /--record-meta-icon-size:\s*16px/);
  assert.match(styles, /\(var\(--record-meta-icon-size\) - 1em\) \/ 2/);
  assert.match(styles, /\.evaluation-scie-q1\s*\{\s*color:\s*white;/);
});
