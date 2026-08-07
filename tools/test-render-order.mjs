import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const siteDir = path.resolve("site");
const sharedSource = fs.readFileSync(path.join(siteDir, "shared.js"), "utf8");
const gallerySource = fs.readFileSync(path.join(siteDir, "gallery.js"), "utf8");
const projectsSource = fs.readFileSync(path.join(siteDir, "projects.js"), "utf8");

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

test("Gallery grid and lightbox preserve [01, 03, 04, 02] JSON image order", async () => {
  const { context, elements } = createHarness();
  const eventId = "0123456789ab";
  const stems = ["01", "03", "04", "02"];
  const images = stems.map((stem) => ({
    src: `assets/gallery/${eventId}/${stem}.jpg`,
    thumbnail: `assets/gallery-thumbs/${eventId}/${stem}.jpg`,
    alt: `Image ${stem}`,
    caption: `Caption ${stem}`,
  }));
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
