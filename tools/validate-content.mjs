import path from "node:path";
import { validateContent } from "./content-model.mjs";

const result = validateContent({ siteDir: path.resolve("site") });
result.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
if (!result.ok) {
  console.error(`Content validation failed (${result.errors.length})`);
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const { news, projects, publications, seminars, gallery } = result.counts;
console.log(`Content validation passed: ${news} news, ${projects} projects, ${publications} publications, ${seminars} seminars, ${gallery} gallery events.`);
