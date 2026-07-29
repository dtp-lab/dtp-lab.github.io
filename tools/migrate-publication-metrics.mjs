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

    if (item.type === "journal") {
      const quartile = legacyMetrics.topPercent === "5"
        ? "Top-5%"
        : legacyMetrics.topPercent === "10"
          ? "Top-10%"
          : legacyMetrics.quartile || "해당없음";
      item.journalMetrics ||= {
        indexing: legacyMetrics.indexing || "없음",
        quartile: legacyMetrics.indexing === "SCIE" ? quartile : "해당없음",
        award: legacyMetrics.award || "",
      };
      delete item.conferenceMetrics;
      delete item.patentMetrics;
      delete item.patentNumber;
      for (const key of ["applicationDate", "registrationDate", "applicationNumber", "registrationNumber"]) delete item[key];
    } else if (item.type === "conference") {
      item.conferenceMetrics ||= {
        conferenceType: /[가-힣]/.test(item.venue || "") ? "국내" : "국제",
        bk21: "해당없음",
        kiise: "해당없음",
      };
      if (!["국제", "국내"].includes(item.conferenceMetrics.conferenceType)) {
        item.conferenceMetrics.conferenceType = /[가-힣]/.test(item.venue || "") ? "국내" : "국제";
      }
      if (item.conferenceMetrics.conferenceType === "국내") {
        item.conferenceMetrics.bk21 = "해당없음";
        item.conferenceMetrics.kiise = "해당없음";
      }
      delete item.journalMetrics;
      delete item.patentMetrics;
      delete item.patentNumber;
      for (const key of ["applicationDate", "registrationDate", "applicationNumber", "registrationNumber"]) delete item[key];
    } else if (item.type === "patent") {
      const pct = legacyPatentStatus === "PCT" || /\bPCT\b/i.test(`${item.venue || ""} ${item.details || ""}`);
      const legacyNumber = item.patentNumber || item.details || "";
      const legacyDate = /^\d{4}\.\d{2}\.\d{2}$/.test(item.publishedAt || "") ? item.publishedAt : "";
      item.patentMetrics ||= {
        jurisdiction: pct ? "PCT" : "국내",
        status: pct ? "출원" : (legacyPatentStatus === "등록" ? "등록" : "출원"),
      };
      if (item.patentMetrics.status === "공개") item.patentMetrics.status = "출원";
      item.applicationDate ??= legacyDate;
      item.registrationDate ??= "";
      item.applicationNumber ??= item.patentMetrics.status === "출원" ? legacyNumber : "";
      item.registrationNumber ??= item.patentMetrics.status === "등록" ? legacyNumber : "";
      delete item.publishedAt;
      delete item.patentNumber;
      delete item.journalMetrics;
      delete item.conferenceMetrics;
      for (const key of ["authors", "venue", "details", "keywords", "doi", "links"]) delete item[key];
    }
  }
  write(name, document);
}

console.log("Migrated publication metrics and initialized optional page subtitles.");
