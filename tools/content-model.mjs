import fs from "node:fs";
import path from "node:path";

const controlledKeywords = [
  "Digital Twin",
  "Physical AI",
  "Sim2Real",
  "Robotics",
  "Reinforcement Learning",
  "Optimization",
  "Surrogate Modeling",
  "Computer Vision",
  "Synthetic Data",
  "Energy Systems",
  "AI Education",
  "World Models",
  "Foundation Models",
  "Generative AI",
  "Localization",
  "Control",
  "Multimodal AI",
  "Scientific Machine Learning",
  "Sequence Modeling",
  "Resource Allocation",
  "Scheduling",
  "Deep Learning",
  "Extended Reality",
];

const stringField = (name, label, extra = {}) => ({ name, label, type: "string", ...extra });
const textField = (name, label, extra = {}) => ({ name, label, type: "text", ...extra });
const booleanField = (name, label, extra = {}) => ({ name, label, type: "boolean", ...extra });
const listField = (name, label, item, extra = {}) => ({ name, label, type: "list", item, ...extra });
const objectField = (name, label, fields, extra = {}) => ({ name, label, type: "object", fields, ...extra });
const selectField = (name, label, options, extra = {}) => ({ name, label, type: "select", options, ...extra });

const projectImageFields = [
  stringField("src", "이미지 경로", { required: true, input: "image" }),
  stringField("alt", "대체 텍스트", { required: true }),
];

const galleryImageFields = [
  stringField("src", "이미지 경로", { required: true, input: "image" }),
  stringField("thumbnail", "썸네일 경로", { input: "image", optional: true }),
  stringField("alt", "대체 텍스트", { required: true }),
  stringField("caption", "캡션", { optional: true }),
];

const personFields = [
  stringField("image", "프로필 이미지", { input: "image", optional: true }),
  stringField("name", "이름", { required: true }),
  { name: "fields", label: "상세 정보", type: "map", valueType: "string" },
];

export const publicationMetricDefaults = {
  journal: { journalMetrics: { indexing: "없음", quartile: "해당없음", award: "" } },
  conference: { conferenceMetrics: { conferenceType: "미분류", bk21: "해당없음", kiise: "해당없음" } },
  patent: { patentMetrics: { jurisdiction: "국내", status: "출원" } },
};

export function normalizePublicationMetrics(item) {
  const normalized = structuredClone(item);
  delete normalized.metrics;
  delete normalized.patentStatus;
  for (const key of ["journalMetrics", "conferenceMetrics", "patentMetrics"]) {
    if (key !== Object.keys(publicationMetricDefaults[normalized.type] || {})[0]) delete normalized[key];
  }
  const expectedKey = `${normalized.type}Metrics`;
  if (publicationMetricDefaults[normalized.type] && !normalized[expectedKey]) {
    Object.assign(normalized, structuredClone(publicationMetricDefaults[normalized.type]));
  }
  if (normalized.type === "journal") {
    normalized.journalMetrics ||= structuredClone(publicationMetricDefaults.journal.journalMetrics);
    if (normalized.journalMetrics.indexing !== "SCIE") normalized.journalMetrics.quartile = "해당없음";
  }
  if (normalized.type === "conference") {
    normalized.conferenceMetrics ||= structuredClone(publicationMetricDefaults.conference.conferenceMetrics);
    if (normalized.conferenceMetrics.conferenceType !== "국제") {
      normalized.conferenceMetrics.bk21 = "해당없음";
      normalized.conferenceMetrics.kiise = "해당없음";
    }
  }
  return normalized;
}

const publicationFields = [
  stringField("id", "ID", { required: true, generated: "publication-id" }),
  selectField("type", "종류", ["journal", "conference", "patent"], { required: true }),
  stringField("publishedAt", "발표일", { required: true, input: "month", pattern: "YYYY.MM" }),
  stringField("title", "제목", { required: true }),
  listField("authors", "저자", {
    type: "object",
    fields: [
      stringField("name", "이름", { required: true }),
      booleanField("isLabMember", "연구실 구성원"),
      booleanField("isFirstAuthor", "제1저자"),
      booleanField("isCorrespondingAuthor", "교신저자"),
    ],
  }),
  stringField("venue", "학술지·학회·관할", { optional: true }),
  textField("details", "상세 정보", { optional: true }),
  objectField("journalMetrics", "Journal 지표", [
    selectField("indexing", "색인", ["없음", "SCIE", "ESCI", "KCI"]),
    selectField("quartile", "Quartile", ["해당없음", "Top-5%", "Top-10%", "Q1", "Q2", "Q3", "Q4"], {
      enabledWhen: { path: ["journalMetrics", "indexing"], equals: "SCIE" },
    }),
    stringField("award", "수상", { optional: true }),
  ], { visibleWhen: { path: ["type"], equals: "journal" } }),
  objectField("conferenceMetrics", "Conference 지표", [
    selectField("conferenceType", "학회 종류", ["미분류", "국제", "국내"]),
    selectField("bk21", "BK21 우수학술대회", ["해당없음", "IF4", "IF3", "IF2", "IF1"], {
      enabledWhen: { path: ["conferenceMetrics", "conferenceType"], equals: "국제" },
    }),
    selectField("kiise", "정보과학회 우수학술대회", ["해당없음", "최우수", "우수"], {
      enabledWhen: { path: ["conferenceMetrics", "conferenceType"], equals: "국제" },
    }),
  ], { visibleWhen: { path: ["type"], equals: "conference" } }),
  objectField("patentMetrics", "Patent 지표", [
    selectField("jurisdiction", "관할", ["국내", "국제", "PCT"]),
    selectField("status", "상태", ["등록", "출원", "공개"]),
  ], { visibleWhen: { path: ["type"], equals: "patent" } }),
  listField("keywords", "키워드", { type: "select", options: controlledKeywords }, { maximum: 5 }),
  stringField("doi", "DOI", { optional: true }),
  listField("links", "외부 링크", {
    type: "object",
    fields: [
      stringField("label", "표시 이름", { required: true }),
      stringField("url", "HTTPS URL", { required: true, input: "url" }),
    ],
  }),
];

export const contentContract = {
  version: 2,
  site: "dtp-lab.github.io",
  controlledKeywords,
  views: [
    { key: "home-title", label: "Home-Title", file: "home.json", route: "/", records: [{ type: "object", path: ["hero"], label: "홈 타이틀" }] },
    { key: "home-recruit", label: "Home-Recruit", file: "home.json", route: "/#recruitment", records: [{ type: "object", path: ["recruitment"], label: "모집 안내" }] },
    {
      key: "home-research",
      label: "Home-Research",
      file: "research.json",
      route: "/#research",
      records: [
        { type: "object", path: ["section"], label: "섹션 제목" },
        { type: "object", path: ["overviewImage"], label: "연구 개요 이미지" },
        { type: "collection", path: ["research"], label: "연구 분야", mutable: false },
      ],
    },
    {
      key: "home-news",
      label: "Home-News",
      file: "news.json",
      route: "/#news",
      records: [
        { type: "object", path: ["section"], label: "섹션 제목" },
        { type: "collection", path: ["news"], label: "소식", mutable: true },
      ],
    },
    {
      key: "people",
      label: "People",
      file: "people.json",
      route: "/people/",
      records: [
        { type: "object", path: ["page"], label: "페이지 제목" },
        { type: "collection", path: ["groups", "professor"], label: "Professor", mutable: true, group: "professor" },
        { type: "collection", path: ["groups", "phd"], label: "Ph.D.", mutable: true, group: "phd" },
        { type: "collection", path: ["groups", "ms"], label: "M.S.", mutable: true, group: "ms" },
        { type: "collection", path: ["groups", "undergrad"], label: "Undergraduate", mutable: true, group: "undergrad" },
        { type: "collection", path: ["groups", "alumni"], label: "Alumni", mutable: true, group: "alumni" },
      ],
    },
    {
      key: "projects",
      label: "Projects",
      file: "projects.json",
      route: "/projects/",
      records: [
        { type: "object", path: ["page"], label: "페이지 제목" },
        { type: "collection", path: ["projects"], label: "프로젝트", mutable: true },
      ],
    },
    {
      key: "publications",
      label: "Publications",
      file: "publications.json",
      route: "/publications/",
      records: [
        { type: "object", path: ["page"], label: "페이지 제목" },
        { type: "collection", path: ["items"], label: "연구 성과", mutable: true },
      ],
    },
    {
      key: "seminars",
      label: "Seminars",
      file: "seminars.json",
      route: "/seminars/",
      records: [
        { type: "object", path: ["page"], label: "페이지 제목" },
        { type: "collection", path: ["seminars"], label: "세미나", mutable: true },
      ],
    },
    {
      key: "gallery",
      label: "Gallery",
      file: "gallery.json",
      route: "/gallery/",
      records: [
        { type: "object", path: ["page"], label: "페이지 제목" },
        { type: "collection", path: ["events"], label: "행사", mutable: true },
      ],
    },
  ],
  files: {
    home: {
      file: "home.json",
      label: "Home",
      route: "/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("hero", "홈 타이틀", [
          stringField("kicker", "상단 문구", { required: true }),
          textField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { required: true }),
        ]),
        objectField("recruitment", "모집 안내", [
          stringField("summaryKicker", "요약 분류", { required: true }),
          stringField("summaryTitle", "요약 제목", { required: true }),
          stringField("eyebrow", "소개 문구", { required: true }),
          textField("intro", "소개", { required: true }),
          stringField("contactEmail", "연락 이메일", { required: true }),
          listField("sections", "안내 섹션", {
            type: "object",
            fields: [
              stringField("title", "제목", { required: true }),
              listField("items", "내용", { type: "string" }, { minimum: 1 }),
            ],
          }),
        ]),
      ],
    },
    news: {
      file: "news.json",
      label: "News",
      route: "/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("section", "섹션 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
        ]),
        listField("news", "소식", {
          type: "object",
          fields: [
            stringField("date", "날짜", { required: true, input: "month", pattern: "YYYY.MM" }),
            selectField("category", "분류", ["project", "publication", "award", "member"], { required: true }),
            textField("text", "내용", { required: true }),
          ],
        }),
      ],
    },
    people: {
      file: "people.json",
      label: "People",
      route: "/people/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("page", "페이지 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { optional: true }),
        ]),
        objectField("groups", "구성원 그룹", [
          listField("professor", "Professor", { type: "object", fields: personFields }),
          listField("phd", "Ph.D.", { type: "object", fields: personFields }),
          listField("ms", "M.S.", { type: "object", fields: personFields }),
          listField("undergrad", "Undergraduate", { type: "object", fields: personFields }),
          listField("alumni", "Alumni", { type: "object", fields: personFields }),
        ]),
      ],
    },
    research: {
      file: "research.json",
      label: "Research",
      route: "/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("section", "섹션 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
        ]),
        objectField("overviewImage", "연구 개요 이미지", projectImageFields),
        listField("research", "연구 분야", {
          type: "object",
          fields: [
            stringField("label", "레이블", { required: true }),
            stringField("title", "제목", { required: true }),
            stringField("subtitle", "부제", { required: true }),
            textField("description", "설명", { required: true }),
            listField("focus", "핵심 주제", { type: "string" }),
            stringField("image", "이미지", { input: "image", optional: true }),
          ],
        }, { minimum: 4, maximum: 4 }),
      ],
    },
    projects: {
      file: "projects.json",
      label: "Projects",
      route: "/projects/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("page", "페이지 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { optional: true }),
        ]),
        listField("projects", "프로젝트", {
          type: "object",
          fields: [
            stringField("id", "ID", { required: true, generated: "project-id" }),
            selectField("status", "상태", ["current", "completed"], { required: true }),
            selectField("category", "분류", ["industry", "rnd", "talent"], { required: true }),
            stringField("title", "과제명", { required: true }),
            stringField("program", "사업명", { optional: true }),
            objectField("period", "기간", [
              stringField("start", "시작", { required: true, input: "month", pattern: "YYYY.MM" }),
              stringField("end", "종료", { required: true, input: "month", pattern: "YYYY.MM" }),
            ]),
            listField("keywords", "키워드", { type: "select", options: controlledKeywords }, { maximum: 5 }),
            textField("description", "개요", { optional: true }),
            listField("details", "세부 연구내용", { type: "string" }),
            listField("images", "이미지", { type: "object", fields: projectImageFields }),
          ],
        }),
      ],
    },
    publications: {
      file: "publications.json",
      label: "Publications",
      route: "/publications/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("page", "페이지 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { optional: true }),
        ]),
        listField("items", "연구 성과", { type: "object", fields: publicationFields }),
      ],
    },
    seminars: {
      file: "seminars.json",
      label: "Seminars",
      route: "/seminars/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("page", "페이지 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { optional: true }),
        ]),
        listField("seminars", "세미나", {
          type: "object",
          fields: [
            stringField("date", "날짜", { required: true, input: "date", pattern: "YYYY.MM.DD" }),
            stringField("title", "제목", { required: true }),
            stringField("speaker", "발표자", { required: true }),
            textField("summary", "요약", { required: true }),
            listField("keywords", "키워드", { type: "select", options: controlledKeywords }, { minimum: 1, maximum: 4 }),
          ],
        }),
      ],
    },
    gallery: {
      file: "gallery.json",
      label: "Gallery",
      route: "/gallery/",
      editable: true,
      lockedPaths: [],
      fields: [
        objectField("page", "페이지 제목", [
          stringField("kicker", "상단 문구", { required: true }),
          stringField("title", "제목", { required: true }),
          stringField("subtitle", "부제", { optional: true }),
        ]),
        listField("events", "행사", {
          type: "object",
          fields: [
            stringField("date", "날짜", { required: true, input: "month", pattern: "YYYY.MM" }),
            stringField("title", "제목", { required: true }),
            textField("description", "설명", { optional: true }),
            booleanField("isSample", "레이아웃 점검 샘플", { optional: true }),
            listField("images", "이미지", { type: "object", fields: galleryImageFields }),
          ],
        }),
      ],
    },
    citations: {
      file: "citations.json",
      label: "Citation cache",
      route: "/publications/",
      editable: false,
      lockedPaths: ["*"],
      fields: [],
    },
  },
};

const validDate = (value, day = false) => new RegExp(day ? "^\\d{4}\\.(0[1-9]|1[0-2])\\.(0[1-9]|[12]\\d|3[01])$" : "^\\d{4}\\.(0[1-9]|1[0-2])$").test(value || "");
const dateValue = (value = "") => Number(String(value).replace(/[^0-9]/g, "")) || 0;

export function validateContent({
  siteDir = path.resolve("site"),
  overrides = {},
  virtualAssets = [],
} = {}) {
  const dataDir = path.join(siteDir, "data");
  const errors = [];
  const warnings = [];
  const virtualAssetSet = new Set([...virtualAssets].map((value) => String(value).replaceAll("\\", "/")));
  const read = (name) => {
    try {
      if (Object.prototype.hasOwnProperty.call(overrides, name)) return structuredClone(overrides[name]);
      return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
      return {};
    }
  };
  const requiredText = (value, location) => {
    if (typeof value !== "string" || !value.trim()) errors.push(`${location}: required text is missing`);
  };
  const rejectKeys = (value, keys, location) => {
    if (!value || typeof value !== "object") return;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}.${key}: field is not part of the public content model`);
    }
  };
  const validateHeading = (value, location) => {
    requiredText(value?.kicker, `${location}.kicker`);
    requiredText(value?.title, `${location}.title`);
    if (value?.subtitle !== undefined && typeof value.subtitle !== "string") errors.push(`${location}.subtitle: text required`);
  };
  const validateKeywords = (keywords, location, maximum = 5) => {
    if (!Array.isArray(keywords)) return errors.push(`${location}: keywords must be an array`);
    if (keywords.length > maximum) errors.push(`${location}: use at most ${maximum} keywords`);
    if (new Set(keywords).size !== keywords.length) errors.push(`${location}: duplicate keyword`);
    keywords.forEach((keyword) => {
      if (typeof keyword !== "string" || !keyword.trim()) errors.push(`${location}: keywords must be non-empty text`);
    });
  };
  const validateImagePath = (image, location) => {
    if (!image) return;
    if (/^https?:/i.test(image)) {
      errors.push(`${location}: remote images are not allowed`);
      return;
    }
    const normalized = String(image).replaceAll("\\", "/");
    const resolved = path.resolve(siteDir, normalized);
    if (!resolved.startsWith(`${path.resolve(siteDir)}${path.sep}`) && resolved !== path.resolve(siteDir)) {
      errors.push(`${location}: image path escapes site (${image})`);
    } else if (!virtualAssetSet.has(normalized) && !fs.existsSync(resolved)) {
      errors.push(`${location}: file does not exist (${image})`);
    }
  };
  const validateImages = (images, location) => {
    if (!Array.isArray(images)) return errors.push(`${location}.images: must be an array`);
    images.forEach((image, index) => {
      if (!image || typeof image !== "object") return errors.push(`${location}.images[${index}]: use an image object`);
      requiredText(image.src, `${location}.images[${index}].src`);
      requiredText(image.alt, `${location}.images[${index}].alt`);
      validateImagePath(image.src, `${location}.images[${index}].src`);
      if (image.thumbnail !== undefined && image.thumbnail !== "") {
        requiredText(image.thumbnail, `${location}.images[${index}].thumbnail`);
        validateImagePath(image.thumbnail, `${location}.images[${index}].thumbnail`);
      }
    });
  };
  const validateImageObject = (image, location) => {
    if (!image || typeof image !== "object") return errors.push(`${location}: use {src, alt}`);
    requiredText(image.src, `${location}.src`);
    requiredText(image.alt, `${location}.alt`);
    validateImagePath(image.src, `${location}.src`);
  };

  const home = read("home.json");
  rejectKeys(home, ["source", "migrated"], "home");
  validateHeading(home.hero, "home.hero");
  requiredText(home.hero?.subtitle, "home.hero.subtitle");
  requiredText(home.recruitment?.summaryKicker, "home.recruitment.summaryKicker");
  requiredText(home.recruitment?.summaryTitle, "home.recruitment.summaryTitle");
  requiredText(home.recruitment?.eyebrow, "home.recruitment.eyebrow");
  requiredText(home.recruitment?.intro, "home.recruitment.intro");
  requiredText(home.recruitment?.contactEmail, "home.recruitment.contactEmail");
  (home.recruitment?.sections || []).forEach((section, index) => {
    requiredText(section.title, `home.sections[${index}].title`);
    if (!section.items?.length) errors.push(`home.sections[${index}].items: at least one item required`);
  });

  const newsDocument = read("news.json");
  rejectKeys(newsDocument, ["source", "migrated"], "news");
  validateHeading(newsDocument.section, "news.section");
  const news = newsDocument.news || [];
  news.forEach((item, index) => {
    if (!validDate(item.date)) errors.push(`news[${index}].date: use YYYY.MM`);
    if (!["project", "publication", "award", "member"].includes(item.category)) errors.push(`news[${index}].category: unsupported category`);
    requiredText(item.text, `news[${index}].text`);
  });

  const peopleDocument = read("people.json");
  rejectKeys(peopleDocument, ["source", "migrated"], "people");
  validateHeading(peopleDocument.page, "people.page");
  const people = peopleDocument.groups || {};
  for (const group of ["professor", "phd", "ms", "undergrad", "alumni"]) {
    if (!Array.isArray(people[group])) errors.push(`people.${group}: group is missing`);
    (people[group] || []).forEach((member, index) => {
      rejectKeys(member, ["group", "notes"], `people.${group}[${index}]`);
      rejectKeys(member.fields, ["interests"], `people.${group}[${index}].fields`);
      requiredText(member.name, `people.${group}[${index}].name`);
      validateImagePath(member.image, `people.${group}[${index}].image`);
    });
  }

  const research = read("research.json");
  rejectKeys(research, ["source", "migrated", "images"], "research");
  validateHeading(research.section, "research.section");
  validateImageObject(research.overviewImage, "research.overviewImage");
  if ((research.research || []).length !== 4) errors.push("research: four research directions are required");
  (research.research || []).forEach((topic, index) => {
    requiredText(topic.title, `research[${index}].title`);
    requiredText(topic.description, `research[${index}].description`);
    validateImagePath(topic.image, `research[${index}].image`);
  });

  const projectsDocument = read("projects.json");
  rejectKeys(projectsDocument, ["source", "migrated"], "projects");
  validateHeading(projectsDocument.page, "projects.page");
  const projects = projectsDocument.projects || [];
  const projectIds = new Set();
  projects.forEach((project, index) => {
    const at = `projects[${index}]`;
    requiredText(project.id, `${at}.id`);
    requiredText(project.title, `${at}.title`);
    rejectKeys(project, ["sponsor", "managingAgency", "budget", "rawMeta"], at);
    if (projectIds.has(project.id)) errors.push(`${at}.id: duplicate`);
    projectIds.add(project.id);
    if (!["current", "completed"].includes(project.status)) errors.push(`${at}.status: unsupported status`);
    if (!["industry", "rnd", "talent"].includes(project.category)) errors.push(`${at}.category: unsupported category`);
    if (!validDate(project.period?.start) || !validDate(project.period?.end)) errors.push(`${at}.period: use YYYY.MM for start and end`);
    if (project.period?.start && project.period?.end && dateValue(project.period.start) > dateValue(project.period.end)) errors.push(`${at}.period: start is after end`);
    validateKeywords(project.keywords, `${at}.keywords`);
    validateImages(project.images, at);
    if (project.status === "current" && dateValue(project.period?.end) < dateValue(new Date().toISOString().slice(0, 7))) {
      warnings.push(`${at}: Current project ended at ${project.period?.end}; status is preserved`);
    }
  });

  const publicationsDocument = read("publications.json");
  rejectKeys(publicationsDocument, ["source", "migrated"], "publications");
  validateHeading(publicationsDocument.page, "publications.page");
  const publications = publicationsDocument.items || [];
  const publicationIds = new Set();
  publications.forEach((item, index) => {
    const at = `publications[${index}]`;
    requiredText(item.id, `${at}.id`);
    requiredText(item.title, `${at}.title`);
    rejectKeys(item, ["rawCitation", "semanticScholarId", "patentNumber", "metrics", "patentStatus"], at);
    if (publicationIds.has(item.id)) errors.push(`${at}.id: duplicate`);
    publicationIds.add(item.id);
    if (!["journal", "conference", "patent"].includes(item.type)) errors.push(`${at}.type: unsupported type`);
    if (!validDate(item.publishedAt)) errors.push(`${at}.publishedAt: use YYYY.MM`);
    validateKeywords(item.keywords, `${at}.keywords`);
    (item.authors || []).forEach((author, authorIndex) => {
      requiredText(author.name, `${at}.authors[${authorIndex}].name`);
      for (const key of ["isLabMember", "isFirstAuthor", "isCorrespondingAuthor"]) {
        if (typeof author[key] !== "boolean") errors.push(`${at}.authors[${authorIndex}].${key}: boolean required`);
      }
    });
    if (item.type !== "patent" && item.authors?.length && !item.authors.some((author) => author.isFirstAuthor)) {
      warnings.push(`${at}: no first author marker in source`);
    }
    const metricKeys = ["journalMetrics", "conferenceMetrics", "patentMetrics"];
    const expectedMetricKey = `${item.type}Metrics`;
    metricKeys.filter((key) => key !== expectedMetricKey).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(item, key)) errors.push(`${at}.${key}: metrics do not match publication type`);
    });
    if (!item[expectedMetricKey] || typeof item[expectedMetricKey] !== "object") {
      errors.push(`${at}.${expectedMetricKey}: required for publication type`);
    } else if (item.type === "journal") {
      const metrics = item.journalMetrics;
      rejectKeys(metrics, ["topPercent", "metricYear"], `${at}.journalMetrics`);
      if (!["없음", "SCIE", "ESCI", "KCI"].includes(metrics.indexing)) errors.push(`${at}.journalMetrics.indexing: unsupported value`);
      if (!["해당없음", "Top-5%", "Top-10%", "Q1", "Q2", "Q3", "Q4"].includes(metrics.quartile)) errors.push(`${at}.journalMetrics.quartile: unsupported value`);
      if (metrics.indexing !== "SCIE" && metrics.quartile !== "해당없음") errors.push(`${at}.journalMetrics.quartile: SCIE only`);
      if (typeof metrics.award !== "string") errors.push(`${at}.journalMetrics.award: text required`);
    } else if (item.type === "conference") {
      const metrics = item.conferenceMetrics;
      if (!["미분류", "국제", "국내"].includes(metrics.conferenceType)) errors.push(`${at}.conferenceMetrics.conferenceType: unsupported value`);
      if (!["해당없음", "IF4", "IF3", "IF2", "IF1"].includes(metrics.bk21)) errors.push(`${at}.conferenceMetrics.bk21: unsupported value`);
      if (!["해당없음", "최우수", "우수"].includes(metrics.kiise)) errors.push(`${at}.conferenceMetrics.kiise: unsupported value`);
      if (metrics.conferenceType !== "국제" && (metrics.bk21 !== "해당없음" || metrics.kiise !== "해당없음")) errors.push(`${at}.conferenceMetrics: grades require 국제`);
    } else if (item.type === "patent") {
      const metrics = item.patentMetrics;
      if (!["국내", "국제", "PCT"].includes(metrics.jurisdiction)) errors.push(`${at}.patentMetrics.jurisdiction: unsupported value`);
      if (!["등록", "출원", "공개"].includes(metrics.status)) errors.push(`${at}.patentMetrics.status: unsupported value`);
    }
    (item.links || []).forEach((link, linkIndex) => {
      requiredText(link.label, `${at}.links[${linkIndex}].label`);
      if (!/^https:\/\//.test(link.url || "")) errors.push(`${at}.links[${linkIndex}].url: HTTPS required`);
    });
  });

  const seminarsDocument = read("seminars.json");
  rejectKeys(seminarsDocument, ["source", "migrated"], "seminars");
  validateHeading(seminarsDocument.page, "seminars.page");
  const seminars = seminarsDocument.seminars || [];
  seminars.forEach((seminar, index) => {
    const at = `seminars[${index}]`;
    if (!validDate(seminar.date, true)) errors.push(`${at}.date: use YYYY.MM.DD`);
    requiredText(seminar.title, `${at}.title`);
    requiredText(seminar.speaker, `${at}.speaker`);
    requiredText(seminar.summary, `${at}.summary`);
    validateKeywords(seminar.keywords, `${at}.keywords`, 4);
    if (!seminar.keywords?.length) errors.push(`${at}.keywords: at least one keyword required`);
  });

  const galleryDocument = read("gallery.json");
  rejectKeys(galleryDocument, ["source", "migrated"], "gallery");
  validateHeading(galleryDocument.page, "gallery.page");
  const gallery = galleryDocument.events || [];
  gallery.forEach((event, index) => {
    if (!validDate(event.date)) errors.push(`gallery[${index}].date: use YYYY.MM`);
    requiredText(event.title, `gallery[${index}].title`);
    if (event.isSample !== undefined && typeof event.isSample !== "boolean") errors.push(`gallery[${index}].isSample: boolean required`);
    validateImages(event.images, `gallery[${index}]`);
  });

  const citations = read("citations.json");
  rejectKeys(citations, ["source", "updatedAt"], "citations");
  for (const [id, citation] of Object.entries(citations.papers || {})) {
    rejectKeys(citation, ["paperId", "checkedAt"], `citations.papers.${id}`);
    if (!Number.isInteger(citation?.citationCount)) errors.push(`citations.papers.${id}.citationCount: integer required`);
    if (citation?.url && !/^https:\/\//.test(citation.url)) errors.push(`citations.papers.${id}.url: HTTPS required`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      news: news.length,
      projects: projects.length,
      publications: publications.length,
      seminars: seminars.length,
      gallery: gallery.length,
    },
  };
}
