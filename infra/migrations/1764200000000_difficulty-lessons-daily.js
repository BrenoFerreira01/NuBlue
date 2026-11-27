// Dificuldade geral do aluno, nivelamento, lições de 4 cruzadinhas e o
// desafio diário infinito.

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium'
        CHECK (difficulty IN ('easy', 'medium', 'hard')),
      ADD COLUMN IF NOT EXISTS placement_completed_at timestamptz;

    ALTER TABLE level_attempts
      ADD COLUMN IF NOT EXISTS difficulty text
        CHECK (difficulty IN ('easy', 'medium', 'hard')),
      ADD COLUMN IF NOT EXISTS puzzle_index smallint
        CHECK (puzzle_index BETWEEN 0 AND 3),
      ADD COLUMN IF NOT EXISTS lesson_id uuid;
    CREATE INDEX IF NOT EXISTS level_attempts_lesson_idx
      ON level_attempts (student_id, level_id, lesson_id)
      WHERE is_correct;

    ALTER TABLE daily_challenge_runs
      ADD COLUMN IF NOT EXISTS current_index integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS start_step smallint NOT NULL DEFAULT 3,
      ALTER COLUMN level_id DROP NOT NULL;

    -- Para repetir uma tentativa (mesma chave), o servidor gera de novo a
    -- cruzadinha a partir da posição e dos acertos daquele momento.
    ALTER TABLE daily_challenge_attempts
      ADD COLUMN IF NOT EXISTS puzzle_index integer,
      ADD COLUMN IF NOT EXISTS solved_before integer;
  `);
};

exports.down = (pgm) => {
  // level_id continua aceitando vazio: rodadas do desafio infinito não têm nível.
  pgm.sql(`
    ALTER TABLE daily_challenge_attempts
      DROP COLUMN IF EXISTS solved_before,
      DROP COLUMN IF EXISTS puzzle_index;
    ALTER TABLE daily_challenge_runs
      DROP COLUMN IF EXISTS start_step,
      DROP COLUMN IF EXISTS score,
      DROP COLUMN IF EXISTS current_index;
    DROP INDEX IF EXISTS level_attempts_lesson_idx;
    ALTER TABLE level_attempts
      DROP COLUMN IF EXISTS lesson_id,
      DROP COLUMN IF EXISTS puzzle_index,
      DROP COLUMN IF EXISTS difficulty;
    ALTER TABLE students
      DROP COLUMN IF EXISTS placement_completed_at,
      DROP COLUMN IF EXISTS difficulty;
  `);
};
