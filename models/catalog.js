import catalogData from "infra/data/course-catalog.json";
import database from "infra/database.js";
import { ForbiddenError, ServiceError } from "infra/errors.js";

/** Catálogo publicado ({ version, chapters, levels, bonus }), com respostas. */
export const catalog = catalogData;

function courseNotSeeded() {
  return new ServiceError(
    "course_not_seeded",
    "O curso ainda não foi preparado no banco de dados.",
  );
}

/** Níveis do curso sem as respostas, na ordem. */
async function listPublicLevels() {
  const { rows } = await database.query(
    "SELECT public_data FROM course_levels WHERE is_bonus = false ORDER BY id",
  );
  if (rows.length !== catalog.levels.length) throw courseNotSeeded();
  return {
    chapters: catalog.chapters,
    levels: rows.map((row) => row.public_data),
  };
}

async function countCompletedCourseLevels(client, studentId) {
  const { rows } = await client.query(
    `SELECT count(*)::integer AS count
     FROM level_completions lc
     JOIN course_levels cl ON cl.id = lc.level_id
     WHERE lc.student_id = $1 AND cl.is_bonus = false`,
    [studentId],
  );
  return rows[0].count;
}

/** Nível bônus: só existe se o catálogo o tiver e o aluno concluir o curso todo. */
async function getBonusLevel(studentId) {
  if (!catalog.bonus) throw new ServiceError("bonus_unavailable");
  const completed = await countCompletedCourseLevels(database, studentId);
  if (completed < catalog.levels.length) {
    throw new ForbiddenError(
      "level_locked",
      "Complete o nível anterior para continuar.",
    );
  }
  const { rows } = await database.query(
    "SELECT public_data FROM course_levels WHERE is_bonus = true ORDER BY id LIMIT 1",
  );
  if (!rows.length) throw new ServiceError("bonus_unavailable");
  return rows[0].public_data;
}

const courseCatalog = {
  listPublicLevels,
  getBonusLevel,
  countCompletedCourseLevels,
  courseNotSeeded,
};

export default courseCatalog;
