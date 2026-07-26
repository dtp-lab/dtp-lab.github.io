import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const siteDir = path.resolve("site");
const dataDir = path.join(siteDir, "data");
const errors = [], warnings = [];
const controlledKeywords = new Set(["Digital Twin", "Physical AI", "Sim2Real", "Robotics", "Reinforcement Learning", "Optimization", "Surrogate Modeling", "Computer Vision", "Synthetic Data", "Energy Systems", "AI Education", "World Models", "Foundation Models", "Generative AI", "Localization", "Control", "Multimodal AI", "Scientific Machine Learning", "Sequence Modeling", "Resource Allocation", "Scheduling", "Deep Learning", "Extended Reality"]);
const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")); } catch (error) { errors.push(`${name}: ${error.message}`); return {}; } };
const requiredText = (value, location) => { if (typeof value !== "string" || !value.trim()) errors.push(`${location}: required text is missing`); };
const validDate = (value, day = false) => new RegExp(day ? "^\\d{4}\\.(0[1-9]|1[0-2])\\.(0[1-9]|[12]\\d|3[01])$" : "^\\d{4}\\.(0[1-9]|1[0-2])$").test(value || "");
const dateValue = (value = "") => Number(String(value).replace(/[^0-9]/g, "")) || 0;
const validateKeywords = (keywords, location, maximum = 5) => {
  if (!Array.isArray(keywords)) return errors.push(`${location}: keywords must be an array`);
  if (keywords.length > maximum) errors.push(`${location}: use at most ${maximum} keywords`);
  if (new Set(keywords).size !== keywords.length) errors.push(`${location}: duplicate keyword`);
  keywords.forEach((keyword) => { if (!controlledKeywords.has(keyword)) errors.push(`${location}: unsupported keyword (${keyword})`); });
};
const validateImages = (images, location) => {
  if (!Array.isArray(images)) return errors.push(`${location}.images: must be an array`);
  images.forEach((image, index) => {
    if (!image || typeof image !== "object") return errors.push(`${location}.images[${index}]: use {src, alt, caption}`);
    requiredText(image.src, `${location}.images[${index}].src`); requiredText(image.alt, `${location}.images[${index}].alt`);
    if (/^https?:/i.test(image.src || "")) errors.push(`${location}.images[${index}]: remote images are not allowed`);
    else if (image.src && !fs.existsSync(path.join(siteDir, image.src))) errors.push(`${location}.images[${index}]: file does not exist (${image.src})`);
    if (image.thumbnail !== undefined) {
      requiredText(image.thumbnail, `${location}.images[${index}].thumbnail`);
      validateImagePath(image.thumbnail, `${location}.images[${index}].thumbnail`);
    }
  });
};
const validateImagePath = (image, location) => {
  if (!image) return;
  if (/^https?:/i.test(image)) errors.push(`${location}: remote images are not allowed`);
  else if (!fs.existsSync(path.join(siteDir, image))) errors.push(`${location}: file does not exist (${image})`);
};
const validateImageObject = (image, location) => {
  if (!image || typeof image !== "object") return errors.push(`${location}: use {src, alt}`);
  requiredText(image.src, `${location}.src`);
  requiredText(image.alt, `${location}.alt`);
  validateImagePath(image.src, `${location}.src`);
};

const home = read("home.json");
requiredText(home.recruitment?.intro, "home.recruitment.intro");
(home.recruitment?.sections || []).forEach((section, index) => { requiredText(section.title, `home.sections[${index}].title`); if (!section.items?.length) errors.push(`home.sections[${index}].items: at least one item required`); });

const news = read("news.json").news || [];
news.forEach((item, index) => { if (!validDate(item.date)) errors.push(`news[${index}].date: use YYYY.MM`); if (!["project", "publication", "award", "member"].includes(item.category)) errors.push(`news[${index}].category: unsupported category`); requiredText(item.text, `news[${index}].text`); });

const people = read("people.json").groups || {};
for (const group of ["professor", "phd", "ms", "undergrad", "alumni"]) {
  if (!Array.isArray(people[group])) errors.push(`people.${group}: group is missing`);
  (people[group] || []).forEach((member, index) => { requiredText(member.name, `people.${group}[${index}].name`); validateImagePath(member.image, `people.${group}[${index}].image`); });
}

const research = read("research.json");
validateImageObject(research.overviewImage, "research.overviewImage");
if ((research.research || []).length !== 4) errors.push("research: four research directions are required");
(research.research || []).forEach((topic, index) => { requiredText(topic.title, `research[${index}].title`); requiredText(topic.description, `research[${index}].description`); validateImagePath(topic.image, `research[${index}].image`); });

const projects = read("projects.json").projects || [];
const projectIds = new Set();
projects.forEach((project, index) => {
  const at = `projects[${index}]`; requiredText(project.id, `${at}.id`); requiredText(project.title, `${at}.title`);
  if (projectIds.has(project.id)) errors.push(`${at}.id: duplicate`); projectIds.add(project.id);
  if (!["current", "completed"].includes(project.status)) errors.push(`${at}.status: unsupported status`);
  if (!["industry", "rnd", "talent"].includes(project.category)) errors.push(`${at}.category: unsupported category`);
  if (!validDate(project.period?.start) || !validDate(project.period?.end)) errors.push(`${at}.period: use YYYY.MM for start and end`);
  if (project.period?.start && project.period?.end && dateValue(project.period.start) > dateValue(project.period.end)) errors.push(`${at}.period: start is after end`);
  validateKeywords(project.keywords, `${at}.keywords`); validateImages(project.images, at);
  if (project.status === "current" && dateValue(project.period?.end) < dateValue(new Date().toISOString().slice(0, 7))) warnings.push(`${at}: Current project ended at ${project.period?.end}; status is preserved`);
});

const publications = read("publications.json").items || [];
const publicationIds = new Set();
publications.forEach((item, index) => {
  const at = `publications[${index}]`; requiredText(item.id, `${at}.id`); requiredText(item.title, `${at}.title`); requiredText(item.rawCitation, `${at}.rawCitation`);
  if (publicationIds.has(item.id)) errors.push(`${at}.id: duplicate`); publicationIds.add(item.id);
  if (!["journal", "conference", "patent"].includes(item.type)) errors.push(`${at}.type: unsupported type`);
  if (!validDate(item.publishedAt)) errors.push(`${at}.publishedAt: use YYYY.MM`);
  validateKeywords(item.keywords, `${at}.keywords`);
  (item.authors || []).forEach((author, authorIndex) => { requiredText(author.name, `${at}.authors[${authorIndex}].name`); for (const key of ["isLabMember", "isFirstAuthor", "isCorrespondingAuthor"]) if (typeof author[key] !== "boolean") errors.push(`${at}.authors[${authorIndex}].${key}: boolean required`); });
  if (item.type !== "patent" && item.authors?.length && !item.authors.some((author) => author.isFirstAuthor)) warnings.push(`${at}: no first author marker in source`);
  if (item.metrics?.indexing && !["SCIE", "ESCI", "KCI"].includes(item.metrics.indexing)) errors.push(`${at}.metrics.indexing: unsupported value`);
  if (item.metrics?.quartile && !/^Q[1-4]$/.test(item.metrics.quartile)) errors.push(`${at}.metrics.quartile: use Q1-Q4`);
  if (item.metrics?.topPercent && !/^\d+(?:[.]\d+)?$/.test(item.metrics.topPercent)) errors.push(`${at}.metrics.topPercent: numeric value required`);
  (item.links || []).forEach((link, linkIndex) => { requiredText(link.label, `${at}.links[${linkIndex}].label`); if (!/^https:\/\//.test(link.url || "")) errors.push(`${at}.links[${linkIndex}].url: HTTPS required`); });
});

const seminars = read("seminars.json").seminars || [];
seminars.forEach((seminar, index) => { const at = `seminars[${index}]`; if (!validDate(seminar.date, true)) errors.push(`${at}.date: use YYYY.MM.DD`); requiredText(seminar.title, `${at}.title`); requiredText(seminar.speaker, `${at}.speaker`); requiredText(seminar.summary, `${at}.summary`); validateKeywords(seminar.keywords, `${at}.keywords`, 4); if (!seminar.keywords?.length) errors.push(`${at}.keywords: at least one keyword required`); });

const gallery = read("gallery.json").events || [];
gallery.forEach((event, index) => { if (!validDate(event.date)) errors.push(`gallery[${index}].date: use YYYY.MM`); requiredText(event.title, `gallery[${index}].title`); if (event.isSample !== undefined && typeof event.isSample !== "boolean") errors.push(`gallery[${index}].isSample: boolean required`); validateImages(event.images, `gallery[${index}]`); });

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
if (errors.length) { console.error(`Content validation failed (${errors.length})`); errors.forEach((error) => console.error(`- ${error}`)); process.exit(1); }
console.log(`Content validation passed: ${news.length} news, ${projects.length} projects, ${publications.length} publications, ${seminars.length} seminars, ${gallery.length} gallery events.`);
