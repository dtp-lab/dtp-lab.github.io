import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("site", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const write = (name, value) => fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

for (const name of ["people.json", "projects.json", "publications.json", "seminars.json", "gallery.json"]) {
  const document = read(name);
  document.page.subtitle ??= "";
  if (name !== "publications.json") {
    write(name, document);
    continue;
  }

  for (const item of document.items || []) {
    const legacyMetrics = item.metrics || {};
    const legacyPatentStatus = item.patentStatus || "";
    delete item.metrics;
    delete item.patentStatus;
    delete item.journalMetrics;
    delete item.conferenceMetrics;
    delete item.patentMetrics;

    if (item.type === "journal") {
      const quartile = legacyMetrics.topPercent === "5"
        ? "Top-5%"
        : legacyMetrics.topPercent === "10"
          ? "Top-10%"
          : legacyMetrics.quartile || "해당없음";
      item.journalMetrics = {
        indexing: legacyMetrics.indexing || "없음",
        quartile: legacyMetrics.indexing === "SCIE" ? quartile : "해당없음",
        award: legacyMetrics.award || "",
      };
    } else if (item.type === "conference") {
      item.conferenceMetrics = {
        conferenceType: "미분류",
        bk21: "해당없음",
        kiise: "해당없음",
      };
    } else if (item.type === "patent") {
      const pct = legacyPatentStatus === "PCT" || /\bPCT\b/i.test(`${item.venue || ""} ${item.details || ""}`);
      item.patentMetrics = {
        jurisdiction: pct ? "PCT" : "국내",
        status: pct ? "출원" : (["등록", "출원", "공개"].includes(legacyPatentStatus) ? legacyPatentStatus : "출원"),
      };
    }
  }
  write(name, document);
}

console.log("Migrated publication metrics and initialized optional page subtitles.");
