import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const siteDir = path.resolve("site");
const sharedSource = fs.readFileSync(path.join(siteDir, "shared.js"), "utf8");
const gallerySource = fs.readFileSync(path.join(siteDir, "gallery.js"), "utf8");
const projectsSource = fs.readFileSync(path.join(siteDir, "projects.js"), "utf8");
const recordRendererSource = fs.readFileSync(path.join(siteDir, "record-renderers.js"), "utf8");

const element = () => {
  const handlers = new Map();
  return {
    addEventListener: (type, handler) => handlers.set(type, handler),
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    dataset: {},
    dispatch: (type, event = {}) => handlers.get(type)?.(event),
    focus: () => {},
    hidden: false,
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute: () => {},
    textContent: "",
  };
};

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

const renderGallery = async (images) => {
  const { context, elements } = createHarness();
  const eventId = "0123456789ab";
  const thumbnailButtons = images.map((_, index) => {
    const button = element();
    button.dataset = { event: "0", image: String(index) };
    return button;
  });
  const root = element();
  root.querySelectorAll = (selector) => selector === ".gallery-thumb" ? thumbnailButtons : [];
  elements.set("#gallery-content", root);

  const dialogImage = element();
  const dialogCaption = element();
  const controls = new Map([
    [".lightbox-close", element()],
    [".lightbox-prev", element()],
    [".lightbox-next", element()],
  ]);
  const dialog = element();
  dialog.open = false;
  dialog.querySelector = (selector) => controls.get(selector);
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatch("close"); };
  elements.set("#gallery-lightbox", dialog);
  elements.set("#lightbox-image", dialogImage);
  elements.set("#lightbox-caption", dialogCaption);

  context.DTPLab.loadJson = async () => ({
    page: {},
    events: [{ id: eventId, date: "2026.08", title: "Order fixture", description: "", images }],
  });
  await vm.runInContext(gallerySource, context);

  return { context, controls, dialog, dialogCaption, dialogImage, root, thumbnailButtons };
};

test("shared image sequence helper returns a stable copy without mutating arrays or image objects", () => {
  const { context } = createHarness();
  const sequenced = Object.freeze([
    Object.freeze({ src: "01.jpg", alt: "one", seq: 2 }),
    Object.freeze({ src: "02.jpg", alt: "two", seq: 1 }),
    Object.freeze({ src: "03.jpg", alt: "three", seq: 3 }),
  ]);
  const sequencedSnapshot = structuredClone(sequenced);
  const ordered = context.DTPLab.sortImagesBySeq(sequenced);
  assert.notEqual(ordered, sequenced);
  assert.deepEqual(Array.from(ordered, (image) => image.src), ["02.jpg", "01.jpg", "03.jpg"]);
  assert.equal(ordered[0], sequenced[1]);
  assert.equal(ordered[1], sequenced[0]);
  assert.deepEqual(sequenced, sequencedSnapshot);

  const unsequenced = [{ src: "03.jpg" }, { src: "01.jpg" }, { src: "02.jpg" }];
  const unsequencedSnapshot = structuredClone(unsequenced);
  const preserved = context.DTPLab.sortImagesBySeq(unsequenced);
  assert.notEqual(preserved, unsequenced);
  assert.deepEqual(Array.from(preserved, (image) => image.src), ["03.jpg", "01.jpg", "02.jpg"]);
  assert.deepEqual(unsequenced, unsequencedSnapshot);

  const tied = [{ src: "a.jpg", seq: 1 }, { src: "b.jpg", seq: 1 }, { src: "c.jpg", seq: 2 }];
  assert.deepEqual(Array.from(context.DTPLab.sortImagesBySeq(tied), (image) => image.src), ["a.jpg", "b.jpg", "c.jpg"]);
});

test("Gallery grid and lightbox preserve unsequenced JSON image order", async () => {
  const eventId = "0123456789ab";
  const stems = ["01", "03", "04", "02"];
  const images = stems.map((stem) => ({
    src: `assets/gallery/${eventId}/${stem}.jpg`,
    thumbnail: `assets/gallery-thumbs/${eventId}/${stem}.jpg`,
    alt: `Image ${stem}`,
    caption: `Caption ${stem}`,
  }));
  const snapshot = structuredClone(images);
  const { controls, dialog, dialogImage, root, thumbnailButtons } = await renderGallery(images);

  const renderedThumbnails = [...root.innerHTML.matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(renderedThumbnails, stems.map((stem) => `/assets/gallery-thumbs/${eventId}/${stem}.jpg`));

  thumbnailButtons[0].dispatch("click");
  assert.equal(dialog.open, true);
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/01.jpg`);
  for (const expectedStem of ["03", "04", "02"]) {
    controls.get(".lightbox-next").dispatch("click");
    assert.equal(dialogImage.src, `/assets/gallery/${eventId}/${expectedStem}.jpg`);
  }
  controls.get(".lightbox-next").dispatch("click");
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/01.jpg`);
  controls.get(".lightbox-prev").dispatch("click");
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/02.jpg`);
  assert.deepEqual(images, snapshot);
});

test("Gallery grid, lightbox source, alt, and caption share seq order", async () => {
  const eventId = "0123456789ab";
  const images = [
    { src: `assets/gallery/${eventId}/01.jpg`, thumbnail: `assets/gallery-thumbs/${eventId}/01.jpg`, alt: "Alt 01", caption: "Caption 01", seq: 2 },
    { src: `assets/gallery/${eventId}/02.jpg`, thumbnail: `assets/gallery-thumbs/${eventId}/02.jpg`, alt: "Alt 02", caption: "Caption 02", seq: 1 },
    { src: `assets/gallery/${eventId}/03.jpg`, thumbnail: `assets/gallery-thumbs/${eventId}/03.jpg`, alt: "Alt 03", caption: "Caption 03", seq: 3 },
  ];
  const snapshot = structuredClone(images);
  const { controls, dialogCaption, dialogImage, root, thumbnailButtons } = await renderGallery(images);
  const thumbnails = [...root.innerHTML.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)]
    .map((match) => ({ src: match[1], alt: match[2] }));
  assert.deepEqual(thumbnails, [
    { src: `/assets/gallery-thumbs/${eventId}/02.jpg`, alt: "Alt 02" },
    { src: `/assets/gallery-thumbs/${eventId}/01.jpg`, alt: "Alt 01" },
    { src: `/assets/gallery-thumbs/${eventId}/03.jpg`, alt: "Alt 03" },
  ]);

  thumbnailButtons[0].dispatch("click");
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/02.jpg`);
  assert.equal(dialogImage.alt, "Alt 02");
  assert.equal(dialogCaption.textContent, "Caption 02");
  controls.get(".lightbox-next").dispatch("click");
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/01.jpg`);
  assert.equal(dialogImage.alt, "Alt 01");
  assert.equal(dialogCaption.textContent, "Caption 01");
  controls.get(".lightbox-next").dispatch("click");
  assert.equal(dialogImage.src, `/assets/gallery/${eventId}/03.jpg`);
  assert.equal(dialogImage.alt, "Alt 03");
  assert.equal(dialogCaption.textContent, "Caption 03");
  assert.deepEqual(images, snapshot);
});

test("Projects record gallery renders seq order without changing upload paths or objects", () => {
  const { context } = createHarness();
  vm.runInContext(recordRendererSource, context);
  const images = [
    { src: "assets/projects/order/01.jpg", alt: "Alt 01", seq: 2 },
    { src: "assets/projects/order/02.jpg", alt: "Alt 02", seq: 1 },
    { src: "assets/projects/order/03.jpg", alt: "Alt 03", seq: 3 },
  ];
  const snapshot = structuredClone(images);
  const html = context.DTPLab.recordRenderers.renderProjectCard({
    category: "rnd",
    title: "Sequence fixture",
    keywords: [],
    details: [],
    images,
  });
  const rendered = [...html.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)]
    .map((match) => ({ src: match[1], alt: match[2] }));
  assert.deepEqual(rendered, [
    { src: "/assets/projects/order/02.jpg", alt: "Alt 02" },
    { src: "/assets/projects/order/01.jpg", alt: "Alt 01" },
    { src: "/assets/projects/order/03.jpg", alt: "Alt 03" },
  ]);
  assert.deepEqual(images, snapshot);

  const unsequenced = [
    { src: "assets/projects/order/03.jpg", alt: "Alt 03" },
    { src: "assets/projects/order/01.jpg", alt: "Alt 01" },
    { src: "assets/projects/order/02.jpg", alt: "Alt 02" },
  ];
  const unsequencedSnapshot = structuredClone(unsequenced);
  const unsequencedHtml = context.DTPLab.recordRenderers.renderProjectCard({
    category: "rnd",
    title: "Unsequenced fixture",
    keywords: [],
    details: [],
    images: unsequenced,
  });
  assert.deepEqual(
    [...unsequencedHtml.matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]),
    [
      "/assets/projects/order/03.jpg",
      "/assets/projects/order/01.jpg",
      "/assets/projects/order/02.jpg",
    ],
  );
  assert.deepEqual(unsequenced, unsequencedSnapshot);
});

test("Projects preserve JSON order within status sections and category filters", async () => {
  const { context, elements } = createHarness();
  const root = element();
  elements.set("#projects-content", root);
  const allButton = element();
  allButton.dataset.projectCategory = "all";
  const rndButton = element();
  rndButton.dataset.projectCategory = "rnd";
  context.document.querySelectorAll = (selector) => selector === "[data-project-category]" ? [allButton, rndButton] : [];
  const projects = [
    { id: "current-z", status: "current", category: "rnd", period: { start: "2020.01", end: "2020.12" } },
    { id: "completed-z", status: "completed", category: "rnd", period: { start: "2019.01", end: "2019.12" } },
    { id: "current-a", status: "current", category: "industry", period: { start: "2030.01", end: "2030.12" } },
    { id: "completed-a", status: "completed", category: "industry", period: { start: "2029.01", end: "2029.12" } },
    { id: "current-m", status: "current", category: "rnd", period: { start: "2025.01", end: "2025.12" } },
    { id: "completed-m", status: "completed", category: "rnd", period: { start: "2024.01", end: "2024.12" } },
  ];
  const originalOrder = projects.map((project) => project.id);
  const sectionOrder = ["current-z", "current-a", "current-m", "completed-z", "completed-a", "completed-m"];
  context.DTPLab.loadJson = async () => ({ page: {}, projects });
  context.DTPLab.recordRenderers = {
    bindProjectGalleryRatios: () => {},
    renderProjectCard: (project) => `<article data-project-id="${project.id}"></article>`,
  };

  await vm.runInContext(projectsSource, context);

  const renderedOrder = [...root.innerHTML.matchAll(/data-project-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(renderedOrder, sectionOrder);
  assert.deepEqual(projects.map((project) => project.id), originalOrder, "Projects renderer must not mutate JSON order");

  rndButton.dispatch("click");
  const filteredOrder = [...root.innerHTML.matchAll(/data-project-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(filteredOrder, ["current-z", "current-m", "completed-z", "completed-m"]);
});
