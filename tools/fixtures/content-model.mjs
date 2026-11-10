import path from "node:path";
import { validateContent } from "../content-model.mjs";

const heading = () => ({ kicker: "Fixture", title: "Synthetic content" });

export const createPeopleFixture = () => ({
  page: heading(),
  professor: { name: "Fixture Professor", image: "", career: [] },
  members: ["phd", "master", "undergraduate", "alumni", "staff"].map((category) => ({
    name: `Fixture ${category}`, category, image: "",
    affiliation: "Fixture Lab", email: "member@example.test", researchTopic: "Testing",
  })),
});

export const createGalleryFixture = (stems = ["01", "02", "03"]) => ({
  page: heading(),
  events: [{
    id: "0123456789ab", title: "Fixture event", date: "2026.01",
    images: stems.map((stem) => ({
      src: `assets/gallery/0123456789ab/${stem}.jpg`,
      thumbnail: `assets/gallery-thumbs/0123456789ab/${stem}.jpg`,
      alt: `Fixture image ${stem}`,
    })),
  }],
});

export const createProjectsFixture = (stems = ["01", "02", "03"]) => ({
  page: heading(),
  projects: [{
    id: "fixture-project", title: "Fixture project", status: "completed", category: "rnd",
    period: { start: "2025.01", end: "2025.12" }, keywords: ["Testing"],
    images: stems.map((stem) => ({ src: `assets/projects/fixture/${stem}.jpg`, alt: `Fixture image ${stem}` })),
  }],
});

// Supply every document so unit tests never fall back to the live site/data files.
export const validateFixture = (overrides = {}, { siteDir = path.resolve("tools/fixtures/virtual-site") } = {}) => {
  const documents = {
    "home.json": {
      hero: { ...heading(), subtitle: "Fixture introduction" },
      recruitment: {
        summaryKicker: "Join", summaryTitle: "Fixture recruitment", eyebrow: "Welcome",
        intro: "Fixture invitation", contactEmail: "lab@example.test", sections: [],
      },
    },
    "news.json": { section: heading(), news: [] },
    "people.json": createPeopleFixture(),
    "research.json": {
      section: heading(), overviewImage: { src: "assets/fixture-overview.svg", alt: "Fixture overview" },
      research: Array.from({ length: 4 }, (_, index) => ({ title: `Direction ${index}`, description: "Fixture research" })),
    },
    "projects.json": createProjectsFixture(),
    "publications.json": { page: heading(), items: [] },
    "seminars.json": { page: heading(), seminars: [] },
    "gallery.json": createGalleryFixture(),
    "citations.json": { papers: {} },
    ...overrides,
  };
  const virtualAssets = [];
  const collectAssets = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["image", "src", "thumbnail"].includes(key) && typeof child === "string" && child) virtualAssets.push(child);
      else collectAssets(child);
    }
  };
  collectAssets(documents);
  return validateContent({ siteDir, overrides: documents, virtualAssets });
};
