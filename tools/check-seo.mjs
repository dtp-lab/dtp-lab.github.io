import fs from "node:fs";
import path from "node:path";

const requestedDir = process.argv[2] || "_site";
const siteDir = path.resolve(requestedDir);
const origin = "https://dtp-lab.github.io";
const publicPages = [
  {
    output: "index.html",
    url: origin + "/",
    title: "부산대학교 디지털트윈 피지컬AI 연구실 | DTPLab",
    description: "부산대학교 정보컴퓨터공학부 DTPLab은 디지털트윈, Physical AI, 로봇 지능, Sim2Real 및 산업 최적화를 연구합니다."
  },
  {
    output: "people/index.html",
    url: origin + "/people/",
    title: "연구실 구성원 | 부산대학교 DTPLab",
    description: "부산대학교 디지털트윈 피지컬AI 연구실의 지도교수, 대학원생, 학부연구생 및 졸업생을 소개합니다."
  },
  {
    output: "projects/index.html",
    url: origin + "/projects/",
    title: "연구 프로젝트 | 부산대학교 DTPLab",
    description: "디지털트윈, Physical AI, 로봇 지능, Sim2Real 및 산업 최적화 분야의 DTPLab 연구 프로젝트입니다."
  },
  {
    output: "publications/index.html",
    url: origin + "/publications/",
    title: "논문·특허 | 부산대학교 DTPLab",
    description: "DTPLab의 국제저널, 학술대회 논문, 특허 및 주요 연구성과를 확인할 수 있습니다."
  },
  {
    output: "seminars/index.html",
    url: origin + "/seminars/",
    title: "연구 세미나 | 부산대학교 DTPLab",
    description: "DTPLab에서 진행한 Physical AI, 로보틱스, 디지털트윈 및 인공지능 연구 세미나 기록입니다."
  },
  {
    output: "gallery/index.html",
    url: origin + "/gallery/",
    title: "연구실 소식·갤러리 | 부산대학교 DTPLab",
    description: "부산대학교 DTPLab의 연구실 행사, 학술대회, 수상 및 구성원 활동 기록입니다."
  }
];

const errors = [];

const readRequired = (relativePath) => {
  const absolutePath = path.join(siteDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(relativePath + ": missing build output");
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const getAttribute = (tag, name) => {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
  return match ? match[2] : null;
};

const getMeta = (html, name) => {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((getAttribute(match[0], "name") || "").toLowerCase() === name.toLowerCase()) {
      return getAttribute(match[0], "content") || "";
    }
  }
  return null;
};

const getCanonical = (html) => {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if ((getAttribute(match[0], "rel") || "").toLowerCase() === "canonical") {
      return getAttribute(match[0], "href") || "";
    }
  }
  return null;
};

const getTitle = (html) => {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
};

const builtPages = publicPages.map((page) => ({ ...page, html: readRequired(page.output) }));
const seenTitles = new Set();
const seenDescriptions = new Set();

for (const page of builtPages) {
  const title = getTitle(page.html);
  const description = getMeta(page.html, "description");
  const canonical = getCanonical(page.html);
  const robots = getMeta(page.html, "robots");

  if (title !== page.title) errors.push(page.output + ": unexpected title");
  if (description !== page.description) errors.push(page.output + ": unexpected meta description");
  if (canonical !== page.url) errors.push(page.output + ": expected canonical " + page.url);
  if (robots && /(?:^|,)\s*noindex\b/i.test(robots)) errors.push(page.output + ": public page is marked noindex");
  if (title && seenTitles.has(title)) errors.push(page.output + ": duplicate title");
  if (description && seenDescriptions.has(description)) errors.push(page.output + ": duplicate meta description");
  if (title) seenTitles.add(title);
  if (description) seenDescriptions.add(description);
}

const home = builtPages[0]?.html || "";
const verificationToken = getMeta(home, "google-site-verification");
if (!verificationToken) {
  errors.push("index.html: missing google-site-verification token");
} else if (/(?:placeholder|replace|verification[_ -]?token)/i.test(verificationToken)) {
  errors.push("index.html: google-site-verification token is a placeholder");
}

const structuredDataMatch = home.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
if (!structuredDataMatch) {
  errors.push("index.html: missing ResearchOrganization JSON-LD");
} else {
  try {
    const organization = JSON.parse(structuredDataMatch[1]);
    if (organization["@context"] !== "https://schema.org") errors.push("index.html: JSON-LD has an unexpected @context");
    if (organization["@type"] !== "ResearchOrganization") errors.push("index.html: JSON-LD is not a ResearchOrganization");
    if (organization.url !== origin + "/") errors.push("index.html: JSON-LD has an unexpected URL");
    if (organization.logo !== origin + "/assets/brand/dtp-logo-full.png") errors.push("index.html: JSON-LD has an unexpected logo URL");
    if (organization.email !== "pnudtn@gmail.com") errors.push("index.html: JSON-LD has an unexpected email");
    if (!Array.isArray(organization.alternateName) || !organization.alternateName.includes("DTPLab") || !organization.alternateName.includes("디지털트윈 피지컬AI 연구실")) {
      errors.push("index.html: JSON-LD is missing alternate names");
    }
    if (Object.prototype.hasOwnProperty.call(organization, "sameAs")) errors.push("index.html: JSON-LD must not contain unverified sameAs links");
  } catch (error) {
    errors.push("index.html: invalid JSON-LD (" + error.message + ")");
  }
}

for (const output of ["archive.html", "alignment-lab.html"]) {
  const html = readRequired(output);
  const robots = getMeta(html, "robots");
  if (!robots || !/(?:^|,)\s*noindex\b/i.test(robots)) errors.push(output + ": expected noindex");
}

const robotsText = readRequired("robots.txt");
if (!/^User-agent:\s*\*\s*$/im.test(robotsText)) errors.push("robots.txt: missing wildcard user-agent");
if (!/^Allow:\s*\/\s*$/im.test(robotsText)) errors.push("robots.txt: missing Allow: /");
if (!/^Sitemap:\s*https:\/\/dtp-lab\.github\.io\/sitemap\.xml\s*$/im.test(robotsText)) errors.push("robots.txt: missing canonical sitemap declaration");

const sitemapText = readRequired("sitemap.xml");
const sitemapUrls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
const expectedUrls = publicPages.map((page) => page.url);
if (sitemapUrls.length !== expectedUrls.length) errors.push("sitemap.xml: expected exactly " + expectedUrls.length + " URLs");
if (new Set(sitemapUrls).size !== sitemapUrls.length) errors.push("sitemap.xml: duplicate URL");
for (const url of expectedUrls) {
  if (!sitemapUrls.includes(url)) errors.push("sitemap.xml: missing " + url);
}
for (const url of sitemapUrls) {
  if (!expectedUrls.includes(url)) errors.push("sitemap.xml: unexpected URL " + url);
}

if (errors.length) {
  console.error("SEO check failed (" + errors.length + ")");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log("SEO check passed for " + publicPages.length + " public pages.");
