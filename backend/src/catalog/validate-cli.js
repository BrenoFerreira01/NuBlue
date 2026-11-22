import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./validate.js";

const catalogPath = process.argv[2] ?? fileURLToPath(new URL("../data/course-catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const errors = validateCatalog(catalog);
if (errors.length) {
  process.stderr.write(`Invalid course catalog (${errors.length} problems):\n- ${errors.join("\n- ")}\n`);
  process.exitCode = 1;
} else {
  const bonus = catalog.bonus ? "bonus enabled" : "bonus disabled";
  process.stdout.write(`Course catalog v${catalog.version} is valid: ${catalog.levels.length} levels, ${bonus}\n`);
}
