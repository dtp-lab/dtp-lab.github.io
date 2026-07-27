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

const imageFields = [
  stringField("src", "이미지 경로", { required: true, input: "image" }),
  stringField("thumbnail", "썸네일 경로", { input: "image", optional: true }),
  stringField("alt", "대체 텍스트", { required: true }),
  stringField("caption", "캡션", { optional: true }),
];

const personFields = [
  stringField("group", "그룹", { readonly: true }),
  stringField("image", "프로필 이미지", { input: "image", optional: true }),
  stringField("name", "이름", { required: true }),
  { name: "fields", label: "상세 정보", type: "map", valueType: "string" },
  listField("notes", "직책·메모", { type: "string" }),
];

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
  stringField("patentStatus", "특허 상태", { optional: true }),
  stringField("patentNumber", "특허 번호", { optional: true }),
  objectField("metrics", "지표", [
    selectField("indexing", "색인", ["", "SCIE", "ESCI", "KCI"]),
    selectField("quartile", "Quartile", ["", "Q1", "Q2", "Q3", "Q4"]),
    stringField("topPercent", "상위 백분율", { optional: true }),
    stringField("award", "수상", { optional: true }),
    stringField("metricYear", "지표 연도", { optional: true }),
  ]),
  listField("keywords", "키워드", { type: "select", options: controlledKeywords }, { maximum: 5 }),
  stringField("doi", "DOI", { optional: true }),
  stringField("semanticScholarId", "Semantic Scholar ID", { optional: true }),
  listField("links", "외부 링크", {
    type: "object",
    fields: [
      stringField("label", "표시 이름", { required: true }),
      stringField("url", "HTTPS URL", { required: true, input: "url" }),
    ],
  }),
  textField("rawCitation", "원본 인용문", { required: true }),
];

export const contentContract = {
  version: 1,
  site: "dtp-lab.github.io",
  controlledKeywords,
  files: {
    home: {
      file: "home.json",
      label: "Home",
      route: "/",
      editable: true,
      lockedPaths: ["source"],
      fields: [
        objectField("recruitment", "모집 안내", [
          textField("intro", "소개", { required: true }),
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
      lockedPaths: ["source", "migrated"],
      fields: [
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
      lockedPaths: ["source", "migrated"],
      fields: [
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
      lockedPaths: ["source", "migrated"],
      fields: [
        objectField("overviewImage", "연구 개요 이미지", imageFields),
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
      lockedPaths: ["source", "migrated"],
      fields: [
        listField("projects", "프로젝트", {
          type: "object",
          fields: [
            stringField("id", "ID", { required: true, generated: "project-id" }),
            selectField("status", "상태", ["current", "completed"], { required: true }),
            selectField("category", "분류", ["industry", "rnd", "talent"], { required: true }),
            stringField("title", "과제명", { required: true }),
            stringField("program", "사업명", { optional: true }),
            stringField("sponsor", "지원·발주기관", { optional: true }),
            stringField("managingAgency", "전담·관리기관", { optional: true }),
            objectField("period", "기간", [
              stringField("start", "시작", { required: true, input: "month", pattern: "YYYY.MM" }),
              stringField("end", "종료", { required: true, input: "month", pattern: "YYYY.MM" }),
            ]),
            objectField("budget", "예산", [
              stringField("amount", "금액", { optional: true }),
              stringField("unit", "단위", { optional: true }),
            ]),
            listField("keywords", "키워드", { type: "select", options: controlledKeywords }, { maximum: 5 }),
            textField("description", "개요", { optional: true }),
            listField("details", "세부 연구내용", { type: "string" }),
            listField("images", "이미지", { type: "object", fields: imageFields }),
            stringField("rawMeta", "원본 메타데이터", { optional: true }),
          ],
        }),
      ],
    },
    publications: {
      file: "publications.json",
      label: "Publications",
      route: "/publications/",
      editable: true,
      lockedPaths: ["source", "migrated"],
      fields: [listField("items", "연구 성과", { type: "object", fields: publicationFields })],
    },
    seminars: {
      file: "seminars.json",
      label: "Seminars",
      route: "/seminars/",
      editable: true,
      lockedPaths: ["source"],
      fields: [
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
      lockedPaths: ["source", "migrated"],
      fields: [
        listField("events", "행사", {
          type: "object",
          fields: [
            stringField("date", "날짜", { required: true, input: "month", pattern: "YYYY.MM" }),
            stringField("title", "제목", { required: true }),
            textField("description", "설명", { optional: true }),
            booleanField("isSample", "레이아웃 점검 샘플", { optional: true }),
            listField("images", "이미지", { type: "object", fields: imageFields }),
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
    assetMigration: {
      file: "asset-migration.json",
      label: "Asset migration ledger",
      route: "/",
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
  const keywordSet = new Set(controlledKeywords);
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
  const validateKeywords = (keywords, location, maximum = 5) => {
    if (!Array.isArray(keywords)) return errors.push(`${location}: keywords must be an array`);
    if (keywords.length > maximum) errors.push(`${location}: use at most ${maximum} keywords`);
    if (new Set(keywords).size !== keywords.length) errors.push(`${location}: duplicate keyword`);
    keywords.forEach((keyword) => {
      if (!keywordSet.has(keyword)) errors.push(`${location}: unsupported keyword (${keyword})`);
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
      if (!image || typeof image !== "object") return errors.push(`${location}.images[${index}]: use {src, alt, caption}`);
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
  requiredText(home.recruitment?.intro, "home.recruitment.intro");
  (home.recruitment?.sections || []).forEach((section, index) => {
    requiredText(section.title, `home.sections[${index}].title`);
    if (!section.items?.length) errors.push(`home.sections[${index}].items: at least one item required`);
  });

  const news = read("news.json").news || [];
  news.forEach((item, index) => {
    if (!validDate(item.date)) errors.push(`news[${index}].date: use YYYY.MM`);
    if (!["project", "publication", "award", "member"].includes(item.category)) errors.push(`news[${index}].category: unsupported category`);
    requiredText(item.text, `news[${index}].text`);
  });

  const people = read("people.json").groups || {};
  for (const group of ["professor", "phd", "ms", "undergrad", "alumni"]) {
    if (!Array.isArray(people[group])) errors.push(`people.${group}: group is missing`);
    (people[group] || []).forEach((member, index) => {
      requiredText(member.name, `people.${group}[${index}].name`);
      validateImagePath(member.image, `people.${group}[${index}].image`);
    });
  }

  const research = read("research.json");
  validateImageObject(research.overviewImage, "research.overviewImage");
  if ((research.research || []).length !== 4) errors.push("research: four research directions are required");
  (research.research || []).forEach((topic, index) => {
    requiredText(topic.title, `research[${index}].title`);
    requiredText(topic.description, `research[${index}].description`);
    validateImagePath(topic.image, `research[${index}].image`);
  });

  const projects = read("projects.json").projects || [];
  const projectIds = new Set();
  projects.forEach((project, index) => {
    const at = `projects[${index}]`;
    requiredText(project.id, `${at}.id`);
    requiredText(project.title, `${at}.title`);
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

  const publications = read("publications.json").items || [];
  const publicationIds = new Set();
  publications.forEach((item, index) => {
    const at = `publications[${index}]`;
    requiredText(item.id, `${at}.id`);
    requiredText(item.title, `${at}.title`);
    requiredText(item.rawCitation, `${at}.rawCitation`);
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
    if (item.metrics?.indexing && !["SCIE", "ESCI", "KCI"].includes(item.metrics.indexing)) errors.push(`${at}.metrics.indexing: unsupported value`);
    if (item.metrics?.quartile && !/^Q[1-4]$/.test(item.metrics.quartile)) errors.push(`${at}.metrics.quartile: use Q1-Q4`);
    if (item.metrics?.topPercent && !/^\d+(?:[.]\d+)?$/.test(item.metrics.topPercent)) errors.push(`${at}.metrics.topPercent: numeric value required`);
    (item.links || []).forEach((link, linkIndex) => {
      requiredText(link.label, `${at}.links[${linkIndex}].label`);
      if (!/^https:\/\//.test(link.url || "")) errors.push(`${at}.links[${linkIndex}].url: HTTPS required`);
    });
  });

  const seminars = read("seminars.json").seminars || [];
  seminars.forEach((seminar, index) => {
    const at = `seminars[${index}]`;
    if (!validDate(seminar.date, true)) errors.push(`${at}.date: use YYYY.MM.DD`);
    requiredText(seminar.title, `${at}.title`);
    requiredText(seminar.speaker, `${at}.speaker`);
    requiredText(seminar.summary, `${at}.summary`);
    validateKeywords(seminar.keywords, `${at}.keywords`, 4);
    if (!seminar.keywords?.length) errors.push(`${at}.keywords: at least one keyword required`);
  });

  const gallery = read("gallery.json").events || [];
  gallery.forEach((event, index) => {
    if (!validDate(event.date)) errors.push(`gallery[${index}].date: use YYYY.MM`);
    requiredText(event.title, `gallery[${index}].title`);
    if (event.isSample !== undefined && typeof event.isSample !== "boolean") errors.push(`gallery[${index}].isSample: boolean required`);
    validateImages(event.images, `gallery[${index}]`);
  });

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
