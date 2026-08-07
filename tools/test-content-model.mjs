import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  contentContract,
  normalizePublicationRecord,
  validateContent,
} from "./content-model.mjs";

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
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  const eventIndex = 0;
  const reordered = structuredClone(gallery);
  const eventId = reordered.events[eventIndex].id;
  const fixtureImages = ["01", "03", "04", "02"].map((stem) => ({
    src: `assets/gallery/${eventId}/${stem}.jpg`,
    thumbnail: `assets/gallery-thumbs/${eventId}/${stem}.jpg`,
    alt: `Synthetic Gallery image ${stem}`,
  }));
  const virtualAssets = fixtureImages.flatMap((image) => [image.src, image.thumbnail]);
  reordered.events[eventIndex].images = fixtureImages;
  assert.deepEqual(
    reordered.events[eventIndex].images.map((image) => path.parse(image.src).name),
    ["01", "03", "04", "02"],
  );
  let result = validateContent({ siteDir, overrides: { "gallery.json": reordered }, virtualAssets });
  assert.equal(result.ok, true, result.errors.join("\n"));

  const gapped = structuredClone(reordered);
  gapped.events[eventIndex].images = gapped.events[eventIndex].images.slice(0, 2);
  assert.deepEqual(gapped.events[eventIndex].images.map((image) => path.parse(image.src).name), ["01", "03"]);
  result = validateContent({ siteDir, overrides: { "gallery.json": gapped }, virtualAssets });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Gallery validation rejects mismatched stems, event folders, extensions, and duplicate paths", () => {
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  const eventIndex = gallery.events.findIndex((event) => event.images.length >= 2);
  assert.notEqual(eventIndex, -1);

  const mismatchedStem = structuredClone(gallery);
  mismatchedStem.events[eventIndex].images[0].thumbnail = mismatchedStem.events[eventIndex].images[0].thumbnail
    .replace(/([0-9]+)(\.[^.]+)$/, "99$2");
  let result = validateContent({ siteDir, overrides: { "gallery.json": mismatchedStem } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("numeric stems must match")));

  const wrongFolder = structuredClone(gallery);
  wrongFolder.events[eventIndex].images[0].src = wrongFolder.events[eventIndex].images[0].src
    .replace(wrongFolder.events[eventIndex].id, "000000000000");
  result = validateContent({ siteDir, overrides: { "gallery.json": wrongFolder } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("assets/gallery/<event-id>/<number>.ext")));

  const wrongExtension = structuredClone(gallery);
  const nonPngImageIndex = wrongExtension.events[eventIndex].images.findIndex((image) => path.extname(image.thumbnail) !== ".png");
  assert.notEqual(nonPngImageIndex, -1);
  wrongExtension.events[eventIndex].images[nonPngImageIndex].thumbnail = wrongExtension.events[eventIndex].images[nonPngImageIndex].thumbnail
    .replace(/\.[^.]+$/, ".png");
  result = validateContent({ siteDir, overrides: { "gallery.json": wrongExtension } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("extensions must match")));

  const duplicate = structuredClone(gallery);
  duplicate.events[eventIndex].images[1].src = duplicate.events[eventIndex].images[0].src;
  result = validateContent({ siteDir, overrides: { "gallery.json": duplicate } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate Gallery asset path")));

  const zeroStem = structuredClone(gallery);
  for (const key of ["src", "thumbnail"]) {
    zeroStem.events[eventIndex].images[0][key] = zeroStem.events[eventIndex].images[0][key].replace(/([0-9]+)(\.[^.]+)$/, "00$2");
  }
  result = validateContent({ siteDir, overrides: { "gallery.json": zeroStem } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("<number>.ext")));

  for (const invalidStem of ["1", "0001"]) {
    const invalidPadding = structuredClone(gallery);
    for (const key of ["src", "thumbnail"]) {
      invalidPadding.events[eventIndex].images[0][key] = invalidPadding.events[eventIndex].images[0][key]
        .replace(/([0-9]+)(\.[^.]+)$/, `${invalidStem}$2`);
    }
    result = validateContent({ siteDir, overrides: { "gallery.json": invalidPadding } });
    assert.equal(result.ok, false, `${invalidStem} must not be accepted as a canonical numeric stem`);
    assert.ok(result.errors.some((error) => error.includes("<number>.ext")));
  }

  const duplicateStem = structuredClone(gallery);
  const firstExtension = path.extname(duplicateStem.events[eventIndex].images[0].src);
  const alternateExtension = firstExtension === ".png" ? ".jpg" : ".png";
  duplicateStem.events[eventIndex].images[1].src = `assets/gallery/${duplicateStem.events[eventIndex].id}/01${alternateExtension}`;
  duplicateStem.events[eventIndex].images[1].thumbnail = `assets/gallery-thumbs/${duplicateStem.events[eventIndex].id}/01${alternateExtension}`;
  result = validateContent({ siteDir, overrides: { "gallery.json": duplicateStem } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate Gallery numeric stem")));
});

test("Gallery and Projects accept complete seq permutations and reject invalid or partial sequences without mutation", () => {
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  const projects = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "projects.json"), "utf8"));
  const cases = [
    {
      file: "gallery.json",
      document: gallery,
      images: (document) => document.events.find((event) => event.images.length === 3).images,
    },
    {
      file: "projects.json",
      document: projects,
      images: (document) => document.projects.find((project) => project.images?.length === 3).images,
    },
  ];
  const invalidSequences = [
    { label: "duplicate", values: [1, 1, 3] },
    { label: "zero", values: [0, 2, 3] },
    { label: "negative", values: [-1, 2, 3] },
    { label: "decimal", values: [1.5, 2, 3] },
    { label: "string", values: ["1", 2, 3] },
    { label: "partial", values: [1, undefined, 3] },
    { label: "gap", values: [1, 3, 4] },
  ];

  for (const fixture of cases) {
    const unsequenced = structuredClone(fixture.document);
    const unsequencedSnapshot = structuredClone(unsequenced);
    let result = validateContent({ siteDir, overrides: { [fixture.file]: unsequenced } });
    assert.equal(result.ok, true, `${fixture.file} without seq must remain valid: ${result.errors.join("\n")}`);
    assert.deepEqual(unsequenced, unsequencedSnapshot);

    const valid = structuredClone(fixture.document);
    fixture.images(valid).forEach((image, index) => { image.seq = [2, 1, 3][index]; });
    const validSnapshot = structuredClone(valid);
    const validPaths = fixture.images(valid).map((image) => image.src);
    result = validateContent({ siteDir, overrides: { [fixture.file]: valid } });
    assert.equal(result.ok, true, `${fixture.file} complete seq must be valid: ${result.errors.join("\n")}`);
    assert.deepEqual(valid, validSnapshot);
    assert.deepEqual(fixture.images(valid).map((image) => image.src), validPaths);

    for (const invalid of invalidSequences) {
      const document = structuredClone(fixture.document);
      fixture.images(document).forEach((image, index) => {
        const value = invalid.values[index];
        if (value !== undefined) image.seq = value;
      });
      const snapshot = structuredClone(document);
      result = validateContent({ siteDir, overrides: { [fixture.file]: document } });
      assert.equal(result.ok, false, `${fixture.file} must reject ${invalid.label} seq`);
      assert.ok(result.errors.some((error) => error.includes("seq")), result.errors.join("\n"));
      assert.deepEqual(document, snapshot);
    }
  }
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
  assert.equal(patents.length, 16);
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
      registrationDate: "2026.03.24",
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
