import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { query } from "tests/orchestrator.js";

const seed = (args = []) =>
  execFileSync(process.execPath, ["infra/scripts/seed.mjs", ...args], {
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });

describe("infra/scripts/seed.mjs", () => {
  it("semeia os 39 níveis do curso", async () => {
    seed();
    const [row] = await query(
      "SELECT count(*)::integer AS count FROM course_levels WHERE is_bonus = false",
    );
    expect(row.count).toBe(39);
  });

  it("recusa um catálogo inválido antes de gravar", async () => {
    const catalog = JSON.parse(
      readFileSync("infra/data/course-catalog.json", "utf8"),
    );
    catalog.levels[0].answerKey["l01-e01"] = 4;
    catalog.levels[0].title = "Alterado pelo teste";
    const dir = mkdtempSync(path.join(tmpdir(), "nublue-"));
    const file = path.join(dir, "catalog.json");
    writeFileSync(file, JSON.stringify(catalog));

    expect(() => seed([file])).toThrow();

    const [level] = await query(
      "SELECT public_data->>'title' AS title FROM course_levels WHERE id = 1",
    );
    expect(level.title).not.toBe("Alterado pelo teste");
  });
});
