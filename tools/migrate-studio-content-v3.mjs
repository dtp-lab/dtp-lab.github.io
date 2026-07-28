import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "site", "data");
const read = async (name) => JSON.parse(await readFile(path.join(dataDir, name), "utf8"));
const write = async (name, value) => writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const valueFrom = (fields, ...keys) => {
  for (const key of keys) {
    if (typeof fields?.[key] === "string") return fields[key];
  }
  return "";
};

const commonPerson = (person) => {
  const fields = person?.fields || {};
  return {
    image: person?.image || "",
    name: person?.name || "",
    affiliation: valueFrom(fields, "affiliation"),
    email: valueFrom(fields, "email", "e-mail"),
    researchTopic: valueFrom(fields, "researchTopic", "research_topic"),
  };
};

const people = await read("people.json");
if (people.groups) {
  const professorSource = people.groups.professor?.[0] || {};
  const professorFields = professorSource.fields || {};
  const professor = {
    ...commonPerson(professorSource),
    office: valueFrom(professorFields, "office"),
    telephone: valueFrom(professorFields, "telephone", "tel.", "tel"),
    career: Object.entries(professorFields)
      .filter(([key]) => /^\d{4}_/.test(key))
      .map(([period, role]) => ({ period: period.replaceAll("_", " "), role })),
  };
  const categoryMap = [
    ["phd", "phd"],
    ["ms", "master"],
    ["undergrad", "undergraduate"],
    ["alumni", "alumni"],
  ];
  const members = categoryMap.flatMap(([group, category]) =>
    (people.groups[group] || []).map((person) => ({ ...commonPerson(person), category })),
  );
  await write("people.json", { professor, members, page: people.page });
}

const publications = await read("publications.json");
for (const item of publications.items || []) {
  if (item.type !== "conference") continue;
  item.conferenceMetrics ||= { conferenceType: "국제", bk21: "해당없음", kiise: "해당없음" };
  item.conferenceMetrics.conferenceType = /[가-힣]/.test(item.venue || "") ? "국내" : "국제";
  if (item.conferenceMetrics.conferenceType === "국내") {
    item.conferenceMetrics.bk21 = "해당없음";
    item.conferenceMetrics.kiise = "해당없음";
  }
}
await write("publications.json", publications);

console.log("Migrated People and Conference content to Studio contract v3.");
